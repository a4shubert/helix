namespace HelixRest.Data.Entities;

public class RiskSnapshotEntity
{
    public required string SnapshotId { get; set; }
    public required string PortfolioId { get; set; }
    public double Delta { get; set; }
    public double GrossExposure { get; set; }
    public double NetExposure { get; set; }
    public double? Var95 { get; set; }
    public DateTime ValuationTs { get; set; }
    public DateTime MarketDataAsOfTs { get; set; }
    public DateTime PositionAsOfTs { get; set; }

    public PortfolioEntity? Portfolio { get; set; }
}
