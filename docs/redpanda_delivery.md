# Redpanda Event Delivery

`collectors.sender.kafka.KafkaEventProducer` publishes normalized events as JSON bytes using the project's Kafka-compatible `kafka-python` dependency. It requests `acks=all`, waits for the broker acknowledgement, retries the configured number of times, and raises `DeliveryError` instead of silently claiming success. Retrying the same event object retains its `event_id`.

## Configuration and run

Install dependencies and create a local config without overwriting an existing one:

```sh
python -m pip install -r requirements.txt
cp -n .env.example .env
```

Set `REDPANDA_BROKERS` (comma-separated), `REDPANDA_TOPIC`, `REDPANDA_TIMEOUT_SECONDS`, `REDPANDA_RETRIES`, and `REDPANDA_RETRY_BACKOFF_SECONDS`. The default security mode is local-development `PLAINTEXT`. For secured deployments use `REDPANDA_SECURITY_PROTOCOL=SASL_SSL` or `SSL`, set the appropriate mechanism/certificate paths, and supply credentials through an untracked environment file or secret manager. Do not commit secrets.

An event can be sent independently:

```python
from collectors.common.events import build_event
from collectors.sender.kafka import KafkaEventProducer

producer = KafkaEventProducer()
try:
    event = build_event(
        agent_id="agent-001",
        host="linux-server",
        event_type="authentication_failed",
        username="admin",
        source_ip="192.0.2.20",
        message="Failed login attempt",
        severity="MEDIUM",
    )
    producer.send_event(event)
finally:
    producer.close()
```

Consume/verify with your cluster's Kafka CLI, for example:

```sh
rpk topic consume dejen-security-events --brokers localhost:9092
```

## Tests and limitations

```sh
python -m unittest tests/test_kafka_producer.py -v
```

Tests use a mocked producer; they do not claim a live Redpanda integration. Failed publishes are retried in-process and then raised to the caller. There is no durable disk spool in this version, so callers must retain failed events or restart from their source. SASL/TLS options are passed to kafka-python; certificate and broker policies should be validated against the deployment cluster.