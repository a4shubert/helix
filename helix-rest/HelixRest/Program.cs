using HelixRest.Data;
using HelixRest.Data.Entities;
using HelixRest.Messaging;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
var builder = WebApplication.CreateBuilder(args);

var envDbPath = Environment.GetEnvironmentVariable("HELIX_DB_PATH");

var connString = builder.Configuration.GetConnectionString("HelixSqlite");
if (!string.IsNullOrWhiteSpace(envDbPath))
{
    var absPath = Path.GetFullPath(envDbPath);
    connString = $"Data Source={absPath}";
}
Console.WriteLine($"[HelixRest] Using SQLite connection: {connString}");

var urlsToUse = Environment.GetEnvironmentVariable("ASPNETCORE_URLS");
if (string.IsNullOrWhiteSpace(urlsToUse))
{
    const string urlError =
        "[HelixRest] ASPNETCORE_URLS not set. Please set ASPNETCORE_URLS to the binding URL(s).";
    Console.Error.WriteLine(urlError);
    throw new InvalidOperationException(urlError);
}

builder.WebHost.UseUrls(urlsToUse);
Console.WriteLine($"[HelixRest] Binding URLs: {urlsToUse}");

var helixWebUrl = Environment.GetEnvironmentVariable("HELIX_WEB_URL") ?? "http://localhost:3001";
var allowedWebOrigins = new[]
{
    helixWebUrl,
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001"
}.Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
builder.Services.AddCors(options =>
{
    options.AddPolicy("HelixWeb", policy =>
    {
        policy.WithOrigins(allowedWebOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

builder.Services.AddDbContext<HelixContext>(options => options.UseSqlite(connString));
builder.Services.Configure<HelixKafkaOptions>(options =>
{
    options.BootstrapServers = Environment.GetEnvironmentVariable("HELIX_KAFKA_BOOTSTRAP_SERVERS") ?? string.Empty;
});
builder.Services.Configure<HelixRabbitMqOptions>(options =>
{
    options.Host = Environment.GetEnvironmentVariable("HELIX_RABBITMQ_HOST") ?? "localhost";
    options.Port = int.TryParse(Environment.GetEnvironmentVariable("HELIX_RABBITMQ_PORT"), out var port) ? port : 5672;
    options.Username = Environment.GetEnvironmentVariable("HELIX_RABBITMQ_USERNAME") ?? "guest";
    options.Password = Environment.GetEnvironmentVariable("HELIX_RABBITMQ_PASSWORD") ?? "guest";
    options.VirtualHost = Environment.GetEnvironmentVariable("HELIX_RABBITMQ_VHOST") ?? "/";
    options.PortfolioRecomputeQueue = Environment.GetEnvironmentVariable("HELIX_RABBITMQ_QUEUE_PORTFOLIO_RECOMPUTE")
        ?? BrokerNames.PortfolioRecomputeQueue;
});
builder.Services.AddSingleton<UpdateStreamBroadcaster>();
builder.Services.AddSingleton<ITradeCreatedPublisher, KafkaTradeCreatedPublisher>();
builder.Services.AddSingleton<IPortfolioRecomputeTaskPublisher, RabbitMqPortfolioRecomputeTaskPublisher>();
builder.Services.AddHostedService<KafkaPortfolioUpdateConsumerService>();

builder.Logging.AddFilter("Microsoft.EntityFrameworkCore", LogLevel.Warning);
builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.Warning);
builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Database.Transaction", LogLevel.Warning);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseCors("HelixWeb");

app.Use(async (context, next) =>
{
    Console.WriteLine($"[HelixRest] {context.Request.Method} {context.Request.Path}{context.Request.QueryString}");
    await next.Invoke();
});

app.UseSwagger();

app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();
app.MapGet("/swagger", () => Results.Redirect("/swagger/index.html")).ExcludeFromDescription();
app.MapGet("/swagger/index.html", () => Results.Content(
    """
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Helix REST API - Swagger UI</title>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
      <style>
        html, body { margin: 0; padding: 0; background: #fafafa; }
      </style>
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
      <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
      <script>
        window.ui = SwaggerUIBundle({
          url: "/swagger/v1/swagger.json",
          dom_id: "#swagger-ui",
          deepLinking: true,
          presets: [
            SwaggerUIBundle.presets.apis,
            SwaggerUIStandalonePreset
          ],
          layout: "StandaloneLayout"
        });
      </script>
    </body>
    </html>
    """,
    "text/html")).ExcludeFromDescription();

app.MapGet("/health", async (HelixContext db) =>
{
    var canConnect = await db.Database.CanConnectAsync();
    return Results.Ok(new
    {
        service = "helix-rest",
        database = canConnect ? "success" : "unreachable",
    });
}).WithTags("system");

app.MapGet("/api/events", async (
    HttpContext context,
    string? portfolioId,
    UpdateStreamBroadcaster broadcaster,
    CancellationToken cancellationToken) =>
{
    context.Response.Headers.Append("Cache-Control", "no-cache");
    context.Response.Headers.Append("Content-Type", "text/event-stream");
    context.Response.Headers.Append("X-Accel-Buffering", "no");

    await using var subscription = broadcaster.Subscribe(portfolioId);
    await context.Response.WriteAsync("event: connected\n", cancellationToken);
    await context.Response.WriteAsync("data: {\"status\":\"ok\"}\n\n", cancellationToken);
    await context.Response.Body.FlushAsync(cancellationToken);

    await foreach (var update in subscription.Reader.ReadAllAsync(cancellationToken))
    {
        await context.Response.WriteAsync($"event: {update.EventType}\n", cancellationToken);
        await context.Response.WriteAsync($"data: {update.ToJson()}\n\n", cancellationToken);
        await context.Response.Body.FlushAsync(cancellationToken);
    }
}).WithTags("system");

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

app.MapGet("/api/portfolio", async (string portfolioId, DateTime? asOf, HelixContext db) =>
{
    var portfolio = await db.Portfolios
        .AsNoTracking()
        .FirstOrDefaultAsync(x => x.PortfolioId == portfolioId);

    if (portfolio is null)
    {
        return Results.NotFound(new { message = $"Portfolio '{portfolioId}' not found." });
    }

    var query = db.PositionSnapshots
        .AsNoTracking()
        .Where(x => x.PortfolioId == portfolioId);

    var effectiveAsOf = asOf.HasValue
        ? await query
            .Where(x => x.AsOfTs <= asOf.Value)
            .MaxAsync(x => (DateTime?)x.AsOfTs)
        : await query.MaxAsync(x => (DateTime?)x.AsOfTs);

    if (!effectiveAsOf.HasValue)
    {
        return Results.Ok(new
        {
            portfolioId = portfolio.PortfolioId,
            name = portfolio.Name,
            status = portfolio.Status,
            createdAt = portfolio.CreatedAt,
            asOf = (DateTime?)null,
            positions = Array.Empty<object>()
        });
    }

    query = query.Where(x => x.AsOfTs == effectiveAsOf.Value);

    var positions = await query
        .OrderBy(x => x.PositionId)
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
        .ToListAsync();

    return Results.Ok(new
    {
        portfolioId = portfolio.PortfolioId,
        name = portfolio.Name,
        status = portfolio.Status,
        createdAt = portfolio.CreatedAt,
        asOf = effectiveAsOf.Value,
        positions
    });
}).WithTags("portfolio");

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

app.MapGet("/api/trade-form-options", async (HelixContext db) =>
{
    var instruments = await db.Instruments
        .AsNoTracking()
        .Where(x => x.Active)
        .Select(x => new
        {
            instrumentId = x.InstrumentId,
            instrumentName = x.InstrumentName,
            assetClass = x.AssetClass,
            currency = x.Currency,
        })
        .ToListAsync();

    var books = await db.Books
        .AsNoTracking()
        .OrderBy(x => x.Name)
        .Select(x => x.Name)
        .ToListAsync();

    var assetClasses = instruments
        .Select(x => x.assetClass)
        .Distinct()
        .OrderBy(x => x switch
        {
            "Equity" => 0,
            "Fixed Income" => 1,
            "Commodity" => 2,
            _ => 99
        })
        .ThenBy(x => x)
        .ToList();

    var orderedInstruments = instruments
        .OrderBy(x => x.assetClass switch
        {
            "Equity" => 0,
            "Fixed Income" => 1,
            "Commodity" => 2,
            _ => 99
        })
        .ThenBy(x => x.instrumentName)
        .ToList();

    return Results.Ok(new
    {
        assetClasses,
        instruments = orderedInstruments,
        books
    });
}).WithTags("trades");

app.MapGet("/api/pnl", async (string portfolioId, DateTime? asOf, HelixContext db) =>
{
    var portfolioExists = await db.Portfolios.AnyAsync(x => x.PortfolioId == portfolioId);
    if (!portfolioExists)
    {
        return Results.NotFound(new { message = $"Portfolio '{portfolioId}' not found." });
    }

    var query = db.PnlSnapshots
        .AsNoTracking()
        .Where(x => x.PortfolioId == portfolioId);

    if (asOf.HasValue)
    {
        query = query.Where(x => x.ValuationTs <= asOf.Value);
    }

    var snapshot = await query
        .OrderByDescending(x => x.ValuationTs)
        .FirstOrDefaultAsync();

    return snapshot is null
        ? Results.Ok(new
        {
            snapshotId = string.Empty,
            portfolioId,
            totalPnl = 0.0,
            realizedPnl = 0.0,
            unrealizedPnl = 0.0,
            valuationTs = string.Empty,
            marketDataAsOfTs = string.Empty,
            positionAsOfTs = string.Empty
        })
        : Results.Ok(new
        {
            snapshotId = snapshot.SnapshotId,
            portfolioId = snapshot.PortfolioId,
            totalPnl = snapshot.TotalPnl,
            realizedPnl = snapshot.RealizedPnl,
            unrealizedPnl = snapshot.UnrealizedPnl,
            valuationTs = snapshot.ValuationTs,
            marketDataAsOfTs = snapshot.MarketDataAsOfTs,
            positionAsOfTs = snapshot.PositionAsOfTs
        });
}).WithTags("analytics");

app.MapGet("/api/risk", async (string portfolioId, DateTime? asOf, HelixContext db) =>
{
    var portfolioExists = await db.Portfolios.AnyAsync(x => x.PortfolioId == portfolioId);
    if (!portfolioExists)
    {
        return Results.NotFound(new { message = $"Portfolio '{portfolioId}' not found." });
    }

    var query = db.RiskSnapshots
        .AsNoTracking()
        .Where(x => x.PortfolioId == portfolioId);

    if (asOf.HasValue)
    {
        query = query.Where(x => x.ValuationTs <= asOf.Value);
    }

    var snapshot = await query
        .OrderByDescending(x => x.ValuationTs)
        .FirstOrDefaultAsync();

    return snapshot is null
        ? Results.Ok(new
        {
            snapshotId = string.Empty,
            portfolioId,
            delta = 0.0,
            gamma = 0.0,
            var95 = 0.0,
            valuationTs = string.Empty,
            marketDataAsOfTs = string.Empty,
            positionAsOfTs = string.Empty
        })
        : Results.Ok(new
        {
            snapshotId = snapshot.SnapshotId,
            portfolioId = snapshot.PortfolioId,
            delta = snapshot.Delta,
            gamma = snapshot.Gamma,
            var95 = snapshot.Var95,
            valuationTs = snapshot.ValuationTs,
            marketDataAsOfTs = snapshot.MarketDataAsOfTs,
            positionAsOfTs = snapshot.PositionAsOfTs
        });
}).WithTags("analytics");

static async Task<InstrumentEntity?> LoadValidInstrumentAsync(
    HelixContext db,
    string instrumentId,
    CancellationToken cancellationToken) =>
    await db.Instruments
        .AsNoTracking()
        .FirstOrDefaultAsync(x => x.InstrumentId == instrumentId && x.Active, cancellationToken);

static async Task<IResult?> ValidateReferenceSelectionsAsync(
    HelixContext db,
    string? book,
    CancellationToken cancellationToken)
{
    if (!string.IsNullOrWhiteSpace(book))
    {
        var bookExists = await db.Books.AnyAsync(x => x.Name == book, cancellationToken);
        if (!bookExists)
        {
            return Results.BadRequest(new { message = $"Book '{book}' does not exist." });
        }
    }

    return null;
}

app.MapPost("/api/trades", async (
    CreateTradeRequest request,
    HelixContext db,
    ITradeCreatedPublisher publisher,
    IPortfolioRecomputeTaskPublisher taskPublisher,
    CancellationToken cancellationToken) =>
{
    var portfolioExists = await db.Portfolios.AnyAsync(x => x.PortfolioId == request.PortfolioId, cancellationToken);
    if (!portfolioExists)
    {
        return Results.BadRequest(new { message = $"Portfolio '{request.PortfolioId}' does not exist." });
    }

    var instrument = await LoadValidInstrumentAsync(db, request.InstrumentId, cancellationToken);
    if (instrument is null)
    {
        return Results.BadRequest(new { message = $"Instrument '{request.InstrumentId}' does not exist." });
    }

    var validationError = await ValidateReferenceSelectionsAsync(
        db, request.Book, cancellationToken);
    if (validationError is not null)
    {
        return validationError;
    }

    var submittedAt = DateTime.UtcNow;
    var tradeId = $"TRD-{request.PortfolioId}-{submittedAt:yyyyMMddHHmmssfff}";
    var positionId = $"{request.PortfolioId}-POS-{submittedAt:yyyyMMddHHmmssfff}";

    var entity = new TradeEntity
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

    db.Trades.Add(entity);
    await db.SaveChangesAsync(cancellationToken);
    await publisher.PublishAsync(tradeId, request.PortfolioId, submittedAt, cancellationToken);
    await taskPublisher.PublishAsync(request.PortfolioId, tradeId, submittedAt, cancellationToken);

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
    ITradeCreatedPublisher publisher,
    IPortfolioRecomputeTaskPublisher taskPublisher,
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

    var instrument = await LoadValidInstrumentAsync(db, request.InstrumentId, cancellationToken);
    if (instrument is null)
    {
        return Results.BadRequest(new { message = $"Instrument '{request.InstrumentId}' does not exist." });
    }

    var validationError = await ValidateReferenceSelectionsAsync(
        db, request.Book, cancellationToken);
    if (validationError is not null)
    {
        return validationError;
    }

    var submittedAt = DateTime.UtcNow;
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

    await db.SaveChangesAsync(cancellationToken);
    await publisher.PublishAsync(tradeId, request.PortfolioId, submittedAt, cancellationToken);
    await taskPublisher.PublishAsync(request.PortfolioId, tradeId, submittedAt, cancellationToken);

    return Results.Ok(new
    {
        tradeId,
        portfolioId = request.PortfolioId,
        positionId = existingTrade.PositionId,
        status = "accepted",
        submittedAt
    });
}).WithTags("trades");

app.Run();

public partial class Program { }

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
