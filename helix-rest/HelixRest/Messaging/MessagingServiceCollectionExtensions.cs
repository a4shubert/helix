using HelixRest.Messaging.Abstractions;
using HelixRest.Messaging.Configuration;
using HelixRest.Messaging.Kafka;
using HelixRest.Messaging.RabbitMq;
using HelixRest.Messaging.Streaming;

namespace HelixRest.Messaging;

public static class MessagingServiceCollectionExtensions
{
    public static IServiceCollection AddHelixMessaging(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<KafkaOptions>(options =>
        {
            options.BootstrapServers = Environment.GetEnvironmentVariable("HELIX_KAFKA_BOOTSTRAP_SERVERS") ?? string.Empty;
        });

        services.Configure<RabbitMqOptions>(options =>
        {
            options.Host = Environment.GetEnvironmentVariable("HELIX_RABBITMQ_HOST") ?? "localhost";
            options.Port = int.TryParse(Environment.GetEnvironmentVariable("HELIX_RABBITMQ_PORT"), out var port) ? port : 5672;
            options.Username = Environment.GetEnvironmentVariable("HELIX_RABBITMQ_USERNAME") ?? "guest";
            options.Password = Environment.GetEnvironmentVariable("HELIX_RABBITMQ_PASSWORD") ?? "guest";
            options.VirtualHost = Environment.GetEnvironmentVariable("HELIX_RABBITMQ_VHOST") ?? "/";
            options.PortfolioRecomputeQueue = Environment.GetEnvironmentVariable("HELIX_RABBITMQ_QUEUE_PORTFOLIO_RECOMPUTE")
                ?? BrokerTopology.PortfolioRecomputeQueue;
            options.TradeComputeQueue = Environment.GetEnvironmentVariable("HELIX_RABBITMQ_QUEUE_TRADE_COMPUTE")
                ?? BrokerTopology.TradeComputeQueue;
        });

        services.AddSingleton<PortfolioUpdateBroadcaster>();
        services.AddSingleton<ITradeEventPublisher, KafkaTradeEventPublisher>();
        services.AddSingleton<ITaskQueuePublisher, RabbitMqTaskQueuePublisher>();
        services.AddHostedService<KafkaPortfolioUpdatesConsumer>();

        return services;
    }
}
