using HelixRest.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

public class HelixContextFactory : IDesignTimeDbContextFactory<HelixContext>
{
    public HelixContext CreateDbContext(string[] args)
    {
        var envPath = Environment.GetEnvironmentVariable("HELIX_DB_PATH");
        string dbPath;
        if (!string.IsNullOrWhiteSpace(envPath))
        {
            dbPath = envPath;
        }
        else
        {
            var basePath = Directory.GetCurrentDirectory();
            dbPath = Path.GetFullPath(Path.Combine(basePath, "..", "..", "helix-store", "helix.db"));
        }

        Directory.CreateDirectory(Path.GetDirectoryName(dbPath)!);

        var options = new DbContextOptionsBuilder<HelixContext>()
            .UseSqlite($"Data Source={dbPath}")
            .Options;

        return new HelixContext(options);
    }
}
