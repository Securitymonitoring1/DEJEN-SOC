# File Integrity Monitoring

`collectors.fim.monitor.FIMMonitor` watches configured Linux paths with watchdog and hashes regular files using streaming SHA-256 reads. It emits `file_created`, `file_modified`, `file_deleted`, and `file_renamed` events. Exclusions accept glob patterns against the full path or filename. Unchanged snapshots do not emit duplicate events.

## Run

```sh
python -m pip install -r requirements.txt
cp -n .env.example .env
```

Set `REDPANDA_BROKERS`, `REDPANDA_TOPIC`, and `FIM_PATHS` to the directories/files to monitor. Set exclusions with comma-separated `FIM_EXCLUDE_PATTERNS`, choose a protected `FIM_BASELINE_PATH`, then run:

```sh
python -m collectors.fim.main
```

To send findings directly into the running Dejen platform API for alerting, set `FIM_DELIVERY=http`, `DEJEN_API_URL` (default `http://127.0.0.1:8000`), and `DEJEN_API_TOKEN` to an API token with the `ADMIN` or `ANALYST` role. This routes events through the same `/events` ingestion and detection path as the platform's HTTP agent. The default `FIM_DELIVERY=kafka` preserves Redpanda publishing for deployments with a Kafka-to-platform consumer.

The first run creates a baseline and does not report existing files as new. To intentionally reinitialize the baseline:

```sh
python -c 'from dotenv import load_dotenv; import os; from collectors.fim.monitor import FIMMonitor; load_dotenv(); paths=[p.strip() for p in os.environ["FIM_PATHS"].split(",") if p.strip()]; FIMMonitor(paths, os.getenv("FIM_BASELINE_PATH", "./data/fim_baseline.json"), exclusions=tuple(p.strip() for p in os.getenv("FIM_EXCLUDE_PATTERNS", "").split(",") if p.strip())).initialize_baseline()'
```

## Test and limitations

```sh
python -m unittest tests/test_fim.py -v
```

The baseline is atomically replaced and chmodded to owner-only (`0600`) where supported. It is still stored locally; a privileged attacker can alter both files and baseline. Keep it on a protected filesystem and consider a remote/signature-backed baseline for stronger tamper resistance. Permission failures are logged and prior entries below inaccessible paths are preserved. Failed event delivery prevents the baseline from advancing, so the changed file will be retried on a later scan.