using Microsoft.EntityFrameworkCore;
using HelixRest.Data.Entities;

namespace HelixRest.Data;

public class HelixContext : DbContext
{
    public HelixContext(DbContextOptions<HelixContext> options) : base(options) { }

    public DbSet<PortfolioEntity> Portfolios => Set<PortfolioEntity>();
    public DbSet<InstrumentEntity> Instruments => Set<InstrumentEntity>();
    public DbSet<BookEntity> Books => Set<BookEntity>();
    public DbSet<DeskEntity> Desks => Set<DeskEntity>();
    public DbSet<TradeEntity> Trades => Set<TradeEntity>();
    public DbSet<PositionSnapshotEntity> PositionSnapshots => Set<PositionSnapshotEntity>();
    public DbSet<PnlSnapshotEntity> PnlSnapshots => Set<PnlSnapshotEntity>();
    public DbSet<RiskSnapshotEntity> RiskSnapshots => Set<RiskSnapshotEntity>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<PortfolioEntity>(entity =>
        {
            entity.ToTable("portfolio");
            entity.HasKey(x => x.PortfolioId);
            entity.Property(x => x.PortfolioId).HasColumnName("portfolio_id");
            entity.Property(x => x.Name).HasColumnName("name");
            entity.Property(x => x.Status).HasColumnName("status");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        modelBuilder.Entity<InstrumentEntity>(entity =>
        {
            entity.ToTable("instrument");
            entity.HasKey(x => x.InstrumentId);
            entity.Property(x => x.InstrumentId).HasColumnName("instrument_id");
            entity.Property(x => x.InstrumentName).HasColumnName("instrument_name");
            entity.Property(x => x.AssetClass).HasColumnName("asset_class");
            entity.Property(x => x.Currency).HasColumnName("currency");
            entity.Property(x => x.Active).HasColumnName("active");
        });

        modelBuilder.Entity<BookEntity>(entity =>
        {
            entity.ToTable("book");
            entity.HasKey(x => x.Name);
            entity.Property(x => x.Name).HasColumnName("name");
        });

        modelBuilder.Entity<DeskEntity>(entity =>
        {
            entity.ToTable("desk");
            entity.HasKey(x => x.Name);
            entity.Property(x => x.Name).HasColumnName("name");
        });

        modelBuilder.Entity<TradeEntity>(entity =>
        {
            entity.ToTable("trades");
            entity.HasKey(x => x.TradeId);
            entity.Property(x => x.TradeId).HasColumnName("trade_id");
            entity.Property(x => x.PortfolioId).HasColumnName("portfolio_id");
            entity.Property(x => x.PositionId).HasColumnName("position_id");
            entity.Property(x => x.InstrumentId).HasColumnName("instrument_id");
            entity.Property(x => x.InstrumentName).HasColumnName("instrument_name");
            entity.Property(x => x.AssetClass).HasColumnName("asset_class");
            entity.Property(x => x.Currency).HasColumnName("currency");
            entity.Property(x => x.Side).HasColumnName("side");
            entity.Property(x => x.Quantity).HasColumnName("quantity");
            entity.Property(x => x.Price).HasColumnName("price");
            entity.Property(x => x.Notional).HasColumnName("notional");
            entity.Property(x => x.TradeTimestamp).HasColumnName("trade_timestamp");
            entity.Property(x => x.SettlementDate).HasColumnName("settlement_date");
            entity.Property(x => x.Book).HasColumnName("book");
            entity.Property(x => x.Desk).HasColumnName("desk");
            entity.Property(x => x.Status).HasColumnName("status");
            entity.Property(x => x.Version).HasColumnName("version");
            entity.Property(x => x.CreatedAt).HasColumnName("created_at");
            entity.Property(x => x.UpdatedAt).HasColumnName("updated_at");
            entity.HasOne(x => x.Portfolio)
                .WithMany(x => x.Trades)
                .HasForeignKey(x => x.PortfolioId);
        });

        modelBuilder.Entity<PositionSnapshotEntity>(entity =>
        {
            entity.ToTable("position_snapshot");
            entity.HasKey(x => x.SnapshotId);
            entity.Property(x => x.SnapshotId).HasColumnName("snapshot_id");
            entity.Property(x => x.PortfolioId).HasColumnName("portfolio_id");
            entity.Property(x => x.PositionId).HasColumnName("position_id");
            entity.Property(x => x.InstrumentId).HasColumnName("instrument_id");
            entity.Property(x => x.InstrumentName).HasColumnName("instrument_name");
            entity.Property(x => x.AssetClass).HasColumnName("asset_class");
            entity.Property(x => x.Currency).HasColumnName("currency");
            entity.Property(x => x.Quantity).HasColumnName("quantity");
            entity.Property(x => x.Direction).HasColumnName("direction");
            entity.Property(x => x.AverageCost).HasColumnName("average_cost");
            entity.Property(x => x.LastUpdateTs).HasColumnName("last_update_ts");
            entity.Property(x => x.MarketPrice).HasColumnName("market_price");
            entity.Property(x => x.MarketDataTs).HasColumnName("market_data_ts");
            entity.Property(x => x.Notional).HasColumnName("notional");
            entity.Property(x => x.MarketValue).HasColumnName("market_value");
            entity.Property(x => x.Book).HasColumnName("book");
            entity.Property(x => x.Desk).HasColumnName("desk");
            entity.Property(x => x.AsOfTs).HasColumnName("as_of_ts");
            entity.Property(x => x.SourceEventId).HasColumnName("source_event_id");
            entity.HasOne(x => x.Portfolio)
                .WithMany(x => x.Positions)
                .HasForeignKey(x => x.PortfolioId);
        });

        modelBuilder.Entity<PnlSnapshotEntity>(entity =>
        {
            entity.ToTable("pnl_snapshot");
            entity.HasKey(x => x.SnapshotId);
            entity.Property(x => x.SnapshotId).HasColumnName("snapshot_id");
            entity.Property(x => x.PortfolioId).HasColumnName("portfolio_id");
            entity.Property(x => x.TotalPnl).HasColumnName("total_pnl");
            entity.Property(x => x.RealizedPnl).HasColumnName("realized_pnl");
            entity.Property(x => x.UnrealizedPnl).HasColumnName("unrealized_pnl");
            entity.Property(x => x.ValuationTs).HasColumnName("valuation_ts");
            entity.Property(x => x.MarketDataAsOfTs).HasColumnName("market_data_as_of_ts");
            entity.Property(x => x.PositionAsOfTs).HasColumnName("position_as_of_ts");
            entity.HasOne(x => x.Portfolio)
                .WithMany(x => x.PnlSnapshots)
                .HasForeignKey(x => x.PortfolioId);
        });

        modelBuilder.Entity<RiskSnapshotEntity>(entity =>
        {
            entity.ToTable("risk_snapshot");
            entity.HasKey(x => x.SnapshotId);
            entity.Property(x => x.SnapshotId).HasColumnName("snapshot_id");
            entity.Property(x => x.PortfolioId).HasColumnName("portfolio_id");
            entity.Property(x => x.Delta).HasColumnName("delta");
            entity.Property(x => x.Gamma).HasColumnName("gamma");
            entity.Property(x => x.Var95).HasColumnName("var_95");
            entity.Property(x => x.StressLoss).HasColumnName("stress_loss");
            entity.Property(x => x.ValuationTs).HasColumnName("valuation_ts");
            entity.Property(x => x.MarketDataAsOfTs).HasColumnName("market_data_as_of_ts");
            entity.Property(x => x.PositionAsOfTs).HasColumnName("position_as_of_ts");
            entity.HasOne(x => x.Portfolio)
                .WithMany(x => x.RiskSnapshots)
                .HasForeignKey(x => x.PortfolioId);
        });
    }
}
