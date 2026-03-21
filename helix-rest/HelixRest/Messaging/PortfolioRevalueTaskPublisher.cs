using System.Text.Json;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;

namespace HelixRest.Messaging;

public interface IPortfolioRevalueTaskPublisher
{
    Task PublishAsync(string portfolioId, DateTime requestedAt, CancellationToken cancellationToken);
}

public sealed class RabbitMqPortfolioRevalueTaskPublisher : IPortfolioRevalueTaskPublisher
{
    private readonly HelixRabbitMqOptions _options;
    private readonly ILogger<RabbitMqPortfolioRevalueTaskPublisher> _logger;

    public RabbitMqPortfolioRevalueTaskPublisher(
        IOptions<HelixRabbitMqOptions> options,
        ILogger<RabbitMqPortfolioRevalueTaskPublisher> logger)
    {
        _options = options.Value;
        _logger = logger;
    }

    public Task PublishAsync(string portfolioId, DateTime requestedAt, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var taskId = $"TASK-{Guid.NewGuid():N}".ToUpperInvariant()[..17];
        var payload = JsonSerializer.SerializeToUtf8Bytes(new
        {
            taskId,
            taskType = BrokerNames.PortfolioFullRevalueQueue,
            portfolioId,
            requestedAt = requestedAt.ToUniversalTime().ToString("O").Replace("+00:00", "Z")
        });

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
        channel.QueueDeclare(
            queue: _options.PortfolioFullRevalueQueue,
            durable: true,
            exclusive: false,
            autoDelete: false,
            arguments: null);
        var properties = channel.CreateBasicProperties();
        properties.Persistent = true;
        properties.ContentType = "application/json";
        channel.BasicPublish(
            exchange: string.Empty,
            routingKey: _options.PortfolioFullRevalueQueue,
            basicProperties: properties,
            body: payload);

        _logger.LogInformation(
            "Queued portfolio revalue task for portfolio {PortfolioId} on queue {Queue}.",
            portfolioId,
            _options.PortfolioFullRevalueQueue);

        return Task.CompletedTask;
    }
}
