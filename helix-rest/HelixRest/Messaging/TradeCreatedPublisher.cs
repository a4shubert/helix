using System.Text.Json;
using Confluent.Kafka;
using Microsoft.Extensions.Options;

namespace HelixRest.Messaging;

public interface ITradeCreatedPublisher
{
    Task PublishAsync(string tradeId, string portfolioId, DateTime occurredAt, CancellationToken cancellationToken);
}

public sealed class KafkaTradeCreatedPublisher : ITradeCreatedPublisher, IDisposable
{
    private readonly ILogger<KafkaTradeCreatedPublisher> _logger;
    private readonly IProducer<Null, string>? _producer;

    public KafkaTradeCreatedPublisher(
        IOptions<HelixKafkaOptions> options,
        ILogger<KafkaTradeCreatedPublisher> logger)
    {
        _logger = logger;
        var bootstrapServers = options.Value.BootstrapServers.Trim();
        if (string.IsNullOrWhiteSpace(bootstrapServers))
        {
            _logger.LogWarning("Kafka disabled: HELIX_KAFKA_BOOTSTRAP_SERVERS is not configured.");
            return;
        }

        _producer = new ProducerBuilder<Null, string>(new ProducerConfig
        {
            BootstrapServers = bootstrapServers
        }).Build();
    }

    public async Task PublishAsync(
        string tradeId,
        string portfolioId,
        DateTime occurredAt,
        CancellationToken cancellationToken)
    {
        if (_producer is null)
        {
            _logger.LogInformation(
                "Skipping Kafka publish for trade {TradeId}; Kafka is disabled.",
                tradeId);
            return;
        }

        var payload = JsonSerializer.Serialize(new
        {
            eventId = $"EVT-{Guid.NewGuid():N}".ToUpperInvariant()[..16],
            eventType = BrokerNames.TradeCreatedTopic,
            tradeId,
            portfolioId,
            timestamp = occurredAt.ToUniversalTime().ToString("O").Replace("+00:00", "Z")
        });

        await _producer.ProduceAsync(
            BrokerNames.TradeCreatedTopic,
            new Message<Null, string> { Value = payload },
            cancellationToken);
    }

    public void Dispose()
    {
        _producer?.Dispose();
    }
}
