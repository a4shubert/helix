namespace HelixRest.Messaging;

public static class BrokerNames
{
    public const string TradeCreatedTopic = "trade.created";
    public const string PositionsUpdatedTopic = "positions.updated";
    public const string PlUpdatedTopic = "pl.updated";
    public const string RiskUpdatedTopic = "risk.updated";
    public const string PortfolioRecomputeQueue = "portfolio.recompute";

    public static readonly string[] UpdateTopics =
    [
        PositionsUpdatedTopic,
        PlUpdatedTopic,
        RiskUpdatedTopic
    ];
}
