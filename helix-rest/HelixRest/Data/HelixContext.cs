using Microsoft.EntityFrameworkCore;

namespace HelixRest.Data;

public class HelixContext : DbContext
{
    public HelixContext(DbContextOptions<HelixContext> options) : base(options) { }
}
