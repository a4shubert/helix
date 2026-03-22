using HelixRest.Data;
using HelixRest.Data.Entities;
using HelixRest.Messaging;
using HelixRest.Messaging.Abstractions;
using Microsoft.EntityFrameworkCore;

namespace HelixRest.Endpoints;

public static class TradeEndpoints
{
    public static WebApplication MapTradeEndpoints(this WebApplication app)
    {
        app.MapGet("/api/trades", async (
            string portfolioId,
            string? status,
            DateTime? from,
            DateTime? to,
            HelixContext db) =>
        {
            var query = db.Trades
                .AsNoTracking()
                .Where(x => x.PortfolioId == portfolioId);

            if (!string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(x => x.Status == status);
            }

            if (from.HasValue)
            {
                query = query.Where(x => x.TradeTimestamp >= from.Value);
            }

            if (to.HasValue)
            {
                query = query.Where(x => x.TradeTimestamp <= to.Value);
            }

            var trades = await query
                .OrderByDescending(x => x.TradeTimestamp)
                .Select(x => new
                {
                    tradeId = x.TradeId,
                    portfolioId = x.PortfolioId,
                    positionId = x.PositionId,
                    instrumentId = x.InstrumentId,
                    instrumentName = x.InstrumentName,
                    assetClass = x.AssetClass,
                    currency = x.Currency,
                    side = x.Side,
                    quantity = x.Quantity,
                    price = x.Price,
                    notional = x.Notional,
                    tradeTimestamp = x.TradeTimestamp,
                    settlementDate = x.SettlementDate,
                    book = x.Book,
                    status = x.Status,
                    version = x.Version,
                    createdAt = x.CreatedAt,
                    updatedAt = x.UpdatedAt
                })
                .ToListAsync();

            return Results.Ok(new
            {
                portfolioId,
                count = trades.Count,
                trades
            });
        }).WithTags("trades");

        app.MapGet("/api/trade-form-options", async (HelixContext db, CancellationToken cancellationToken) =>
        {
            var marketRows = await SnapshotQueries.LoadLatestMarketDataRowsAsync(db, cancellationToken);
            var marketPriceByInstrument = marketRows
                .Where(x => x.Price.HasValue)
                .ToDictionary(
                    x => x.InstrumentId,
                    x => x.Price!.Value,
                    StringComparer.OrdinalIgnoreCase);

            var instrumentRows = await db.Instruments
                .AsNoTracking()
                .Where(x => x.Active)
                .Select(x => new
                {
                    instrumentId = x.InstrumentId,
                    instrumentName = x.InstrumentName,
                    assetClass = x.AssetClass,
                    currency = x.Currency,
                })
                .ToListAsync(cancellationToken);

            var instruments = instrumentRows
                .Select(x => new
                {
                    x.instrumentId,
                    x.instrumentName,
                    x.assetClass,
                    x.currency,
                    marketPrice = marketPriceByInstrument.TryGetValue(x.instrumentId, out var price)
                        ? price
                        : (double?)null,
                })
                .ToList();

            var books = await db.Books
                .AsNoTracking()
                .Select(x => x.Name)
                .ToListAsync(cancellationToken);

            var assetClasses = instruments
                .Select(x => x.assetClass)
                .Distinct()
                .ToList();

            return Results.Ok(new
            {
                assetClasses,
                instruments,
                books
            });
        }).WithTags("trades");

        app.MapPost("/api/trades", async (
            CreateTradeRequest request,
            HelixContext db,
            ITradeEventPublisher publisher,
            ITaskQueuePublisher taskPublisher,
            CancellationToken cancellationToken) =>
        {
            var portfolioExists = await db.Portfolios.AnyAsync(x => x.PortfolioId == request.PortfolioId, cancellationToken);
            if (!portfolioExists)
            {
                return Results.BadRequest(new { message = $"Portfolio '{request.PortfolioId}' does not exist." });
            }

            var instrument = await SnapshotQueries.LoadValidInstrumentAsync(db, request.InstrumentId, cancellationToken);
            if (instrument is null)
            {
                return Results.BadRequest(new { message = $"Instrument '{request.InstrumentId}' does not exist." });
            }

            var validationError = await SnapshotQueries.ValidateReferenceSelectionsAsync(db, request.Book, cancellationToken);
            if (validationError is not null)
            {
                return validationError;
            }

            var submittedAt = DateTime.UtcNow;
            var tradeId = $"TRD-{request.PortfolioId}-{submittedAt:yyyyMMddHHmmssfff}";
            var positionId = $"{request.PortfolioId}-POS-{submittedAt:yyyyMMddHHmmssfff}";

            var entity = BuildAcceptedTradeEntity(request, instrument, tradeId, positionId, submittedAt);

            db.Trades.Add(entity);
            await db.SaveChangesAsync(cancellationToken);
            await publisher.PublishTradeCreatedAsync(tradeId, request.PortfolioId, submittedAt, cancellationToken);
            await taskPublisher.PublishPositionPlComputeAsync(request.PortfolioId, tradeId, submittedAt, cancellationToken);
            await taskPublisher.PublishTradeComputeAsync(request.PortfolioId, tradeId, submittedAt, cancellationToken);

            return Results.Ok(new
            {
                tradeId,
                portfolioId = request.PortfolioId,
                positionId = entity.PositionId,
                status = "accepted",
                submittedAt
            });
        }).WithTags("trades");

        app.MapPut("/api/trades/{tradeId}", async (
            string tradeId,
            CreateTradeRequest request,
            HelixContext db,
            ITradeEventPublisher publisher,
            ITaskQueuePublisher taskPublisher,
            CancellationToken cancellationToken) =>
        {
            var existingTrade = await db.Trades.FirstOrDefaultAsync(x => x.TradeId == tradeId, cancellationToken);
            if (existingTrade is null)
            {
                return Results.NotFound(new { message = $"Trade '{tradeId}' not found." });
            }

            if (!string.Equals(existingTrade.PortfolioId, request.PortfolioId, StringComparison.Ordinal))
            {
                return Results.BadRequest(new { message = $"Trade '{tradeId}' does not belong to portfolio '{request.PortfolioId}'." });
            }

            var instrument = await SnapshotQueries.LoadValidInstrumentAsync(db, request.InstrumentId, cancellationToken);
            if (instrument is null)
            {
                return Results.BadRequest(new { message = $"Instrument '{request.InstrumentId}' does not exist." });
            }

            var validationError = await SnapshotQueries.ValidateReferenceSelectionsAsync(db, request.Book, cancellationToken);
            if (validationError is not null)
            {
                return validationError;
            }

            var submittedAt = DateTime.UtcNow;
            ApplyTradeAmendment(existingTrade, request, instrument, submittedAt);

            await db.SaveChangesAsync(cancellationToken);
            await publisher.PublishTradeCreatedAsync(tradeId, request.PortfolioId, submittedAt, cancellationToken);
            await taskPublisher.PublishPositionPlComputeAsync(request.PortfolioId, tradeId, submittedAt, cancellationToken);
            await taskPublisher.PublishTradeComputeAsync(request.PortfolioId, tradeId, submittedAt, cancellationToken);

            return Results.Ok(new
            {
                tradeId,
                portfolioId = request.PortfolioId,
                positionId = existingTrade.PositionId,
                status = "accepted",
                submittedAt
            });
        }).WithTags("trades");

        app.MapDelete("/api/trades/{tradeId}", async (
            string tradeId,
            HelixContext db,
            ITradeEventPublisher publisher,
            ITaskQueuePublisher taskPublisher,
            CancellationToken cancellationToken) =>
        {
            var existingTrade = await db.Trades.FirstOrDefaultAsync(x => x.TradeId == tradeId, cancellationToken);
            if (existingTrade is null)
            {
                return Results.NotFound(new { message = $"Trade '{tradeId}' not found." });
            }

            var portfolioId = existingTrade.PortfolioId;
            db.Trades.Remove(existingTrade);
            await db.SaveChangesAsync(cancellationToken);

            var requestedAt = DateTime.UtcNow;
            await publisher.PublishTradeDeletedAsync(tradeId, portfolioId, requestedAt, cancellationToken);
            await taskPublisher.PublishPositionPlComputeAsync(portfolioId, null, requestedAt, cancellationToken);

            return Results.Accepted($"/api/portfolio?portfolioId={portfolioId}", new
            {
                tradeId,
                portfolioId,
                status = "deleted-queued",
                queue = BrokerTopology.PositionPlComputeQueue,
                requestedAt
            });
        }).WithTags("trades");

        return app;
    }

