"""
Loads detection rules from YAML and evaluates single normalized events
against simple (non-correlation) conditions.

Correlation rules (e.g. brute force = N events in T seconds) are handled
by correlation.py, which uses this engine to first filter candidate events.
"""
import glob
import logging
import operator
import os
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import yaml

logger = logging.getLogger(__name__)

OPS = {
    "eq": operator.eq,
    "ne": operator.ne,
    "gt": operator.gt,
    "gte": operator.ge,
    "lt": operator.lt,
    "lte": operator.le,
    "contains": lambda field_val, target: str(target).casefold() in str(field_val or "").casefold(),
    "in": lambda field_val, target: field_val in target,
}


@dataclass
class Rule:
    id: str
    name: str
    severity: str
    mitre_technique: Optional[str] = None
    match: Dict[str, Any] = field(default_factory=dict)
    correlation: Optional[Dict[str, Any]] = None  # e.g. {window_seconds: 300, threshold: 5, group_by: source_ip}
    description: str = ""

    def matches_single_event(self, event: Dict[str, Any]) -> bool:
        """Evaluate the non-correlation `match` conditions against one event."""
        for field_name, condition in self.match.items():
            event_value = event.get(field_name)
            if isinstance(condition, dict):
                op_name, target = next(iter(condition.items()))
                op_fn = OPS.get(op_name)
                if op_fn is None:
                    logger.warning("Unknown operator '%s' in rule %s", op_name, self.id)
                    return False
                if not op_fn(event_value, target):
                    return False
            else:
                # shorthand: field: value means equality
                if event_value != condition:
                    return False
        return True


def load_rules(rules_dir: str) -> List[Rule]:
    rules = []
    for path in sorted(glob.glob(os.path.join(rules_dir, "*.yaml"))):
        with open(path) as f:
            data = yaml.safe_load(f)
        rules.append(
            Rule(
                id=data["id"],
                name=data["name"],
                severity=data["severity"],
                mitre_technique=data.get("mitre_technique"),
                match=data.get("match", {}),
                correlation=data.get("correlation"),
                description=data.get("description", ""),
            )
        )
    logger.info("Loaded %d rules from %s", len(rules), rules_dir)
    return rules


class RuleEngine:
    def __init__(self, rules_dir: str):
        self.rules_dir = rules_dir
        self.rules: List[Rule] = load_rules(rules_dir)

    def single_event_matches(self, event: Dict[str, Any]) -> List[Rule]:
        """Rules with no correlation block, matched directly against one event."""
        return [r for r in self.rules if r.correlation is None and r.matches_single_event(event)]

    def correlation_rules(self) -> List[Rule]:
        return [r for r in self.rules if r.correlation is not None]
