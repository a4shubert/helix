using System.Net.Sockets;
using System.Text.Json;
using Confluent.Kafka;
using Confluent.Kafka.Admin;
using HelixRest.Messaging.Configuration;
using HelixRest.Messaging.Streaming;
using Microsoft.Extensions.Options;

namespace HelixRest.Messaging.Kafka;

public sealed class KafkaPortfolioUpdatedConsumer : BackgroundService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly KafkaOptions _options;
    private readonly PortfolioUpdateBroadcaster _broadcaster;
    private readonly ILogger<KafkaPortfolioUpdatedConsumer> _logger;

    public KafkaPortfolioUpdatedConsumer(
        IOptions<KafkaOptions> options,
        PortfolioUpdateBroadcaster broadcaster,
        ILogger<KafkaPortfolioUpdatedConsumer> logger)
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

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (!IsAnyBootstrapServerReachable(bootstrapServers))
                {
                    _logger.LogWarning(
                        "Kafka bootstrap server is unreachable ({BootstrapServers}). Retrying in 3 seconds.",
                        bootstrapServers);
                    await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
                    continue;
                }

                await EnsureTopicsExistAsync(bootstrapServers);

                using var consumer = new ConsumerBuilder<Ignore, string>(new ConsumerConfig
                {
                    BootstrapServers = bootstrapServers,
                    GroupId = "helix-rest-updates",
                    AutoOffsetReset = AutoOffsetReset.Latest,
                    EnableAutoCommit = true
                }).Build();

                consumer.Subscribe(BrokerTopology.PortfolioUpdateTopics);
                _logger.LogInformation(
                    "Kafka update consumer subscribed to: {Topics}",
                    string.Join(", ", BrokerTopology.PortfolioUpdateTopics));

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

                        await _broadcaster.PublishAsync(new PortfolioUpdateMessage(
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
                        break;
                    }
                    catch (JsonException ex)
                    {
                        _logger.LogWarning(ex, "Ignoring invalid update message from topic {Topic}.", result?.Topic);
                    }
                }
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Kafka update consumer will retry in 3 seconds.");
                try
                {
                    await Task.Delay(TimeSpan.FromSeconds(3), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }
    }

    private static bool IsAnyBootstrapServerReachable(string bootstrapServers)
    {
        foreach (var endpoint in bootstrapServers.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = endpoint.Split(':', 2, StringSplitOptions.TrimEntries);
            var host = parts[0];
            var port = 9092;
            if (parts.Length == 2 && int.TryParse(parts[1], out var parsedPort))
            {
                port = parsedPort;
            }

            try
            {
                using var client = new TcpClient();
                var connectTask = client.ConnectAsync(host, port);
                if (connectTask.Wait(TimeSpan.FromMilliseconds(500)) && client.Connected)
                {
                    return true;
                }
            }
            catch
            {
            }
        }

        return false;
    }

    private static async Task EnsureTopicsExistAsync(string bootstrapServers)
    {
        using var admin = new AdminClientBuilder(new AdminClientConfig
        {
            BootstrapServers = bootstrapServers
        }).Build();

        try
        {
            await admin.CreateTopicsAsync(
                BrokerTopology.PortfolioUpdateTopics.Select(topic => new TopicSpecification
                {
                    Name = topic,
                    NumPartitions = 1,
                    ReplicationFactor = 1
                }));
        }
        catch (CreateTopicsException ex)
        {
            var unexpected = ex.Results
                .Where(result =>
                    result.Error.IsError
                    && result.Error.Code != ErrorCode.TopicAlreadyExists
                    && result.Error.Code != ErrorCode.NoError)
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
