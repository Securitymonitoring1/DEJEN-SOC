"""Run the Dejen Linux authentication-log agent."""

import json
import time

from agent.authlog import parse_auth_line
from agent.client import EventSendError, send_event
from agent.config import load_config
from agent.log_reader import LogReader


def run() -> None:
    config = load_config()
    reader = LogReader(config.auth_log_path)
    reader.start_at_end()
    print(f"Dejen agent started: {config.agent_id}", flush=True)
    print(f"Host: {config.host} | Log: {config.auth_log_path}", flush=True)
    if not config.api_token:
        print(
            "WARNING: DEJEN_API_TOKEN is missing; events will only be printed.",
            flush=True,
        )
    print("Waiting for new authentication events...", flush=True)
    try:
        while True:
            for line in reader.read_new_lines():
                event = parse_auth_line(
                    line,
                    agent_id=config.agent_id,
                    host=config.host,
                )
                if event is None:
                    continue
                print(json.dumps(event, sort_keys=True), flush=True)
                if config.api_token:
                    try:
                        result = send_event(
                            event,
                            api_url=config.api_url,
                            token=config.api_token,
                        )
                        print(
                            f"Event accepted by Dejen: "
                            f"{result.get('event_id', 'OK')}",
                            flush=True,
                        )
                    except EventSendError as error:
                        print(f"Event delivery failed: {error}", flush=True)
            time.sleep(config.poll_interval)
    except KeyboardInterrupt:
        print("\nDejen agent stopped.", flush=True)


if __name__ == "__main__":
    run()