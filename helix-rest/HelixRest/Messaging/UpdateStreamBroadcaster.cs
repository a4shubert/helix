using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading.Channels;

namespace HelixRest.Messaging;

public sealed record PortfolioUpdateNotification(
    string EventType,
    string PortfolioId,
    string SnapshotId,
    string Timestamp)
{
    public string ToJson() => JsonSerializer.Serialize(new
    {
        eventType = EventType,
        portfolioId = PortfolioId,
        snapshotId = SnapshotId,
        timestamp = Timestamp
    });
}

public sealed class UpdateStreamBroadcaster
{
    private readonly ConcurrentDictionary<Guid, Subscription> _subscriptions = new();

    public UpdateSubscription Subscribe(string? portfolioId)
    {
        var id = Guid.NewGuid();
        var subscription = new Subscription(
            id,
            portfolioId,
            Channel.CreateUnbounded<PortfolioUpdateNotification>());
        _subscriptions[id] = subscription;
        return new UpdateSubscription(subscription.Channel.Reader, () => _subscriptions.TryRemove(id, out _));
    }

    public ValueTask PublishAsync(PortfolioUpdateNotification notification)
    {
        foreach (var subscription in _subscriptions.Values)
        {
            if (!string.IsNullOrWhiteSpace(subscription.PortfolioId)
                && !string.Equals(subscription.PortfolioId, notification.PortfolioId, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            subscription.Channel.Writer.TryWrite(notification);
        }

        return ValueTask.CompletedTask;
    }

    private sealed record Subscription(Guid Id, string? PortfolioId, Channel<PortfolioUpdateNotification> Channel);
}

public sealed class UpdateSubscription : IAsyncDisposable
{
    private readonly Action _dispose;

    public UpdateSubscription(ChannelReader<PortfolioUpdateNotification> reader, Action dispose)
    {
        Reader = reader;
        _dispose = dispose;
    }

    public ChannelReader<PortfolioUpdateNotification> Reader { get; }

    public ValueTask DisposeAsync()
    {
        _dispose();
        return ValueTask.CompletedTask;
    }
}
