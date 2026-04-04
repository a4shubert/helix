namespace HelixRest.Data.Entities;

public class InstrumentEntity
{
    public required string InstrumentId { get; set; }
    public required string InstrumentName { get; set; }
    public required string AssetClass { get; set; }
    public required string Currency { get; set; }
    public bool Active { get; set; }
}
