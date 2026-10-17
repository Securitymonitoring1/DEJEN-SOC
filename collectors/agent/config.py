import os
import socket
from dataclasses import dataclass


@dataclass(frozen=True)
class CollectorConfig:
    backend_url: str
    username: str
    password: str
    agent_id: str
    host: str
    request_timeout: float = 15.0
    collection_interval: float = 10.0
    auth_log_path: str | None = None

    @classmethod
    def from_environment(cls) -> "CollectorConfig":
        username = os.getenv("COLLECTOR_USERNAME", "").strip()
        password = os.getenv("COLLECTOR_PASSWORD", "")
        if not username or not password:
            raise ValueError(
                "Set COLLECTOR_USERNAME and COLLECTOR_PASSWORD to an active "
                "ADMIN or ANALYST account."
            )

        return cls(
            backend_url=os.getenv(
                "DEJEN_BACKEND_URL", "http://localhost:8000"
            ).rstrip("/"),
            username=username,
            password=password,
            agent_id=os.getenv("COLLECTOR_AGENT_ID", socket.gethostname()),
            host=os.getenv("COLLECTOR_HOST", socket.gethostname()),
            request_timeout=float(os.getenv("COLLECTOR_TIMEOUT_SECONDS", "15")),
            collection_interval=float(os.getenv("COLLECTOR_INTERVAL_SECONDS", "10")),
            auth_log_path=os.getenv("LINUX_AUTH_LOG") or None,
        )
