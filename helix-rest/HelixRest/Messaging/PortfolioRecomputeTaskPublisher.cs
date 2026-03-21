using System.Text.Json;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;

namespace HelixRest.Messaging;

public interface IPortfolioRecomputeTaskPublisher
{
    Task PublishAsync(string portfolioId, string sourceEventId, DateTime requestedAt, CancellationToken cancellationToken);
}

public sealed class RabbitMqPortfolioRecomputeTaskPublisher : IPortfolioRecomputeTaskPublisher
{
    private readonly HelixRabbitMqOptions _options;

    public RabbitMqPortfolioRecomputeTaskPublisher(IOptions<HelixRabbitMqOptions> options)
    {
        _options = options.Value;
    }

    public Task PublishAsync(string portfolioId, string sourceEventId, DateTime requestedAt, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();

        var payload = JsonSerializer.SerializeToUtf8Bytes(new
        {
            taskId = $"TASK-{sourceEventId}",
            taskType = BrokerNames.PortfolioRecomputeQueue,
            portfolioId,
            requestedAt = requestedAt.ToUniversalTime().ToString("O").Replace("+00:00", "Z"),
            sourceEventId
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
        channel.QueueDeclare(_options.PortfolioRecomputeQueue, true, false, false, null);
        var properties = channel.CreateBasicProperties();
        properties.Persistent = true;
        properties.ContentType = "application/json";
        channel.BasicPublish("", _options.PortfolioRecomputeQueue, properties, payload);

        return Task.CompletedTask;
    }
}
