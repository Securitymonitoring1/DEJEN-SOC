import logging
import os
import signal
import threading

from dotenv import load_dotenv

from collectors.fim.monitor import FIMMonitor


def _create_event_delivery():
    delivery = os.getenv("FIM_DELIVERY", "kafka").strip().lower()
    if delivery == "http":
        from agent.client import send_event

        api_token = os.getenv("DEJEN_API_TOKEN", "")
        if not api_token:
            raise ValueError("Set DEJEN_API_TOKEN when FIM_DELIVERY=http")
        api_url = os.getenv("DEJEN_API_URL", "http://127.0.0.1:8000")
        return lambda event: send_event(event, api_url, api_token), lambda: None
    if delivery != "kafka":
        raise ValueError("FIM_DELIVERY must be 'kafka' or 'http'")

    from collectors.sender.kafka import KafkaEventProducer

    producer = KafkaEventProducer()
    return producer.send_event, producer.close


def main() -> int:
    load_dotenv()
    if os.getenv("FIM_ENABLED", "true").lower() not in {"1", "true", "yes", "on"}:
        logging.info("FIM is disabled")
        return 0

    paths = [item.strip() for item in os.getenv("FIM_PATHS", "").split(",") if item.strip()]
    if not paths:
        raise ValueError("Set FIM_PATHS to one or more files or directories")
    exclusions = tuple(
        item.strip()
        for item in os.getenv("FIM_EXCLUDE_PATTERNS", "").split(",")
        if item.strip()
    )
    send_event, close_delivery = _create_event_delivery()
    monitor = FIMMonitor(
        paths,
        os.getenv("FIM_BASELINE_PATH", "./data/fim_baseline.json"),
        on_event=send_event,
        agent_id=os.getenv("COLLECTOR_AGENT_ID"),
        host=os.getenv("COLLECTOR_HOST"),
        exclusions=exclusions,
        interval_seconds=float(os.getenv("FIM_SCAN_INTERVAL_SECONDS", "5")),
    )
    stop_event = threading.Event()
    signal.signal(signal.SIGINT, lambda *_args: stop_event.set())
    signal.signal(signal.SIGTERM, lambda *_args: stop_event.set())
    try:
        monitor.run(stop_event)
    finally:
        close_delivery()
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    raise SystemExit(main())