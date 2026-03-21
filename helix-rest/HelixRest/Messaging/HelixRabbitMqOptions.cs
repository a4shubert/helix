namespace HelixRest.Messaging;

public sealed class HelixRabbitMqOptions
{
    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 5672;
    public string Username { get; set; } = "guest";
    public string Password { get; set; } = "guest";
    public string VirtualHost { get; set; } = "/";
    public string PortfolioRecomputeQueue { get; set; } = BrokerNames.PortfolioRecomputeQueue;
    public string TradeComputeQueue { get; set; } = BrokerNames.TradeComputeQueue;
}
