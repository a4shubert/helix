using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading.Channels;

namespace HelixRest.Messaging.Streaming;

public sealed record PortfolioUpdateMessage(
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

public sealed class PortfolioUpdateBroadcaster
{
    private readonly ConcurrentDictionary<Guid, Subscription> _subscriptions = new();

    public PortfolioUpdateSubscription Subscribe(string? portfolioId)
    {
        var id = Guid.NewGuid();
        var subscription = new Subscription(
            id,
            portfolioId,
            Channel.CreateUnbounded<PortfolioUpdateMessage>());
        _subscriptions[id] = subscription;
        return new PortfolioUpdateSubscription(
            subscription.Channel.Reader,
            () => _subscriptions.TryRemove(id, out _));
    }

    public ValueTask PublishAsync(PortfolioUpdateMessage message)
    {
        foreach (var subscription in _subscriptions.Values)
        {
            if (!string.IsNullOrWhiteSpace(subscription.PortfolioId)
                && !string.Equals(subscription.PortfolioId, message.PortfolioId, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            subscription.Channel.Writer.TryWrite(message);
        }

        return ValueTask.CompletedTask;
    }

    private sealed record Subscription(Guid Id, string? PortfolioId, Channel<PortfolioUpdateMessage> Channel);
}

public sealed class PortfolioUpdateSubscription : IAsyncDisposable
{
    private readonly Action _dispose;

    public PortfolioUpdateSubscription(ChannelReader<PortfolioUpdateMessage> reader, Action dispose)
    {
        Reader = reader;
        _dispose = dispose;
    }

    public ChannelReader<PortfolioUpdateMessage> Reader { get; }

    public ValueTask DisposeAsync()
    {
        _dispose();
        return ValueTask.CompletedTask;
    }
}
