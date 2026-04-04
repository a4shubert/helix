namespace HelixRest.Messaging.Configuration;

public sealed class RabbitMqOptions
{
    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 5672;
    public string Username { get; set; } = "guest";
    public string Password { get; set; } = "guest";
    public string VirtualHost { get; set; } = "/";
    public string TradeComputeQueue { get; set; } = BrokerTopology.TradeComputeQueue;
    public string PositionPlComputeQueue { get; set; } = BrokerTopology.PositionPlComputeQueue;
    public string PortfolioPlComputeQueue { get; set; } = BrokerTopology.PortfolioPlComputeQueue;
    public string PortfolioRiskComputeQueue { get; set; } = BrokerTopology.PortfolioRiskComputeQueue;
}
