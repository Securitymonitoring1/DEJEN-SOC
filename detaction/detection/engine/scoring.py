"""
Assigns a confidence score (0.0-1.0) to a candidate alert, combining
the rule's base confidence with threat-intelligence reputation signals.
"""
from typing import Any, Dict, Optional

BASE_CONFIDENCE_BY_SEVERITY = {
    "LOW": 0.4,
    "MEDIUM": 0.6,
    "HIGH": 0.75,
    "CRITICAL": 0.9,
}


def score_alert(severity: str, reputation: Optional[Dict[str, Any]] = None) -> float:
    base = BASE_CONFIDENCE_BY_SEVERITY.get(severity, 0.5)

    if not reputation:
        return round(base, 2)

    boost = 0.0
    if reputation.get("is_known_malicious"):
        boost += 0.2
    ip_score = reputation.get("ip_score")
    if ip_score is not None:
        # assume ip_score is 0 (clean) to 100 (malicious)
        boost += min(ip_score / 100.0, 1.0) * 0.15

    return round(min(base + boost, 1.0), 2)


def escalate_severity(severity: str, reputation: Optional[Dict[str, Any]] = None) -> str:
    """Optionally bump severity up one level if threat intel confirms malice."""
    order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    if reputation and reputation.get("is_known_malicious") and severity in order[:-1]:
        return order[order.index(severity) + 1]
    return severity
