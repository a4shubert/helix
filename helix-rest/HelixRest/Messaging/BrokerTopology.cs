namespace HelixRest.Messaging;

public static class BrokerTopology
{
    public const string TradeCreatedTopic = "trade.created";
    public const string TradeUpdatedTopic = "trade.updated";
    public const string PositionsUpdatedTopic = "positions.updated";
    public const string PlUpdatedTopic = "pl.updated";
    public const string RiskUpdatedTopic = "risk.updated";

    public const string PortfolioRecomputeQueue = "portfolio.recompute";
    public const string TradeComputeQueue = "trade.compute";

    public static readonly string[] PortfolioUpdateTopics =
    [
        TradeUpdatedTopic,
        PositionsUpdatedTopic,
        PlUpdatedTopic,
        RiskUpdatedTopic
    ];
}
