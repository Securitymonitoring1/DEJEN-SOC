import json
import logging
import os
import time
from dataclasses import dataclass
from typing import Any

from collectors.common.events import validate_event


logger = logging.getLogger(__name__)
SECURITY_PROTOCOLS = {"PLAINTEXT", "SSL", "SASL_PLAINTEXT", "SASL_SSL"}


class DeliveryError(RuntimeError):
    pass


@dataclass(frozen=True)
class ProducerConfig:
    brokers: tuple[str, ...] = ("localhost:9092",)
    topic: str = "dejen-security-events"
    timeout_seconds: float = 10
    retries: int = 3
    retry_backoff_seconds: float = 0.25
    security_protocol: str = "PLAINTEXT"
    sasl_mechanism: str | None = None
    sasl_username: str | None = None
    sasl_password: str | None = None
    ssl_cafile: str | None = None
    ssl_certfile: str | None = None
    ssl_keyfile: str | None = None

    def __post_init__(self) -> None:
        if not self.brokers or any(not broker.strip() for broker in self.brokers):
            raise ValueError("at least one Redpanda broker is required")
        if not self.topic.strip():
            raise ValueError("Redpanda topic must not be empty")
        if self.timeout_seconds <= 0 or self.retries < 0 or self.retry_backoff_seconds < 0:
            raise ValueError("timeout must be positive and retry settings cannot be negative")
        protocol = self.security_protocol.upper()
        if protocol not in SECURITY_PROTOCOLS:
            raise ValueError(f"unsupported security protocol: {self.security_protocol}")
        if protocol.startswith("SASL_") and not all(
            (self.sasl_mechanism, self.sasl_username, self.sasl_password)
        ):
            raise ValueError("SASL requires a mechanism, username, and password")
        if bool(self.ssl_certfile) != bool(self.ssl_keyfile):
            raise ValueError("SSL client certificate and key must be configured together")

    @classmethod
    def from_environment(cls) -> "ProducerConfig":
        brokers = tuple(
            item.strip()
            for item in os.getenv("REDPANDA_BROKERS", "localhost:9092").split(",")
            if item.strip()
        )
        return cls(
            brokers=brokers,
            topic=os.getenv("REDPANDA_TOPIC", "dejen-security-events").strip(),
            timeout_seconds=float(os.getenv("REDPANDA_TIMEOUT_SECONDS", "10")),
            retries=int(os.getenv("REDPANDA_RETRIES", "3")),
            retry_backoff_seconds=float(os.getenv("REDPANDA_RETRY_BACKOFF_SECONDS", "0.25")),
            security_protocol=os.getenv("REDPANDA_SECURITY_PROTOCOL", "PLAINTEXT").upper(),
            sasl_mechanism=os.getenv("REDPANDA_SASL_MECHANISM") or None,
            sasl_username=os.getenv("REDPANDA_SASL_USERNAME") or None,
            sasl_password=os.getenv("REDPANDA_SASL_PASSWORD") or None,
            ssl_cafile=os.getenv("REDPANDA_SSL_CAFILE") or None,
            ssl_certfile=os.getenv("REDPANDA_SSL_CERTFILE") or None,
            ssl_keyfile=os.getenv("REDPANDA_SSL_KEYFILE") or None,
        )


class KafkaEventProducer:
    def __init__(
        self,
        config: ProducerConfig | None = None,
        *,
        producer: Any = None,
        sleep=time.sleep,
    ) -> None:
        self.config = config or ProducerConfig.from_environment()
        self._producer = producer if producer is not None else self._create_producer()
        self._sleep = sleep

    def _create_producer(self) -> Any:
        try:
            from kafka import KafkaProducer
        except ImportError as error:
            raise RuntimeError("Install kafka-python to publish to Redpanda") from error

        settings: dict[str, Any] = {
            "bootstrap_servers": list(self.config.brokers),
            "acks": "all",
            "retries": 0,
            "request_timeout_ms": int(self.config.timeout_seconds * 1000),
            "max_block_ms": int(self.config.timeout_seconds * 1000),
            "security_protocol": self.config.security_protocol.upper(),
        }
        if self.config.security_protocol.upper().startswith("SASL_"):
            settings.update(
                sasl_mechanism=self.config.sasl_mechanism,
                sasl_plain_username=self.config.sasl_username,
                sasl_plain_password=self.config.sasl_password,
            )
        if self.config.ssl_cafile:
            settings["ssl_cafile"] = self.config.ssl_cafile
        if self.config.ssl_certfile:
            settings["ssl_certfile"] = self.config.ssl_certfile
            settings["ssl_keyfile"] = self.config.ssl_keyfile
        return KafkaProducer(**settings)

    def send_event(self, event: dict[str, Any]) -> Any:
        validate_event(event)
        try:
            payload = json.dumps(
                event,
                ensure_ascii=False,
                separators=(",", ":"),
                allow_nan=False,
            ).encode("utf-8")
        except (TypeError, ValueError) as error:
            raise DeliveryError(f"event {event.get('event_id')} is not JSON serializable") from error

        for attempt in range(self.config.retries + 1):
            try:
                future = self._producer.send(self.config.topic, value=payload)
                metadata = future.get(timeout=self.config.timeout_seconds)
                logger.info(
                    "Published event %s to %s partition %s offset %s",
                    event["event_id"],
                    self.config.topic,
                    getattr(metadata, "partition", "?"),
                    getattr(metadata, "offset", "?"),
                )
                return metadata
            except Exception as error:
                if attempt >= self.config.retries:
                    raise DeliveryError(
                        f"failed to publish event {event['event_id']} after {attempt + 1} attempt(s)"
                    ) from error
                logger.warning(
                    "Publish attempt %s/%s failed for event %s: %s",
                    attempt + 1,
                    self.config.retries + 1,
                    event["event_id"],
                    error,
                )
                self._sleep(self.config.retry_backoff_seconds * (attempt + 1))

    def close(self) -> None:
        if hasattr(self._producer, "flush"):
            self._producer.flush(timeout=self.config.timeout_seconds)
        if hasattr(self._producer, "close"):
            self._producer.close(timeout=self.config.timeout_seconds)