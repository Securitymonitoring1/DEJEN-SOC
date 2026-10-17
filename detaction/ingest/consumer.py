"""
Consumes raw security events from Redpanda (Kafka-API compatible).
Person 1's agents/syslog collectors publish here.
"""
import json
import logging
from typing import Callable, Iterator, Optional

logger = logging.getLogger(__name__)

DEFAULT_TOPIC = "raw-security-events"


class RedpandaConsumer:
    """
    Thin wrapper around kafka-python's KafkaConsumer, pointed at Redpanda.
    Redpanda speaks the Kafka wire protocol, so any Kafka client library works.
    """

    def __init__(
        self,
        bootstrap_servers: str = "localhost:9092",
        topic: str = DEFAULT_TOPIC,
        group_id: str = "ingest-service",
        auto_offset_reset: str = "earliest",
    ):
        self.bootstrap_servers = bootstrap_servers
        self.topic = topic
        self.group_id = group_id
        self.auto_offset_reset = auto_offset_reset
        self._consumer = None

    def connect(self):
        from kafka import KafkaConsumer  # lazy import so this module is testable without the dep

        self._consumer = KafkaConsumer(
            self.topic,
            bootstrap_servers=self.bootstrap_servers,
            group_id=self.group_id,
            auto_offset_reset=self.auto_offset_reset,
            enable_auto_commit=True,
            value_deserializer=lambda v: json.loads(v.decode("utf-8")),
        )
        logger.info("Connected to Redpanda at %s, topic=%s", self.bootstrap_servers, self.topic)
        return self

    def poll_forever(self, handler: Callable[[dict], None]):
        """Blocking loop: calls handler(raw_event_dict) for every message."""
        if self._consumer is None:
            self.connect()
        for message in self._consumer:
            try:
                handler(message.value)
            except Exception:
                logger.exception("Failed to handle message at offset %s", message.offset)

    def close(self):
        if self._consumer is not None:
            self._consumer.close()


class MockConsumer:
    """
    Drop-in replacement for RedpandaConsumer that reads from an in-memory list.
    Use this for local development/tests before Redpanda is wired up, or before
    Person 1's agent is producing real events.
    """

    def __init__(self, events: Optional[list] = None):
        self.events = events or []

    def poll_forever(self, handler: Callable[[dict], None]):
        for event in self.events:
            handler(event)

    def iter_events(self) -> Iterator[dict]:
        yield from self.events
