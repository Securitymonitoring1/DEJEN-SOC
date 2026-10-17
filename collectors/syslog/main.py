import logging
import os
import signal
import threading

from dotenv import load_dotenv

from collectors.sender.kafka import KafkaEventProducer
from collectors.syslog.receiver import SyslogReceiver


def main() -> int:
    load_dotenv()
    producer = KafkaEventProducer()
    receiver = SyslogReceiver(
        producer.send_event,
        host=os.getenv("SYSLOG_HOST", "127.0.0.1"),
        port=int(os.getenv("SYSLOG_PORT", "5514")),
        protocol=os.getenv("SYSLOG_PROTOCOL", "udp"),
        agent_id=os.getenv("COLLECTOR_AGENT_ID", "syslog"),
        max_message_bytes=int(os.getenv("SYSLOG_MAX_MESSAGE_BYTES", "65536")),
    )
    stop_event = threading.Event()
    signal.signal(signal.SIGINT, lambda *_args: stop_event.set())
    signal.signal(signal.SIGTERM, lambda *_args: stop_event.set())
    address = receiver.start()
    logging.info("Syslog receiver listening on %s:%s/%s", *address, receiver.protocol)
    try:
        stop_event.wait()
    finally:
        receiver.shutdown()
        producer.close()
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
    raise SystemExit(main())