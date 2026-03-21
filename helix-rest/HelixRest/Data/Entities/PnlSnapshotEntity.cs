namespace HelixRest.Data.Entities;

public class PnlSnapshotEntity
{
    public required string SnapshotId { get; set; }
    public required string PortfolioId { get; set; }
    public double TotalPnl { get; set; }
    public double RealizedPnl { get; set; }
    public double UnrealizedPnl { get; set; }
    public DateTime ValuationTs { get; set; }
    public DateTime MarketDataAsOfTs { get; set; }
    public DateTime PositionAsOfTs { get; set; }

    public PortfolioEntity? Portfolio { get; set; }
}
