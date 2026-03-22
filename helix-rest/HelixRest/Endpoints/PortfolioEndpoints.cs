using HelixRest.Data;
using HelixRest.Messaging;
using HelixRest.Messaging.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace HelixRest.Endpoints;

public static class PortfolioEndpoints
{
    public static WebApplication MapPortfolioEndpoints(this WebApplication app)
    {
        app.MapGet("/api/portfolios", async (HelixContext db) =>
        {
            var portfolios = await db.Portfolios
                .AsNoTracking()
                .OrderBy(x => x.SortOrder)
                .ThenBy(x => x.PortfolioId)
                .Select(x => new
                {
                    portfolioId = x.PortfolioId,
                    name = x.Name,
                    status = x.Status,
                    createdAt = x.CreatedAt
                })
                .ToListAsync();

            return Results.Ok(portfolios);
        }).WithTags("portfolio");

        app.MapPost("/api/portfolios/{portfolioId}/recompute", async (
            string portfolioId,
            HelixContext db,
            ITaskQueuePublisher taskPublisher,
            CancellationToken cancellationToken) =>
        {
            var exists = await db.Portfolios.AnyAsync(x => x.PortfolioId == portfolioId, cancellationToken);
            if (!exists)
            {
                return Results.NotFound(new { message = $"Portfolio '{portfolioId}' not found." });
            }

            var requestedAt = DateTime.UtcNow;
            await taskPublisher.PublishPortfolioRecomputeAsync(portfolioId, null, requestedAt, cancellationToken);

            return Results.Accepted($"/api/portfolio?portfolioId={portfolioId}", new
            {
                portfolioId,
                status = "queued",
                queue = BrokerTopology.PortfolioRecomputeQueue,
                requestedAt
            });
        }).WithTags("portfolio");

        app.MapGet("/api/portfolio", async (
            string portfolioId,
            DateTime? asOf,
            HelixContext db,
            CancellationToken cancellationToken) =>
        {
            var portfolio = await db.Portfolios
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.PortfolioId == portfolioId, cancellationToken);

            if (portfolio is null)
            {
                return Results.NotFound(new { message = $"Portfolio '{portfolioId}' not found." });
            }

            var snapshot = await SnapshotQueries.LoadLatestPositionSnapshotAsync(db, portfolioId, asOf, cancellationToken);
            var effectiveAsOf = snapshot.EffectiveAsOf;

            if (string.IsNullOrWhiteSpace(effectiveAsOf))
            {
                return Results.Ok(new
                {
                    portfolioId = portfolio.PortfolioId,
                    name = portfolio.Name,
                    status = portfolio.Status,
                    createdAt = portfolio.CreatedAt,
                    asOf = (string?)null,
                    positions = Array.Empty<object>()
                });
            }

            var positions = snapshot.Rows
                .Select(x => new
                {
                    positionId = x.PositionId,
                    instrumentId = x.InstrumentId,
                    instrumentName = x.InstrumentName,
                    assetClass = x.AssetClass,
                    currency = x.Currency,
                    quantity = x.Quantity,
                    direction = x.Direction,
                    averageCost = x.AverageCost,
                    lastUpdateTs = x.LastUpdateTs,
                    marketPrice = x.MarketPrice,
                    marketDataTs = x.MarketDataTs,
                    notional = x.Notional,
                    marketValue = x.MarketValue,
                    book = x.Book,
                })
                .ToList();

            return Results.Ok(new
            {
                portfolioId = portfolio.PortfolioId,
                name = portfolio.Name,
                status = portfolio.Status,
                createdAt = portfolio.CreatedAt,
                asOf = effectiveAsOf,
                positions
            });
        }).WithTags("portfolio");

        return app;
    }
}
