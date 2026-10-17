"""
Detection service entrypoint. Consumes normalized events (from ingest/),
runs them through single-event rules + correlation rules, enriches with
threat intel, scores, and emits alerts matching schemas/alert.json.
"""
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

from .engine.correlation import CorrelationEngine
from .engine.rule_engine import Rule, RuleEngine
from .engine.scoring import escalate_severity, score_alert

logger = logging.getLogger(__name__)

RULES_DIR = os.path.join(os.path.dirname(__file__), "rules")


def build_alert(
    rule: Rule,
    *,
    source_ip: Optional[str] = None,
    host: Optional[str] = None,
    username: Optional[str] = None,
    related_event_ids: Optional[List[str]] = None,
    reputation: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    severity = escalate_severity(rule.severity, reputation)
    return {
        "alert_id": str(uuid.uuid4()),
        "rule_id": rule.id,
        "rule_name": rule.name,
        "severity": severity,
        "confidence": score_alert(severity, reputation),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source_ip": source_ip,
        "host": host,
        "username": username,
        "mitre_technique": rule.mitre_technique,
        "description": rule.description or rule.name,
        "related_event_ids": related_event_ids or [],
        "reputation": reputation,
        "status": "OPEN",
    }


class DetectionService:
    def __init__(
        self,
        rules_dir: str = RULES_DIR,
        enrich_fn: Optional[Callable[[Dict[str, Any]], Optional[Dict[str, Any]]]] = None,
        alert_sink: Optional[Callable[[Dict[str, Any]], None]] = None,
    ):
        self.engine = RuleEngine(rules_dir)
        self.correlation = CorrelationEngine(self.engine.correlation_rules())
        self.enrich_fn = enrich_fn  # e.g. threat_intelligence.enrichment.enrich_event
        self.alert_sink = alert_sink or (lambda alert: logger.info("ALERT: %s", json.dumps(alert)))

    def process_event(self, event: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Run one normalized event through detection. Returns alerts generated (if any)."""
        alerts = []
        reputation = self.enrich_fn(event) if self.enrich_fn else None

        # 1. single-event rules (malware, fim, suspicious_login)
        for rule in self.engine.single_event_matches(event):
            alert = build_alert(
                rule,
                source_ip=event.get("source_ip"),
                host=event.get("host"),
                username=event.get("username"),
                related_event_ids=[event["event_id"]],
                reputation=reputation,
            )
            alerts.append(alert)

        # 2. correlation rules (brute_force, port_scan)
        for trigger in self.correlation.process_event(event):
            rule = trigger["rule"]
            alert = build_alert(
                rule,
                source_ip=event.get("source_ip") if trigger["group_field"] == "source_ip" else None,
                host=event.get("host"),
                username=event.get("username"),
                related_event_ids=trigger["event_ids"],
                reputation=reputation,
            )
            alerts.append(alert)

        for alert in alerts:
            self.alert_sink(alert)

        return alerts
