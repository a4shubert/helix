using HelixRest.Data;
using Microsoft.EntityFrameworkCore;

namespace HelixRest.Endpoints;

public static class AnalyticsEndpoints
{
    public static WebApplication MapAnalyticsEndpoints(this WebApplication app)
    {
        app.MapGet("/api/market-data", async (HelixContext db, CancellationToken cancellationToken) =>
        {
            var rows = await SnapshotQueries.LoadLatestMarketDataRowsAsync(db, cancellationToken);
            var asOf = rows
                .Select(x => x.UpdatedAt)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .OrderByDescending(x => x)
                .FirstOrDefault();

            return Results.Ok(new
            {
                asOf = asOf ?? string.Empty,
                count = rows.Count,
                rows = rows.Select(x => new
                {
                    instrumentId = x.InstrumentId,
                    instrumentName = x.InstrumentName,
                    assetClass = x.AssetClass,
                    currency = x.Currency,
                    price = x.Price,
                    volatility = x.Volatility,
                    updatedAt = x.UpdatedAt ?? string.Empty
                })
            });
        }).WithTags("market-data");

        app.MapGet("/api/pnl", async (string portfolioId, DateTime? asOf, HelixContext db, CancellationToken cancellationToken) =>
        {
            var portfolioExists = await db.Portfolios.AnyAsync(x => x.PortfolioId == portfolioId, cancellationToken);
            if (!portfolioExists)
            {
                return Results.NotFound(new { message = $"Portfolio '{portfolioId}' not found." });
            }

            var metricColumns = await SnapshotQueries.LoadNumericMetricColumnsAsync(db, "pnl", cancellationToken);
            var snapshot = await SnapshotQueries.LoadLatestSnapshotRowAsync(
                db,
                "pnl",
                portfolioId,
                asOf,
                metricColumns,
                cancellationToken);

            var metrics = metricColumns
                .Select((column, index) => new
                {
                    metricKey = column,
                    label = SnapshotQueries.ToMetricLabel(column),
                    value = SnapshotQueries.RoundToTwoDecimals(snapshot?.MetricValues.GetValueOrDefault(column) ?? 0.0),
                    isPrimary = index == 0
                })
                .ToList();

            return Results.Ok(new
            {
                snapshotId = snapshot?.SnapshotId ?? string.Empty,
                portfolioId = snapshot?.PortfolioId ?? portfolioId,
                totalPnl = SnapshotQueries.RoundToTwoDecimals(snapshot?.MetricValues.GetValueOrDefault("total_pnl") ?? 0.0),
                realizedPnl = SnapshotQueries.RoundToTwoDecimals(snapshot?.MetricValues.GetValueOrDefault("realized_pnl") ?? 0.0),
                unrealizedPnl = SnapshotQueries.RoundToTwoDecimals(snapshot?.MetricValues.GetValueOrDefault("unrealized_pnl") ?? 0.0),
                valuationTs = snapshot?.ValuationTs ?? string.Empty,
                marketDataAsOfTs = snapshot?.MarketDataAsOfTs ?? string.Empty,
                positionAsOfTs = snapshot?.PositionAsOfTs ?? string.Empty,
                metrics
            });
        }).WithTags("analytics");

        app.MapGet("/api/risk", async (string portfolioId, DateTime? asOf, HelixContext db, CancellationToken cancellationToken) =>
        {
            var portfolioExists = await db.Portfolios.AnyAsync(x => x.PortfolioId == portfolioId, cancellationToken);
            if (!portfolioExists)
            {
                return Results.NotFound(new { message = $"Portfolio '{portfolioId}' not found." });
            }

            var metricColumns = await SnapshotQueries.LoadNumericMetricColumnsAsync(db, "risk", cancellationToken);
            var snapshot = await SnapshotQueries.LoadLatestSnapshotRowAsync(
                db,
                "risk",
                portfolioId,
                asOf,
                metricColumns,
                cancellationToken);

            var metrics = metricColumns
                .Select((column, index) => new
                {
                    metricKey = column,
                    label = SnapshotQueries.ToMetricLabel(column),
                    value = SnapshotQueries.RoundToTwoDecimals(snapshot?.MetricValues.GetValueOrDefault(column) ?? 0.0),
                    isPrimary = index == 0
                })
                .ToList();

            return Results.Ok(new
            {
                snapshotId = snapshot?.SnapshotId ?? string.Empty,
                portfolioId = snapshot?.PortfolioId ?? portfolioId,
                delta = SnapshotQueries.RoundToTwoDecimals(snapshot?.MetricValues.GetValueOrDefault("delta") ?? 0.0),
                grossExposure = SnapshotQueries.RoundToTwoDecimals(snapshot?.MetricValues.GetValueOrDefault("gross_exposure") ?? 0.0),
                netExposure = SnapshotQueries.RoundToTwoDecimals(snapshot?.MetricValues.GetValueOrDefault("net_exposure") ?? 0.0),
                var95 = SnapshotQueries.RoundToTwoDecimals(snapshot?.MetricValues.GetValueOrDefault("var_95") ?? 0.0),
                valuationTs = snapshot?.ValuationTs ?? string.Empty,
                marketDataAsOfTs = snapshot?.MarketDataAsOfTs ?? string.Empty,
                positionAsOfTs = snapshot?.PositionAsOfTs ?? string.Empty,
                metrics
            });
        }).WithTags("analytics");

        return app;
    }
}
