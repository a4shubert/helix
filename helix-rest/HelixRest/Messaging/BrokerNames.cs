namespace HelixRest.Messaging;

public static class BrokerNames
{
    public const string TradeCreatedTopic = "trade.created";
    public const string PortfolioUpdatedTopic = "portfolio.updated";
    public const string PnlUpdatedTopic = "pnl.updated";
    public const string RiskUpdatedTopic = "risk.updated";

    public static readonly string[] UpdateTopics =
    [
        PortfolioUpdatedTopic,
        PnlUpdatedTopic,
        RiskUpdatedTopic
    ];
}