    private static TradeEntity BuildAcceptedTradeEntity(
        CreateTradeRequest request,
        InstrumentEntity instrument,
        string tradeId,
        string positionId,
        DateTime submittedAt) =>
        new()
        {
            TradeId = tradeId,
            PortfolioId = request.PortfolioId,
            PositionId = positionId,
            InstrumentId = instrument.InstrumentId,
            InstrumentName = instrument.InstrumentName,
            AssetClass = instrument.AssetClass,
            Currency = instrument.Currency,
            Side = request.Side,
            Quantity = request.Quantity,
            Price = request.Price,
            Notional = null,
            TradeTimestamp = submittedAt,
            SettlementDate = request.SettlementDate,
            Book = request.Book,
            Status = "accepted",
            Version = request.Version ?? 1,
            CreatedAt = submittedAt,
            UpdatedAt = submittedAt
        };

    private static void ApplyTradeAmendment(
        TradeEntity existingTrade,
        CreateTradeRequest request,
        InstrumentEntity instrument,
        DateTime submittedAt)
    {
        existingTrade.InstrumentId = instrument.InstrumentId;
        existingTrade.InstrumentName = instrument.InstrumentName;
        existingTrade.AssetClass = instrument.AssetClass;
        existingTrade.Currency = instrument.Currency;
        existingTrade.Side = request.Side;
        existingTrade.Quantity = request.Quantity;
        existingTrade.Price = request.Price;
        existingTrade.Notional = null;
        existingTrade.TradeTimestamp = submittedAt;
        existingTrade.SettlementDate = request.SettlementDate;
        existingTrade.Book = request.Book;
        existingTrade.Status = "accepted";
        existingTrade.Version = request.Version ?? (existingTrade.Version + 1);
        existingTrade.UpdatedAt = submittedAt;
    }
}
