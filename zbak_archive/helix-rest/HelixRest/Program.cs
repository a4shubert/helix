using HelixRest.Data;
using HelixRest.Endpoints;
using HelixRest.Messaging;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
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

var helixWebUrl = Environment.GetEnvironmentVariable("HELIX_WEB_URL") ?? "http://localhost:3000";
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
builder.Services.AddHelixMessaging(builder.Configuration);

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

app.MapSystemEndpoints();
app.MapPortfolioEndpoints();
app.MapAnalyticsEndpoints();
app.MapTradeEndpoints();

app.Run();

public partial class Program { }
