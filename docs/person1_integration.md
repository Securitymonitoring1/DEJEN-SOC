# Person 1 Collector Integration

## Architecture and ownership

Additional work is isolated below `collectors/`: Windows Security events under `collectors/agent/collectors/`, syslog parsing/receiving under `collectors/syslog/`, Linux FIM under `collectors/fim/`, and Redpanda delivery under `collectors/sender/`. The existing `collectors/agent/__main__.py` and `collectors/agent/config.py` were left unchanged. Existing `detaction/ingest/parser.py` and `normalizer.py` remain the consumer-side parse/normalize path; producers publish the normalized contract directly.

A separate root-level `agent/` package now provides the Linux SSH auth-log agent that sends directly to the backend HTTP API. It is intentionally distinct from `collectors/agent/`, which contains the existing forwarding utility and the Windows collector.

## Shared event contract

Use `collectors.common.events.build_event` to create an event. It generates a UUID when none is supplied, records observation time in UTC when no timestamp is passed, validates supplied timestamps and severity, and omits absent optional fields. Supported fields match `detaction/schemas/event.json`: `event_id`, `timestamp`, `agent_id`, `host`, `event_type`, `message`, `severity`, plus optional `username`, `source_ip`, `dest_ip`, `dest_port`, `process_name`, `file_path`, `file_hash`, and object-valued `raw`.

Example interface:

```python
from collectors.common.events import build_event
from collectors.sender.kafka import KafkaEventProducer

producer = KafkaEventProducer()
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
```

The existing core agent may continue to use its backend `EventForwarder` where that is the agreed deployment route. Do not send the same source event to both the backend and Redpanda unless downstream deduplication/routing is configured; that would create duplicate ingestion paths.

## Component interfaces

- Windows: `WindowsEventCollector(...).collect() -> list[dict]`; configure Windows IDs and polling with `WINDOWS_EVENT_IDS` and `WINDOWS_EVENT_COLLECTION_INTERVAL`. Run with `python -m collectors.agent.collectors.windows` on Windows with Security-log access.
- Syslog: `SyslogReceiver(on_event=producer.send_event, ...).start()` accepts UDP or newline-delimited TCP. The standalone service is `python -m collectors.syslog.main`.
- FIM: `FIMMonitor(paths, baseline_path, on_event=producer.send_event, ...).run(stop_event)`; initialize the baseline on first run. Standalone service: `python -m collectors.fim.main`.
- Delivery: `KafkaEventProducer.send_event(event)` blocks for acknowledgement and raises `DeliveryError` after retries. Call `close()` during shutdown.

## Setup and verification

1. Install root requirements: `python -m pip install -r requirements.txt`.
2. Copy `.env.example` to `.env` without overwriting an existing file (`cp -n .env.example .env` on Linux/macOS, or `Copy-Item .env.example .env -ErrorAction SilentlyContinue` in PowerShell).
3. Set broker/topic, collector identity, syslog bind/protocol, FIM paths/baseline, and Windows polling settings. Keep credentials out of source control.
4. Start the available Redpanda cluster and verify the configured topic with `rpk topic consume "$REDPANDA_TOPIC" --brokers "$REDPANDA_BROKERS"` (or the cluster's equivalent Kafka consumer).
5. Run new component tests with `python -m unittest discover -s tests -t . -v`. Existing ingest tests can be run with `python detaction/tests/ingest/test_normalizer.py`.

For the direct HTTP Linux auth agent, see [linux_auth_agent.md](linux_auth_agent.md). It requires an `ADMIN` or `ANALYST` API token and does not publish to Redpanda.

The current `docker-compose.yml` provides PostgreSQL only, not Redpanda, so broker delivery is tested with mocks until a test cluster is configured. Syslog is loopback-only by default and has no TLS/authentication. FIM uses a local owner-only baseline and is not protected against a privileged local attacker. Windows collection requires Windows PowerShell and appropriate Security-log permissions. Collector callbacks should retain/retry events after `DeliveryError`; the sender itself does not include a durable spool.

## Handoff checklist

- Keep Linux agent startup, shared config, and existing Linux/process collectors under their current owner; integrate by calling the shared event builder and producer at the existing event boundary.
- Agree on event-type names and severity mapping with the core Linux agent owner before adding new type-specific detections.
- Decide whether production ingestion goes through the backend HTTP forwarder or Redpanda; avoid dual publishing the same source record.
- Configure secure Redpanda credentials/TLS outside source control, and supply a broker for an end-to-end integration test.
- Restrict non-loopback syslog binds with firewall policy or a protected network/tunnel.
- Protect and back up the FIM baseline; test baseline updates as an authorized operational action.