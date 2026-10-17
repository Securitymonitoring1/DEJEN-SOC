# Person 2 — Ingestion, Detection & Threat Intelligence

Owns: `ingest/`, `detection/`, `threat-intelligence/`, `tests/ingest/`, `tests/detection/`

## What's here and working right now

- **ingest/** — `consumer.py` (Redpanda consumer + a `MockConsumer` for local dev),
  `parser.py` (handles linux_agent/windows_agent/syslog/fim payload shapes),
  `normalizer.py` (locks everything to `schemas/event.json`), `opensearch.py`
  (indexer + an `InMemoryIndexer` test double).
- **detection/** — `engine/rule_engine.py` loads YAML rules, `engine/correlation.py`
  does sliding-window multi-event correlation (brute force, port scan),
  `engine/scoring.py` turns severity + threat intel into a confidence score.
  `main.py` (`DetectionService`) wires it all together and emits alerts
  matching `schemas/alert.json`. `mitre/mapping.json` maps rule IDs to ATT&CK.
- **threat-intelligence/** — `reputation/lookup.py` has a stub IP/hash
  blocklist behind the interface you'll swap real feeds into later;
  `enrichment/enrich.py` is what `detection/main.py` calls per event.
- **tests/** — run with no external services required (`python3
  tests/detection/test_rule_engine.py` etc). They prove: 5 failed logins
  from the same IP in 5 minutes fires exactly one HIGH brute-force alert;
  malware events fire immediately at CRITICAL; threshold isn't crossed early;
  threat-intel reputation boosts confidence.

## Quick start (no Redpanda/OpenSearch needed)

```python
from detection.main import DetectionService

service = DetectionService()  # loads all 5 rules automatically
alerts = service.process_event({
    "event_id": "...", "timestamp": "2026-09-16T10:00:00Z",
    "agent_id": "agent-001", "host": "ubuntu-01",
    "event_type": "authentication_failed",
    "source_ip": "10.0.0.5", "username": "admin",
    "message": "Failed password", "severity": "LOW",
})
```

Call it 5x with the same source_ip within a 5-minute window and you'll get
a `brute_force` alert on the 5th call.

## Wiring to real infra (once available)

- Point `ingest.consumer.RedpandaConsumer(bootstrap_servers=...)` at the
  real Redpanda broker Person 1 is producing to.
- Point `ingest.opensearch.OpenSearchIndexer(hosts=...)` at the real cluster.
- Swap `threat_intelligence.reputation.lookup`'s static dicts for a real
  feed puller in `threat-intelligence/feeds/` (AbuseIPDB / OTX / VirusTotal),
  loaded at startup into the same `lookup_ip`/`lookup_hash` interface so
  nothing downstream has to change.

## Contract with the rest of the team

- **Input**: raw events on the Redpanda topic from Person 1's agents/syslog.
- **Output**: alerts matching `schemas/alert.json` — this is what Person 3's
  backend/incident-response consumes. Don't change this shape without
  agreeing with Person 3 first.
- Event shape is locked to `schemas/event.json` — same rule applies.

## Known gaps / next steps

- `port_scan.yaml` currently counts *occurrences* of `connection_attempt`
  events per source IP, not *distinct destination ports* — the real MVP
  logic. Add distinct-port tracking to `correlation.py` (track a `set()` of
  `dest_port` per group instead of just a count) before relying on it.
- Correlation state is in-memory (per-process). For multi-instance/production
  scale, move `CorrelationEngine`'s state into Redis (Person 3 owns Redis,
  you're listed as support) so state survives restarts and scales horizontally.
- `threat-intelligence/feeds/` is empty — wire in a real feed source.
- No live Kafka/OpenSearch integration test yet — only unit tests with mocks.
  Add one once Redpanda/OpenSearch containers are available (Docker Compose,
  Person 3 coordinates).
