using System;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading.Tasks;
using HelixRest.Data;
using HelixRest.Data.Entities;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
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
        db.Books.Add(new BookEntity { Name = "Equity" });
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
            book = "Equity"
        });

        response.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<HelixContext>();
        var trade = Assert.Single(db.Trades.Where(x => x.PortfolioId == "PF-TEST"));
        Assert.Equal("Apple Inc", trade.InstrumentName);
        Assert.Null(trade.Notional);
    }
}
