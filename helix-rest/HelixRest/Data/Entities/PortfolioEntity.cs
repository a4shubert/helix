namespace HelixRest.Data.Entities;

public class PortfolioEntity
{
    public required string PortfolioId { get; set; }
    public required string Name { get; set; }
    public int SortOrder { get; set; }
    public required string Status { get; set; }
    public DateTime CreatedAt { get; set; }

    public ICollection<PositionSnapshotEntity> Positions { get; set; } = new List<PositionSnapshotEntity>();
    public ICollection<TradeEntity> Trades { get; set; } = new List<TradeEntity>();
    public ICollection<PnlSnapshotEntity> PnlSnapshots { get; set; } = new List<PnlSnapshotEntity>();
    public ICollection<RiskSnapshotEntity> RiskSnapshots { get; set; } = new List<RiskSnapshotEntity>();
}
