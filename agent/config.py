"""Configuration for the Dejen Linux security agent."""

import os
import socket
from dataclasses import dataclass


@dataclass(frozen=True)
class AgentConfig:
    agent_id: str
    host: str
    auth_log_path: str
    api_url: str
    api_token: str
    poll_interval: int


def load_config() -> AgentConfig:
    hostname = socket.gethostname()
    return AgentConfig(
        agent_id=os.getenv("DEJEN_AGENT_ID", f"linux-{hostname}"),
        host=os.getenv("DEJEN_HOST", hostname),
        auth_log_path=os.getenv("DEJEN_AUTH_LOG", "/var/log/auth.log"),
        api_url=os.getenv("DEJEN_API_URL", "http://127.0.0.1:8000").rstrip("/"),
        api_token=os.getenv("DEJEN_API_TOKEN", ""),
        poll_interval=max(1, int(os.getenv("DEJEN_POLL_INTERVAL", "5"))),
    )