namespace HelixRest.Data.Entities;

public class TradeEntity
{
    public required string TradeId { get; set; }
    public required string PortfolioId { get; set; }
    public string? PositionId { get; set; }
    public required string InstrumentId { get; set; }
    public required string InstrumentName { get; set; }
    public required string AssetClass { get; set; }
    public required string Currency { get; set; }
    public required string Side { get; set; }
    public double Quantity { get; set; }
    public double Price { get; set; }
    public double? Notional { get; set; }
    public DateTime TradeTimestamp { get; set; }
    public DateOnly? SettlementDate { get; set; }
    public string? Book { get; set; }
    public required string Status { get; set; }
    public int Version { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }

    public PortfolioEntity? Portfolio { get; set; }
}
