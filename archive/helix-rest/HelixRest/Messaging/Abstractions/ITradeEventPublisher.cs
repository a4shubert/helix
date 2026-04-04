namespace HelixRest.Messaging.Abstractions;

public interface ITradeEventPublisher
{
    Task PublishTradeCreatedAsync(
        string tradeId,
        string portfolioId,
        DateTime occurredAt,
        CancellationToken cancellationToken);

    Task PublishTradeUpdatedAsync(
        string tradeId,
        string portfolioId,
        DateTime occurredAt,
        CancellationToken cancellationToken);

    Task PublishTradeDeletedAsync(
        string tradeId,
        string portfolioId,
        DateTime occurredAt,
        CancellationToken cancellationToken);
}
