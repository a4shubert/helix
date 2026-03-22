namespace HelixRest.Messaging.Abstractions;

public interface ITaskQueuePublisher
{
    Task PublishPortfolioRecomputeAsync(
        string portfolioId,
        string? sourceEventId,
        DateTime requestedAt,
        CancellationToken cancellationToken);

    Task PublishTradeComputeAsync(
        string portfolioId,
        string tradeId,
        DateTime requestedAt,
        CancellationToken cancellationToken);
}
