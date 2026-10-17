"""
Reputation scoring for IPs, domains, URLs, and file hashes.
Start with a static/local blocklist; swap in real feeds (AbuseIPDB, OTX,
VirusTotal, etc.) behind the same interface later.
"""
from typing import Any, Dict, Optional

# Placeholder local intel — replace with feeds/ data loaded at startup.
KNOWN_MALICIOUS_IPS = {
    "45.155.205.233": 95,
    "185.220.101.1": 90,  # example Tor exit node style entry
}
KNOWN_MALICIOUS_HASHES = set()


def lookup_ip(ip: Optional[str]) -> Dict[str, Any]:
    if not ip:
        return {"ip_score": None, "is_known_malicious": False, "source": "none"}
    score = KNOWN_MALICIOUS_IPS.get(ip)
    return {
        "ip_score": score if score is not None else 0,
        "is_known_malicious": score is not None,
        "source": "local_blocklist" if score is not None else "no_match",
    }


def lookup_hash(file_hash: Optional[str]) -> Dict[str, Any]:
    if not file_hash:
        return {"ip_score": None, "is_known_malicious": False, "source": "none"}
    is_malicious = file_hash in KNOWN_MALICIOUS_HASHES
    return {
        "ip_score": 100 if is_malicious else 0,
        "is_known_malicious": is_malicious,
        "source": "local_blocklist" if is_malicious else "no_match",
    }
