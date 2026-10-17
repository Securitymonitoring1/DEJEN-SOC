import logging
import os
import signal
import socket
import threading
from typing import Any

from collectors.agent.collectors.linux import LinuxAuthCollector, LinuxCollectionError
from collectors.agent.collectors.process import ProcessCollectionError, ProcessCollector
from collectors.agent.config import CollectorConfig
from collectors.sender.kafka import DeliveryError, KafkaEventProducer


logger = logging.getLogger(__name__)


def main() -> int:
    config = CollectorConfig.from_environment()
    auth_collector = LinuxAuthCollector(
        agent_id=config.agent_id,
        host=config.host,
        log_path=config.auth_log_path,
    )
    process_collector = ProcessCollector(agent_id=config.agent_id, host=config.host)
    producer = KafkaEventProducer()
    stop_event = threading.Event()
    signal.signal(signal.SIGINT, lambda *_args: stop_event.set())
    signal.signal(signal.SIGTERM, lambda *_args: stop_event.set())
    pending: list[dict[str, Any]] = []

    try:
        while not stop_event.is_set():
            for collector, error_type in (
                (auth_collector, LinuxCollectionError),
                (process_collector, ProcessCollectionError),
            ):
                try:
                    pending.extend(collector.collect())
                except error_type:
                    logger.exception("%s failed", type(collector).__name__)

            while pending and not stop_event.is_set():
                try:
                    producer.send_event(pending[0])
                    pending.pop(0)
                except DeliveryError:
                    logger.exception("Event remains queued for delivery")
                    stop_event.wait(1)
            stop_event.wait(config.collection_interval)
    finally:
        if pending:
            logger.error("Stopping with %s events pending in memory", len(pending))
        producer.close()
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    raise SystemExit(main())