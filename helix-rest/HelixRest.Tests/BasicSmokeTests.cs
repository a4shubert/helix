using System;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;
using HelixRest.Data;
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
}
