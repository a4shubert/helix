namespace HelixRest.Messaging;

public static class BrokerTopology
{
    public const string TradeCreatedTopic = "trade.created";
    public const string TradeDeletedTopic = "trade.deleted";
    public const string TradeUpdatedTopic = "trade.updated";
    public const string PositionUpdatedTopic = "position.updated";
    public const string PositionPlUpdatedTopic = "position.pl.updated";
    public const string PortfolioPlUpdatedTopic = "portfolio.pl.updated";
    public const string PortfolioRiskUpdatedTopic = "portfolio.risk.updated";

    public const string TradeComputeQueue = "trade.compute";
    public const string PositionPlComputeQueue = "position.pl.compute";
    public const string PortfolioPlComputeQueue = "portfolio.pl.compute";
    public const string PortfolioRiskComputeQueue = "portfolio.risk.compute";

    public static readonly string[] PortfolioUpdateTopics =
    [
        TradeDeletedTopic,
        TradeUpdatedTopic,
        PositionUpdatedTopic,
        PositionPlUpdatedTopic,
        PortfolioPlUpdatedTopic,
        PortfolioRiskUpdatedTopic
    ];
}
