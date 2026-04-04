namespace HelixRest.Messaging.Abstractions;

public interface ITaskQueuePublisher
{
    Task PublishTradeComputeAsync(
        string portfolioId,
        string tradeId,
        DateTime requestedAt,
        CancellationToken cancellationToken);

    Task PublishPositionPlComputeAsync(
        string portfolioId,
        string? sourceEventId,
        DateTime requestedAt,
        CancellationToken cancellationToken);
}
