using System.Text.Json;
using HelixRest.Messaging.Abstractions;
using HelixRest.Messaging.Configuration;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;

namespace HelixRest.Messaging.RabbitMq;

public sealed class RabbitMqTaskQueuePublisher : ITaskQueuePublisher
{
    private readonly RabbitMqOptions _options;

    public RabbitMqTaskQueuePublisher(IOptions<RabbitMqOptions> options)
    {
        _options = options.Value;
    }

    public Task PublishPortfolioComputeAsync(
        string portfolioId,
        string? sourceEventId,
        DateTime requestedAt,
        CancellationToken cancellationToken)
        => PublishTaskAsync(
            _options.PortfolioComputeQueue,
            BrokerTopology.PortfolioComputeQueue,
            portfolioId,
            sourceEventId,
            requestedAt,
            cancellationToken);

    public Task PublishTradeComputeAsync(
        string portfolioId,
        string tradeId,
        DateTime requestedAt,
        CancellationToken cancellationToken)
        => PublishTaskAsync(
            _options.TradeComputeQueue,
            BrokerTopology.TradeComputeQueue,
            portfolioId,
            tradeId,
            requestedAt,
            cancellationToken);

    private Task PublishTaskAsync(
        string queueName,
        string taskType,
        string portfolioId,
        string? sourceEventId,
        DateTime requestedAt,
        CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var payloadBody = new Dictionary<string, object?>
        {
            ["taskId"] = $"TASK-{Guid.NewGuid():N}".ToUpperInvariant(),
            ["taskType"] = taskType,
            ["portfolioId"] = portfolioId,
            ["requestedAt"] = requestedAt.ToUniversalTime().ToString("O").Replace("+00:00", "Z"),
        };
        if (!string.IsNullOrWhiteSpace(sourceEventId))
        {
            payloadBody["sourceEventId"] = sourceEventId;
        }

        var payload = JsonSerializer.SerializeToUtf8Bytes(payloadBody);

        var factory = new ConnectionFactory
        {
            HostName = _options.Host,
            Port = _options.Port,
            UserName = _options.Username,
            Password = _options.Password,
            VirtualHost = _options.VirtualHost
        };

        using var connection = factory.CreateConnection();
        using var channel = connection.CreateModel();
        channel.QueueDeclare(queueName, true, false, false, null);
        var properties = channel.CreateBasicProperties();
        properties.Persistent = true;
        properties.ContentType = "application/json";
        channel.BasicPublish("", queueName, properties, payload);

        return Task.CompletedTask;
    }
}
