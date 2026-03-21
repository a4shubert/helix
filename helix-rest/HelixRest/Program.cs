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
builder.Services.AddSingleton<UpdateStreamBroadcaster>();
builder.Services.AddSingleton<ITradeCreatedPublisher, KafkaTradeCreatedPublisher>();
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

    if (asOf.HasValue)
    {
        query = query.Where(x => x.AsOfTs <= asOf.Value);
    }

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
            contractMultiplier = x.ContractMultiplier,
            tradeDate = x.TradeDate,
            lastUpdateTs = x.LastUpdateTs,
            marketPrice = x.MarketPrice,
            marketDataTs = x.MarketDataTs,
            fxRate = x.FxRate,
            notional = x.Notional,
            marketValue = x.MarketValue,
            sector = x.Sector,
            region = x.Region,
            strategy = x.Strategy,
            desk = x.Desk
        })
        .ToListAsync();

    return Results.Ok(new
    {
        portfolioId = portfolio.PortfolioId,
        name = portfolio.Name,
        status = portfolio.Status,
        createdAt = portfolio.CreatedAt,
        asOf = positions.MaxBy(x => x.lastUpdateTs)?.lastUpdateTs,
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
            contractMultiplier = x.ContractMultiplier,
            notional = x.Notional,
            tradeTimestamp = x.TradeTimestamp,
            settlementDate = x.SettlementDate,
            strategy = x.Strategy,
            book = x.Book,
            desk = x.Desk,
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

app.MapGet("/api/pnl", async (string portfolioId, DateTime? asOf, HelixContext db) =>
{
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
        ? Results.NotFound(new { message = $"No P&L snapshot found for '{portfolioId}'." })
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
        ? Results.NotFound(new { message = $"No risk snapshot found for '{portfolioId}'." })
        : Results.Ok(new
        {
            snapshotId = snapshot.SnapshotId,
            portfolioId = snapshot.PortfolioId,
            delta = snapshot.Delta,
            gamma = snapshot.Gamma,
            var95 = snapshot.Var95,
            stressLoss = snapshot.StressLoss,
            valuationTs = snapshot.ValuationTs,
            marketDataAsOfTs = snapshot.MarketDataAsOfTs,
            positionAsOfTs = snapshot.PositionAsOfTs
        });
}).WithTags("analytics");

app.MapPost("/api/trades", async (
    CreateTradeRequest request,
    HelixContext db,
    ITradeCreatedPublisher publisher,
    CancellationToken cancellationToken) =>
{
    var portfolioExists = await db.Portfolios.AnyAsync(x => x.PortfolioId == request.PortfolioId);
    if (!portfolioExists)
    {
        return Results.BadRequest(new { message = $"Portfolio '{request.PortfolioId}' does not exist." });
    }

    var submittedAt = DateTime.UtcNow;
    var tradeId = string.IsNullOrWhiteSpace(request.TradeId)
        ? $"TRD-{request.PortfolioId}-{submittedAt:yyyyMMddHHmmssfff}"
        : request.TradeId;
    var contractMultiplier = request.ContractMultiplier ?? 1.0;
    var notional = request.Quantity * request.Price * contractMultiplier;

    var entity = new TradeEntity
    {
        TradeId = tradeId,
        PortfolioId = request.PortfolioId,
        PositionId = string.IsNullOrWhiteSpace(request.PositionId)
            ? $"{request.PortfolioId}-POS-{submittedAt:yyyyMMddHHmmss}"
            : request.PositionId,
        InstrumentId = request.InstrumentId,
        InstrumentName = request.InstrumentName,
        AssetClass = request.AssetClass,
        Currency = request.Currency,
        Side = request.Side,
        Quantity = request.Quantity,
        Price = request.Price,
        ContractMultiplier = contractMultiplier,
        Notional = notional,
        TradeTimestamp = request.TradeTimestamp ?? submittedAt,
        SettlementDate = request.SettlementDate,
        Strategy = request.Strategy,
        Book = request.Book,
        Desk = request.Desk,
        Status = "accepted",
        Version = request.Version ?? 1,
        CreatedAt = submittedAt,
        UpdatedAt = submittedAt
    };

    db.Trades.Add(entity);
    await db.SaveChangesAsync(cancellationToken);
    await publisher.PublishAsync(tradeId, request.PortfolioId, submittedAt, cancellationToken);

    return Results.Ok(new
    {
        tradeId,
        portfolioId = request.PortfolioId,
        positionId = entity.PositionId,
        status = "accepted",
        submittedAt
    });
}).WithTags("trades");

app.Run();

public partial class Program { }

public sealed record CreateTradeRequest(
    string? TradeId,
    string PortfolioId,
    string? PositionId,
    string InstrumentId,
    string InstrumentName,
    string AssetClass,
    string Currency,
    string Side,
    double Quantity,
    double Price,
    double? ContractMultiplier,
    DateTime? TradeTimestamp,
    DateOnly? SettlementDate,
    string? Strategy,
    string? Book,
    string? Desk,
    int? Version
);
