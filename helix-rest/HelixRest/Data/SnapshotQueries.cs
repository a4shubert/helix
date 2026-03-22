using HelixRest.Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace HelixRest.Data;

public static class SnapshotQueries
{
    public static async Task<List<string>> LoadNumericMetricColumnsAsync(
        HelixContext db,
        string tableName,
        CancellationToken cancellationToken)
    {
        EnsureAllowedSnapshotTable(tableName);
        var metadataColumns = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "snapshot_id",
            "portfolio_id",
            "valuation_ts",
            "market_data_as_of_ts",
            "position_as_of_ts"
        };

        var columns = new List<string>();
        await using var connection = db.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var command = connection.CreateCommand();
        command.CommandText = $"PRAGMA table_info({tableName})";
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var columnName = reader["name"]?.ToString();
            var columnType = reader["type"]?.ToString();
            if (string.IsNullOrWhiteSpace(columnName) || metadataColumns.Contains(columnName))
            {
                continue;
            }

            if (columnType is null)
            {
                continue;
            }

            var normalizedType = columnType.ToUpperInvariant();
            if (normalizedType.Contains("REAL")
                || normalizedType.Contains("NUM")
                || normalizedType.Contains("INT")
                || normalizedType.Contains("FLOAT")
                || normalizedType.Contains("DOUBLE")
                || normalizedType.Contains("DECIMAL"))
            {
                columns.Add(columnName);
            }
        }

        return columns;
    }

    public static async Task<SnapshotRow?> LoadLatestSnapshotRowAsync(
        HelixContext db,
        string tableName,
        string portfolioId,
        DateTime? asOf,
        IReadOnlyCollection<string> metricColumns,
        CancellationToken cancellationToken)
    {
        EnsureAllowedSnapshotTable(tableName);
        await using var connection = db.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var command = connection.CreateCommand();
        command.CommandText = $"""
            SELECT *
            FROM {tableName}
            WHERE portfolio_id = @portfolioId
              AND (@asOf IS NULL OR valuation_ts <= @asOf)
            ORDER BY valuation_ts DESC
            LIMIT 1
            """;

        var portfolioParameter = command.CreateParameter();
        portfolioParameter.ParameterName = "@portfolioId";
        portfolioParameter.Value = portfolioId;
        command.Parameters.Add(portfolioParameter);

        var asOfParameter = command.CreateParameter();
        asOfParameter.ParameterName = "@asOf";
        asOfParameter.Value = asOf?.ToUniversalTime().ToString("O").Replace("+00:00", "Z") ?? (object)DBNull.Value;
        command.Parameters.Add(asOfParameter);

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            return null;
        }

        var values = metricColumns.ToDictionary(column => column, _ => 0.0, StringComparer.OrdinalIgnoreCase);
        foreach (var column in metricColumns)
        {
            var raw = reader[column];
            if (raw is DBNull)
            {
                continue;
            }

            values[column] = RoundToTwoDecimals(Convert.ToDouble(raw));
        }

        return new SnapshotRow(
            SnapshotId: reader["snapshot_id"]?.ToString() ?? string.Empty,
            PortfolioId: reader["portfolio_id"]?.ToString() ?? portfolioId,
            ValuationTs: reader["valuation_ts"]?.ToString() ?? string.Empty,
            MarketDataAsOfTs: reader["market_data_as_of_ts"]?.ToString() ?? string.Empty,
            PositionAsOfTs: reader["position_as_of_ts"]?.ToString() ?? string.Empty,
            MetricValues: values
        );
    }

    public static async Task<PositionSnapshotQueryResult> LoadLatestPositionSnapshotAsync(
        HelixContext db,
        string portfolioId,
        DateTime? asOf,
        CancellationToken cancellationToken)
    {
        await using var connection = db.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        string? effectiveAsOf;
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                WITH candidate_asofs AS (
                    SELECT as_of_ts AS effective_as_of
                    FROM position
                    WHERE portfolio_id = @portfolioId
                      AND (@asOf IS NULL OR as_of_ts <= @asOf)

                    UNION ALL

                    SELECT position_as_of_ts AS effective_as_of
                    FROM pnl
                    WHERE portfolio_id = @portfolioId
                      AND (@asOf IS NULL OR position_as_of_ts <= @asOf)

                    UNION ALL

                    SELECT position_as_of_ts AS effective_as_of
                    FROM risk
                    WHERE portfolio_id = @portfolioId
                      AND (@asOf IS NULL OR position_as_of_ts <= @asOf)
                )
                SELECT MAX(effective_as_of)
                FROM candidate_asofs
                """;

            var portfolioParameter = command.CreateParameter();
            portfolioParameter.ParameterName = "@portfolioId";
            portfolioParameter.Value = portfolioId;
            command.Parameters.Add(portfolioParameter);

            var asOfParameter = command.CreateParameter();
            asOfParameter.ParameterName = "@asOf";
            asOfParameter.Value = asOf?.ToUniversalTime().ToString("O").Replace("+00:00", "Z") ?? (object)DBNull.Value;
            command.Parameters.Add(asOfParameter);

            var scalar = await command.ExecuteScalarAsync(cancellationToken);
            effectiveAsOf = scalar is null || scalar is DBNull ? null : scalar.ToString();
        }

        if (string.IsNullOrWhiteSpace(effectiveAsOf))
        {
            return new PositionSnapshotQueryResult(null, []);
        }

        var rows = new List<PositionSnapshotRow>();
        await using (var command = connection.CreateCommand())
        {
            command.CommandText = """
                SELECT position_id, instrument_id, instrument_name, asset_class, currency,
                       quantity, direction, average_cost, last_update_ts, market_price,
                       market_data_ts, notional, market_value, book
                FROM position
                WHERE portfolio_id = @portfolioId
                  AND as_of_ts = @asOf
                ORDER BY last_update_ts DESC, position_id
                """;

            var portfolioParameter = command.CreateParameter();
            portfolioParameter.ParameterName = "@portfolioId";
            portfolioParameter.Value = portfolioId;
            command.Parameters.Add(portfolioParameter);

            var asOfParameter = command.CreateParameter();
            asOfParameter.ParameterName = "@asOf";
            asOfParameter.Value = effectiveAsOf;
            command.Parameters.Add(asOfParameter);

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            while (await reader.ReadAsync(cancellationToken))
            {
                rows.Add(new PositionSnapshotRow(
                    PositionId: reader["position_id"]?.ToString() ?? string.Empty,
                    InstrumentId: reader["instrument_id"]?.ToString() ?? string.Empty,
                    InstrumentName: reader["instrument_name"]?.ToString() ?? string.Empty,
                    AssetClass: reader["asset_class"]?.ToString() ?? string.Empty,
                    Currency: reader["currency"]?.ToString() ?? string.Empty,
                    Quantity: reader["quantity"] is DBNull ? 0.0 : Convert.ToDouble(reader["quantity"]),
                    Direction: reader["direction"]?.ToString() ?? "LONG",
                    AverageCost: reader["average_cost"] is DBNull ? 0.0 : Convert.ToDouble(reader["average_cost"]),
                    LastUpdateTs: reader["last_update_ts"]?.ToString() ?? string.Empty,
                    MarketPrice: reader["market_price"] is DBNull ? null : Convert.ToDouble(reader["market_price"]),
                    MarketDataTs: reader["market_data_ts"]?.ToString(),
                    Notional: reader["notional"] is DBNull ? null : Convert.ToDouble(reader["notional"]),
                    MarketValue: reader["market_value"] is DBNull ? null : Convert.ToDouble(reader["market_value"]),
                    Book: reader["book"]?.ToString()
                ));
            }
        }

        return new PositionSnapshotQueryResult(effectiveAsOf, rows);
    }

    public static async Task<List<MarketDataRow>> LoadLatestMarketDataRowsAsync(
        HelixContext db,
        CancellationToken cancellationToken)
    {
        var rows = new List<MarketDataRow>();
        await using var connection = db.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
        {
            await connection.OpenAsync(cancellationToken);
        }

        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT i.instrument_id, i.instrument_name, i.asset_class, i.currency,
                   m.price, m.volatility, m.updated_at
            FROM instrument i
            LEFT JOIN market_data m ON m.instrument_id = i.instrument_id
            WHERE i.active = 1
            ORDER BY i.asset_class, i.instrument_id
            """;

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            rows.Add(new MarketDataRow(
                InstrumentId: reader["instrument_id"]?.ToString() ?? string.Empty,
                InstrumentName: reader["instrument_name"]?.ToString() ?? string.Empty,
                AssetClass: reader["asset_class"]?.ToString() ?? string.Empty,
                Currency: reader["currency"]?.ToString() ?? string.Empty,
                Price: reader["price"] is DBNull ? null : Convert.ToDouble(reader["price"]),
                Volatility: reader["volatility"] is DBNull ? null : Convert.ToDouble(reader["volatility"]),
                UpdatedAt: reader["updated_at"]?.ToString()
            ));
        }

        return rows;
    }

    public static async Task<InstrumentEntity?> LoadValidInstrumentAsync(
        HelixContext db,
        string instrumentId,
        CancellationToken cancellationToken) =>
        await db.Instruments
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.InstrumentId == instrumentId && x.Active, cancellationToken);

    public static async Task<IResult?> ValidateReferenceSelectionsAsync(
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

    public static double RoundToTwoDecimals(double value) =>
        Math.Round(value, 2, MidpointRounding.AwayFromZero);

    public static string ToMetricLabel(string metricKey)
    {
        var words = metricKey
            .Split('_', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(word => word.ToUpperInvariant() switch
            {
                "PNL" => "P&L",
                "VAR" => "VaR",
                _ => char.ToUpperInvariant(word[0]) + word[1..].ToLowerInvariant()
            });
        return string.Join(" ", words);
    }

    private static void EnsureAllowedSnapshotTable(string tableName)
    {
        if (!string.Equals(tableName, "pnl", StringComparison.OrdinalIgnoreCase)
            && !string.Equals(tableName, "risk", StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException($"Unsupported snapshot table '{tableName}'.");
        }
    }
}

public sealed record SnapshotRow(
    string SnapshotId,
    string PortfolioId,
    string ValuationTs,
    string MarketDataAsOfTs,
    string PositionAsOfTs,
    Dictionary<string, double> MetricValues
);

public sealed record PositionSnapshotQueryResult(
    string? EffectiveAsOf,
    IReadOnlyList<PositionSnapshotRow> Rows
);

public sealed record PositionSnapshotRow(
    string PositionId,
    string InstrumentId,
    string InstrumentName,
    string AssetClass,
    string Currency,
    double Quantity,
    string Direction,
    double AverageCost,
    string LastUpdateTs,
    double? MarketPrice,
    string? MarketDataTs,
    double? Notional,
    double? MarketValue,
    string? Book
);

public sealed record MarketDataRow(
    string InstrumentId,
    string InstrumentName,
    string AssetClass,
    string Currency,
    double? Price,
    double? Volatility,
    string? UpdatedAt
);
