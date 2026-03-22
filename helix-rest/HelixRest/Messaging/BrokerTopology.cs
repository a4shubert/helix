namespace HelixRest.Messaging;

public static class BrokerTopology
{
    public const string TradeCreatedTopic = "trade.created";
    public const string TradeDeletedTopic = "trade.deleted";
    public const string TradeUpdatedTopic = "trade.updated";
    public const string PortfolioUpdatedTopic = "portfolio.updated";
    public const string PlUpdatedTopic = "pl.updated";
    public const string RiskUpdatedTopic = "risk.updated";

    public const string PortfolioComputeQueue = "portfolio.compute";
    public const string TradeComputeQueue = "trade.compute";

    public static readonly string[] PortfolioUpdateTopics =
    [
        TradeDeletedTopic,
        TradeUpdatedTopic,
        PortfolioUpdatedTopic,
        PlUpdatedTopic,
        RiskUpdatedTopic
    ];
}
