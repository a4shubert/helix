using System.Text.Json;
using Confluent.Kafka;
using HelixRest.Messaging.Abstractions;
using HelixRest.Messaging.Configuration;
using Microsoft.Extensions.Options;

namespace HelixRest.Messaging.Kafka;

public sealed class KafkaTradeEventPublisher : ITradeEventPublisher, IDisposable
{
    private readonly ILogger<KafkaTradeEventPublisher> _logger;
    private readonly IProducer<Null, string>? _producer;

    public KafkaTradeEventPublisher(
        IOptions<KafkaOptions> options,
        ILogger<KafkaTradeEventPublisher> logger)
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

    public async Task PublishTradeCreatedAsync(
        string tradeId,
        string portfolioId,
        DateTime occurredAt,
        CancellationToken cancellationToken)
        => await PublishTradeEventAsync(
            tradeId,
            portfolioId,
            occurredAt,
            BrokerTopology.TradeCreatedTopic,
            cancellationToken);

    public async Task PublishTradeDeletedAsync(
        string tradeId,
        string portfolioId,
        DateTime occurredAt,
        CancellationToken cancellationToken)
        => await PublishTradeEventAsync(
            tradeId,
            portfolioId,
            occurredAt,
            BrokerTopology.TradeDeletedTopic,
            cancellationToken);

    private async Task PublishTradeEventAsync(
        string tradeId,
        string portfolioId,
        DateTime occurredAt,
        string eventType,
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
            eventType,
            tradeId,
            portfolioId,
            timestamp = occurredAt.ToUniversalTime().ToString("O").Replace("+00:00", "Z")
        });

        await _producer.ProduceAsync(
            eventType,
            new Message<Null, string> { Value = payload },
            cancellationToken);
    }

    public void Dispose()
    {
        _producer?.Dispose();
    }
}
