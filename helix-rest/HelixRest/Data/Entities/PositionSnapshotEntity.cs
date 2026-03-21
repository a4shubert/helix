namespace HelixRest.Data.Entities;

public class PositionSnapshotEntity
{
    public required string SnapshotId { get; set; }
    public required string PortfolioId { get; set; }
    public required string PositionId { get; set; }
    public required string InstrumentId { get; set; }
    public required string InstrumentName { get; set; }
    public required string AssetClass { get; set; }
    public required string Currency { get; set; }
    public double Quantity { get; set; }
    public required string Direction { get; set; }
    public double AverageCost { get; set; }
    public double ContractMultiplier { get; set; }
    public DateOnly TradeDate { get; set; }
    public DateTime LastUpdateTs { get; set; }
    public double? MarketPrice { get; set; }
    public DateTime? MarketDataTs { get; set; }
    public double? FxRate { get; set; }
    public double? Notional { get; set; }
    public double? MarketValue { get; set; }
    public string? Sector { get; set; }
    public string? Region { get; set; }
    public string? Strategy { get; set; }
    public string? Desk { get; set; }
    public DateTime AsOfTs { get; set; }
    public string? SourceEventId { get; set; }

    public PortfolioEntity? Portfolio { get; set; }
}
