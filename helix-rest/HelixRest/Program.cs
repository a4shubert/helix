using HelixRest.Data;
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

builder.Services.AddDbContext<HelixContext>(options => options.UseSqlite(connString));

builder.Logging.AddFilter("Microsoft.EntityFrameworkCore", LogLevel.Warning);
builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Database.Command", LogLevel.Warning);
builder.Logging.AddFilter("Microsoft.EntityFrameworkCore.Database.Transaction", LogLevel.Warning);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.Use(async (context, next) =>
{
    Console.WriteLine($"[HelixRest] {context.Request.Method} {context.Request.Path}{context.Request.QueryString}");
    await next.Invoke();
});

app.UseSwagger();

app.MapGet("/", () => Results.Redirect("/swagger")).ExcludeFromDescription();
app.MapGet("/swagger", () => Results.Redirect("/swagger/index.html")).ExcludeFromDescription();
app.MapGet("/swagger/", () => Results.Redirect("/swagger/index.html")).ExcludeFromDescription();
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
        database = canConnect ? "working" : "unreachable",
    });
}).WithTags("system");

app.Run();

public partial class Program { }
