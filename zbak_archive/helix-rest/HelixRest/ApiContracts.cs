namespace HelixRest;

public sealed record CreateTradeRequest(
    string PortfolioId,
    string InstrumentId,
    string Side,
    double Quantity,
    double Price,
    DateOnly? SettlementDate,
    string? Book,
    int? Version
);
