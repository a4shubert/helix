using HelixRest.Data;
using HelixRest.Messaging.Streaming;

namespace HelixRest.Endpoints;

public static class SystemEndpoints
{
    public static WebApplication MapSystemEndpoints(this WebApplication app)
    {
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
            PortfolioUpdateBroadcaster broadcaster,
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

        return app;
    }
}
