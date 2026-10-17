import argparse
import json
import sys
from collections.abc import Iterable
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from collectors.agent.config import CollectorConfig


class CollectorError(Exception):
    pass


class EventForwarder:
    def __init__(self, config: CollectorConfig) -> None:
        self.config = config
        self.access_token: str | None = None

    def _post(self, path: str, payload: dict, authenticated: bool = False) -> dict:
        headers = {"Content-Type": "application/json"}
        if authenticated and self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        request = Request(
            f"{self.config.backend_url}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urlopen(request, timeout=self.config.request_timeout) as response:
            return json.loads(response.read().decode("utf-8"))

    def login(self) -> None:
        try:
            result = self._post(
                "/auth/login",
                {"username": self.config.username, "password": self.config.password},
            )
        except HTTPError as error:
            detail = error.read().decode("utf-8", errors="replace")
            raise CollectorError(f"Backend login failed ({error.code}): {detail}") from error
        except URLError as error:
            raise CollectorError(f"Cannot reach backend: {error.reason}") from error
        self.access_token = result["access_token"]

    def send(self, event: dict) -> dict:
        if not self.access_token:
            self.login()
        try:
            return self._post("/events", event, authenticated=True)
        except HTTPError as error:
            if error.code == 401:
                self.login()
                try:
                    return self._post("/events", event, authenticated=True)
                except HTTPError as retry_error:
                    return self._raise_http_error(retry_error)
            return self._raise_http_error(error)
        except URLError as error:
            raise CollectorError(f"Cannot reach backend: {error.reason}") from error

    @staticmethod
    def _raise_http_error(error: HTTPError) -> dict:
        detail = error.read().decode("utf-8", errors="replace")
        raise CollectorError(f"Event submission failed ({error.code}): {detail}") from error


def read_events(lines: Iterable[str], config: CollectorConfig) -> Iterable[dict]:
    for line_number, line in enumerate(lines, start=1):
        if not line.strip():
            continue
        try:
            event = json.loads(line)
        except json.JSONDecodeError as error:
            raise CollectorError(f"Input line {line_number} is not valid JSON: {error}") from error
        if not isinstance(event, dict):
            raise CollectorError(f"Input line {line_number} must be a JSON object.")
        event.setdefault("agent_id", config.agent_id)
        event.setdefault("host", config.host)
        yield event


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Forward normalized JSON Lines events to the Dejen backend."
    )
    parser.add_argument(
        "--input",
        default="-",
        help="JSONL file to read; use - (the default) to read standard input.",
    )
    args = parser.parse_args()

    try:
        config = CollectorConfig.from_environment()
        forwarder = EventForwarder(config)
        if args.input == "-":
            lines = sys.stdin
            for event in read_events(lines, config):
                result = forwarder.send(event)
                print(f"Forwarded event {result['event_id']} from {result['host']}")
        else:
            with Path(args.input).open(encoding="utf-8") as source:
                for event in read_events(source, config):
                    result = forwarder.send(event)
                    print(f"Forwarded event {result['event_id']} from {result['host']}")
    except (CollectorError, ValueError, OSError, HTTPError, URLError) as error:
        print(f"Collector error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())