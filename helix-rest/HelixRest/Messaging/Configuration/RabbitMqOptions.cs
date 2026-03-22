namespace HelixRest.Messaging.Configuration;

public sealed class RabbitMqOptions
{
    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 5672;
    public string Username { get; set; } = "guest";
    public string Password { get; set; } = "guest";
    public string VirtualHost { get; set; } = "/";
    public string PortfolioRecomputeQueue { get; set; } = BrokerTopology.PortfolioRecomputeQueue;
    public string TradeComputeQueue { get; set; } = BrokerTopology.TradeComputeQueue;
}
