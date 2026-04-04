using System;
using System.Collections.Generic;
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
    private readonly RecordingTradeEventPublisher _tradeEventPublisher;
    private readonly RecordingTaskQueuePublisher _taskQueuePublisher;

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
                services.AddSingleton<RecordingTradeEventPublisher>();
                services.AddSingleton<RecordingTaskQueuePublisher>();
                services.AddSingleton<ITradeEventPublisher>(sp => sp.GetRequiredService<RecordingTradeEventPublisher>());
                services.AddSingleton<ITaskQueuePublisher>(sp => sp.GetRequiredService<RecordingTaskQueuePublisher>());
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

        _tradeEventPublisher = _factory.Services.GetRequiredService<RecordingTradeEventPublisher>();
        _taskQueuePublisher = _factory.Services.GetRequiredService<RecordingTaskQueuePublisher>();
        ResetRecorders();
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
        ResetRecorders();
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
        Assert.Contains(_tradeEventPublisher.Events, x => x.EventType == "created" && x.TradeId == trade.TradeId);
        Assert.Contains(_taskQueuePublisher.Calls, x => x.Kind == "position.pl.compute" && x.PortfolioId == "PF-TEST" && x.SourceEventId == trade.TradeId);
        Assert.Contains(_taskQueuePublisher.Calls, x => x.Kind == "trade.compute" && x.PortfolioId == "PF-TEST" && x.TradeId == trade.TradeId);
    }

    [Fact]
    public async Task Put_trade_amends_and_publishes_trade_updated_plus_recompute_tasks()
    {
        ResetRecorders();
        using HttpClient client = _factory.CreateClient();
        var createResponse = await client.PostAsJsonAsync("/api/trades", new
        {
            portfolioId = "PF-TEST",
            instrumentId = "AAPL",
            side = "BUY",
            quantity = 100.0,
            price = 200.0,
            settlementDate = "2026-03-24",
            book = "EQ-789"
        });
        createResponse.EnsureSuccessStatusCode();

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HelixContext>();
            var trade = Assert.Single(db.Trades.Where(x => x.PortfolioId == "PF-TEST"));
            ResetRecorders();

            var amendResponse = await client.PutAsJsonAsync($"/api/trades/{trade.TradeId}", new
            {
                portfolioId = "PF-TEST",
                instrumentId = "AAPL",
                side = "SELL",
                quantity = 85.0,
                price = 210.0,
                settlementDate = "2026-03-24",
                book = "EQ-789",
                version = 2
            });
            amendResponse.EnsureSuccessStatusCode();
        }

        using var amendScope = _factory.Services.CreateScope();
        var amendDb = amendScope.ServiceProvider.GetRequiredService<HelixContext>();
        var amendedTrade = Assert.Single(amendDb.Trades.Where(x => x.PortfolioId == "PF-TEST"));
        Assert.Equal("SELL", amendedTrade.Side);
        Assert.Equal(85.0, amendedTrade.Quantity);
        Assert.Equal(210.0, amendedTrade.Price);
        Assert.Equal(2, amendedTrade.Version);
        Assert.Contains(_tradeEventPublisher.Events, x => x.EventType == "updated" && x.TradeId == amendedTrade.TradeId);
        Assert.DoesNotContain(_tradeEventPublisher.Events, x => x.EventType == "created");
        Assert.Contains(_taskQueuePublisher.Calls, x => x.Kind == "position.pl.compute" && x.PortfolioId == "PF-TEST" && x.SourceEventId == amendedTrade.TradeId);
        Assert.Contains(_taskQueuePublisher.Calls, x => x.Kind == "trade.compute" && x.PortfolioId == "PF-TEST" && x.TradeId == amendedTrade.TradeId);
    }

    [Fact]
    public async Task Delete_trade_removes_trade_and_publishes_trade_deleted_plus_position_recompute()
    {
        ResetRecorders();
        using HttpClient client = _factory.CreateClient();
        var createResponse = await client.PostAsJsonAsync("/api/trades", new
        {
            portfolioId = "PF-TEST",
            instrumentId = "AAPL",
            side = "BUY",
            quantity = 100.0,
            price = 200.0,
            settlementDate = "2026-03-24",
            book = "EQ-789"
        });
        createResponse.EnsureSuccessStatusCode();

        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<HelixContext>();
            var trade = Assert.Single(db.Trades.Where(x => x.PortfolioId == "PF-TEST"));
            ResetRecorders();

            var deleteResponse = await client.DeleteAsync($"/api/trades/{trade.TradeId}");
            deleteResponse.EnsureSuccessStatusCode();
        }

        using var deleteScope = _factory.Services.CreateScope();
        var deleteDb = deleteScope.ServiceProvider.GetRequiredService<HelixContext>();
        Assert.Empty(deleteDb.Trades.Where(x => x.PortfolioId == "PF-TEST"));
        Assert.Contains(_tradeEventPublisher.Events, x => x.EventType == "deleted" && x.PortfolioId == "PF-TEST");
        Assert.Contains(_taskQueuePublisher.Calls, x => x.Kind == "position.pl.compute" && x.PortfolioId == "PF-TEST" && x.SourceEventId is null);
        Assert.DoesNotContain(_taskQueuePublisher.Calls, x => x.Kind == "trade.compute");
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

    private void ResetRecorders()
    {
        _tradeEventPublisher.Clear();
        _taskQueuePublisher.Clear();
    }

    private sealed record TradeEventRecord(string EventType, string TradeId, string PortfolioId);
    private sealed record TaskQueueCall(string Kind, string PortfolioId, string? TradeId, string? SourceEventId);

    private sealed class RecordingTradeEventPublisher : ITradeEventPublisher
    {
        private readonly List<TradeEventRecord> _events = [];

        public IReadOnlyList<TradeEventRecord> Events => _events;

        public void Clear() => _events.Clear();

        public Task PublishTradeCreatedAsync(string tradeId, string portfolioId, DateTime occurredAt, System.Threading.CancellationToken cancellationToken)
        {
            _events.Add(new TradeEventRecord("created", tradeId, portfolioId));
            return Task.CompletedTask;
        }

        public Task PublishTradeUpdatedAsync(string tradeId, string portfolioId, DateTime occurredAt, System.Threading.CancellationToken cancellationToken)
        {
            _events.Add(new TradeEventRecord("updated", tradeId, portfolioId));
            return Task.CompletedTask;
        }

        public Task PublishTradeDeletedAsync(string tradeId, string portfolioId, DateTime occurredAt, System.Threading.CancellationToken cancellationToken)
        {
            _events.Add(new TradeEventRecord("deleted", tradeId, portfolioId));
            return Task.CompletedTask;
        }
    }

    private sealed class RecordingTaskQueuePublisher : ITaskQueuePublisher
    {
        private readonly List<TaskQueueCall> _calls = [];

        public IReadOnlyList<TaskQueueCall> Calls => _calls;

        public void Clear() => _calls.Clear();

        public Task PublishTradeComputeAsync(
            string portfolioId,
            string tradeId,
            DateTime requestedAt,
            System.Threading.CancellationToken cancellationToken)
        {
            _calls.Add(new TaskQueueCall("trade.compute", portfolioId, tradeId, tradeId));
            return Task.CompletedTask;
        }

        public Task PublishPositionPlComputeAsync(
            string portfolioId,
            string? sourceEventId,
            DateTime requestedAt,
            System.Threading.CancellationToken cancellationToken)
        {
            _calls.Add(new TaskQueueCall("position.pl.compute", portfolioId, null, sourceEventId));
            return Task.CompletedTask;
        }
    }
}
