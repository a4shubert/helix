using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using HelixRest.Data;
using HelixRest.Data.Entities;
using HelixRest.Messaging.Abstractions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Xunit;

public class BasicSmokeTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public BasicSmokeTests(WebApplicationFactory<Program> factory)
    {
        var tempDb = Path.Combine(Path.GetTempPath(), $"helix_rest_test_{Guid.NewGuid():N}.db");
        Environment.SetEnvironmentVariable("HELIX_DB_PATH", tempDb);
        Environment.SetEnvironmentVariable("ASPNETCORE_URLS", "http://localhost:0");

        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.UseSetting("ASPNETCORE_URLS", "http://localhost:0");
            builder.UseEnvironment("Development");
            builder.ConfigureServices(services =>
            {
                services.RemoveAll<ITradeEventPublisher>();
                services.RemoveAll<ITaskQueuePublisher>();
                services.AddSingleton<ITradeEventPublisher, NoOpTradeCreatedPublisher>();
                services.AddSingleton<ITaskQueuePublisher, NoOpPortfolioRecomputeTaskPublisher>();
            });
        });

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HelixContext>();
        db.Database.EnsureCreated();
        db.Portfolios.Add(new PortfolioEntity
        {
            PortfolioId = "PF-TEST",
            Name = "Test Portfolio",
            Status = "active",
            CreatedAt = DateTime.UtcNow
        });
        db.Instruments.Add(new InstrumentEntity
        {
            InstrumentId = "AAPL",
            InstrumentName = "Apple Inc",
            AssetClass = "Equity",
            Currency = "USD",
            Active = true
        });
        db.Books.Add(new BookEntity { Name = "EQ-789" });
        db.SaveChanges();
    }

    [Fact]
    public async Task Swagger_ui_is_available()
    {
        using HttpClient client = _factory.CreateClient();
        var resp = await client.GetAsync("/swagger/index.html");
        resp.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Health_endpoint_returns_ok()
    {
        using HttpClient client = _factory.CreateClient();
        var resp = await client.GetAsync("/health");
        resp.EnsureSuccessStatusCode();
    }

    [Fact]
    public async Task Post_trade_persists_and_returns_accepted()
    {
        using HttpClient client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/trades", new
        {
            portfolioId = "PF-TEST",
            instrumentId = "AAPL",
            side = "BUY",
            quantity = 100.0,
            price = 200.0,
            settlementDate = "2026-03-24",
            book = "EQ-789"
        });

        response.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HelixContext>();
        var trade = Assert.Single(db.Trades.Where(x => x.PortfolioId == "PF-TEST"));
        Assert.Equal("Apple Inc", trade.InstrumentName);
        Assert.Null(trade.Notional);
    }

    [Fact]
    public async Task Portfolio_endpoint_returns_empty_positions_for_latest_flat_snapshot()
    {
        var olderAsOf = DateTime.Parse("2026-03-21T09:00:00Z").ToUniversalTime();
        var newerAsOf = DateTime.Parse("2026-03-21T10:00:00Z").ToUniversalTime();

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HelixContext>();
            db.PositionSnapshots.Add(new PositionSnapshotEntity
            {
                SnapshotId = "POSITION-PF-TEST-POS-AAPL-20260321T090000Z",
                PortfolioId = "PF-TEST",
                PositionId = "PF-TEST-POS-AAPL",
                InstrumentId = "AAPL",
                InstrumentName = "Apple Inc",
                AssetClass = "Equity",
                Currency = "USD",
                Quantity = 1,
                Direction = "LONG",
                AverageCost = 100,
                LastUpdateTs = olderAsOf,
                MarketPrice = 101,
                MarketDataTs = olderAsOf,
                Notional = 100,
                MarketValue = 101,
                Book = "EQ-789",
                AsOfTs = olderAsOf,
                SourceEventId = "TEST-EVENT-OLDER"
            });
            db.PnlSnapshots.Add(new PnlSnapshotEntity
            {
                SnapshotId = "PNL-PF-TEST-20260321T100000Z",
                PortfolioId = "PF-TEST",
                TotalPnl = 0,
                RealizedPnl = 0,
                UnrealizedPnl = 0,
                ValuationTs = newerAsOf,
                MarketDataAsOfTs = newerAsOf,
                PositionAsOfTs = newerAsOf
            });
            db.RiskSnapshots.Add(new RiskSnapshotEntity
            {
                SnapshotId = "RISK-PF-TEST-20260321T100000Z",
                PortfolioId = "PF-TEST",
                Delta = 0,
                GrossExposure = 0,
                NetExposure = 0,
                Var95 = 0,
                ValuationTs = newerAsOf,
                MarketDataAsOfTs = newerAsOf,
                PositionAsOfTs = newerAsOf
            });
            db.SaveChanges();
        }

        using HttpClient client = _factory.CreateClient();
        var payload = await client.GetFromJsonAsync<PortfolioEnvelope>("/api/portfolio?portfolioId=PF-TEST");

        Assert.NotNull(payload);
        Assert.Equal(newerAsOf, DateTime.Parse(payload!.AsOf).ToUniversalTime());
        Assert.Empty(payload.Positions);
    }

    private sealed class PortfolioEnvelope
    {
        public string AsOf { get; set; } = string.Empty;
        public PositionEnvelope[] Positions { get; set; } = Array.Empty<PositionEnvelope>();
    }

    private sealed class PositionEnvelope
    {
        public string PositionId { get; set; } = string.Empty;
    }

    private sealed class NoOpTradeCreatedPublisher : ITradeEventPublisher
    {
        public Task PublishTradeCreatedAsync(string tradeId, string portfolioId, DateTime occurredAt, System.Threading.CancellationToken cancellationToken) =>
            Task.CompletedTask;

        public Task PublishTradeDeletedAsync(string tradeId, string portfolioId, DateTime occurredAt, System.Threading.CancellationToken cancellationToken) =>
            Task.CompletedTask;
    }

    private sealed class NoOpPortfolioRecomputeTaskPublisher : ITaskQueuePublisher
    {
        public Task PublishTradeComputeAsync(
            string portfolioId,
            string tradeId,
            DateTime requestedAt,
            System.Threading.CancellationToken cancellationToken) =>
            Task.CompletedTask;

        public Task PublishPositionPlComputeAsync(
            string portfolioId,
            string? sourceEventId,
            DateTime requestedAt,
            System.Threading.CancellationToken cancellationToken) =>
            Task.CompletedTask;
    }
}
