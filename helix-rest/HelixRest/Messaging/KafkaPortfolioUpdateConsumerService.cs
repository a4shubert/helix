using System.Text.Json;
using Confluent.Kafka;
using Confluent.Kafka.Admin;
using Microsoft.Extensions.Options;

namespace HelixRest.Messaging;

public sealed class KafkaPortfolioUpdateConsumerService : BackgroundService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly HelixKafkaOptions _options;
    private readonly UpdateStreamBroadcaster _broadcaster;
    private readonly ILogger<KafkaPortfolioUpdateConsumerService> _logger;

    public KafkaPortfolioUpdateConsumerService(
        IOptions<HelixKafkaOptions> options,
        UpdateStreamBroadcaster broadcaster,
        ILogger<KafkaPortfolioUpdateConsumerService> logger)
    {
        _options = options.Value;
        _broadcaster = broadcaster;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var bootstrapServers = _options.BootstrapServers.Trim();
        if (string.IsNullOrWhiteSpace(bootstrapServers))
        {
            _logger.LogWarning("Kafka update consumer disabled: HELIX_KAFKA_BOOTSTRAP_SERVERS is not configured.");
            return;
        }

        await EnsureTopicsExistAsync(bootstrapServers, stoppingToken);

        using var consumer = new ConsumerBuilder<Ignore, string>(new ConsumerConfig
        {
            BootstrapServers = bootstrapServers,
            GroupId = "helix-rest-updates",
            AutoOffsetReset = AutoOffsetReset.Latest,
            EnableAutoCommit = true
        }).Build();

        consumer.Subscribe(BrokerNames.UpdateTopics);
        _logger.LogInformation(
            "Kafka update consumer subscribed to: {Topics}",
            string.Join(", ", BrokerNames.UpdateTopics));

        while (!stoppingToken.IsCancellationRequested)
        {
            ConsumeResult<Ignore, string>? result = null;
            try
            {
                result = consumer.Consume(stoppingToken);
                if (result?.Message?.Value is null)
                {
                    continue;
                }

                var update = JsonSerializer.Deserialize<PortfolioUpdateEnvelope>(result.Message.Value, JsonOptions);
                if (update is null
                    || string.IsNullOrWhiteSpace(update.EventType)
                    || string.IsNullOrWhiteSpace(update.PortfolioId)
                    || string.IsNullOrWhiteSpace(update.SnapshotId)
                    || string.IsNullOrWhiteSpace(update.Timestamp))
                {
                    continue;
                }

                await _broadcaster.PublishAsync(new PortfolioUpdateNotification(
                    update.EventType,
                    update.PortfolioId,
                    update.SnapshotId,
                    update.Timestamp));
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (ConsumeException ex)
            {
                _logger.LogWarning(ex, "Kafka consume error for topic {Topic}.", result?.Topic);
            }
            catch (JsonException ex)
            {
                _logger.LogWarning(ex, "Ignoring invalid update message from topic {Topic}.", result?.Topic);
            }
        }
    }

    private async Task EnsureTopicsExistAsync(string bootstrapServers, CancellationToken cancellationToken)
    {
        using var admin = new AdminClientBuilder(new AdminClientConfig
        {
            BootstrapServers = bootstrapServers
        }).Build();

        try
        {
            await admin.CreateTopicsAsync(
                BrokerNames.UpdateTopics.Select(topic => new TopicSpecification
                {
                    Name = topic,
                    NumPartitions = 1,
                    ReplicationFactor = 1
                }));
        }
        catch (CreateTopicsException ex)
        {
            var unexpected = ex.Results
                .Where(result => result.Error.Code != ErrorCode.TopicAlreadyExists)
                .ToArray();

            if (unexpected.Length > 0)
            {
                throw;
            }
        }
    }

    private sealed record PortfolioUpdateEnvelope(
        string EventId,
        string EventType,
        string PortfolioId,
        string SnapshotId,
        string Timestamp);
}
