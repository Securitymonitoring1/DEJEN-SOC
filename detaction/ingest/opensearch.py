"""
Indexes normalized events into OpenSearch. Person 2 owns OpenSearch
(Person 3 supports).
"""
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

INDEX_PREFIX = "security-events"


def index_name_for(timestamp: Optional[str] = None) -> str:
    """Daily indices: security-events-2026.09.16"""
    if timestamp:
        try:
            dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except ValueError:
            dt = datetime.now(timezone.utc)
    else:
        dt = datetime.now(timezone.utc)
    return f"{INDEX_PREFIX}-{dt.strftime('%Y.%m.%d')}"


INDEX_MAPPING = {
    "mappings": {
        "properties": {
            "event_id": {"type": "keyword"},
            "timestamp": {"type": "date"},
            "agent_id": {"type": "keyword"},
            "host": {"type": "keyword"},
            "event_type": {"type": "keyword"},
            "username": {"type": "keyword"},
            "source_ip": {"type": "ip", "ignore_malformed": True},
            "dest_ip": {"type": "ip", "ignore_malformed": True},
            "dest_port": {"type": "integer"},
            "process_name": {"type": "keyword"},
            "file_path": {"type": "keyword"},
            "file_hash": {"type": "keyword"},
            "message": {"type": "text"},
            "severity": {"type": "keyword"},
        }
    }
}


class OpenSearchIndexer:
    def __init__(self, hosts=None, use_ssl: bool = False):
        self.hosts = hosts or [{"host": "localhost", "port": 9200}]
        self.use_ssl = use_ssl
        self._client = None

    def connect(self):
        from opensearchpy import OpenSearch  # lazy import

        self._client = OpenSearch(hosts=self.hosts, use_ssl=self.use_ssl, verify_certs=self.use_ssl)
        return self

    def ensure_index(self, index: str):
        if not self._client.indices.exists(index=index):
            self._client.indices.create(index=index, body=INDEX_MAPPING)
            logger.info("Created OpenSearch index %s", index)

    def index_event(self, event: Dict[str, Any]):
        if self._client is None:
            self.connect()
        index = index_name_for(event.get("timestamp"))
        self.ensure_index(index)
        self._client.index(index=index, id=event["event_id"], body=event)


class InMemoryIndexer:
    """Test double: stores events in a list instead of hitting OpenSearch."""

    def __init__(self):
        self.events = []

    def index_event(self, event: Dict[str, Any]):
        self.events.append(event)

    def search_by_source_ip(self, source_ip: str):
        return [e for e in self.events if e.get("source_ip") == source_ip]
