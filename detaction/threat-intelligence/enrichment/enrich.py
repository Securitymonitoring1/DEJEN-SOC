"""
Public enrichment function detection/main.py calls for every event.
"""
from typing import Any, Dict, Optional

from reputation.lookup import lookup_hash, lookup_ip


def enrich_event(event: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if event.get("file_hash"):
        return lookup_hash(event["file_hash"])
    if event.get("source_ip"):
        return lookup_ip(event["source_ip"])
    return None
