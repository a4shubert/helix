"""Simple publisher implementations for runtime orchestration."""

from __future__ import annotations


class InMemoryEventPublisher:
    """Collect published events in memory for tests and local verification."""

    def __init__(self) -> None:
        self.published: list[tuple[str, dict[str, object]]] = []

    def publish(self, topic: str, payload: dict[str, object]) -> None:
        self.published.append((topic, payload))


class LoggingEventPublisher:
    """Emit publication boundaries to stdout for local development."""

    def publish(self, topic: str, payload: dict[str, object]) -> None:
        print(f"[helix-runtime] publish {topic}: {payload}")
