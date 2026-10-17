"""
Correlation engine: groups related events over a time window and fires
an alert when a threshold is crossed.

Example (brute_force.yaml):
    correlation:
      window_seconds: 300
      threshold: 5
    group_by: source_ip
    group_by_fallback: host

    If the primary grouping field is missing, an optional fallback field
    keeps events scoped to the endpoint instead of silently discarding them.
"""
import logging
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Any, Deque, Dict, List, Tuple

from .rule_engine import Rule

logger = logging.getLogger(__name__)


class CorrelationEngine:
    """
    Stateful, in-memory sliding-window correlator. One instance tracks all
    correlation rules. For production scale, back this with Redis instead
    of in-memory deques (Person 3 owns Redis, you're the support/consumer).
    """

    def __init__(self, rules: List[Rule]):
        self.rules = rules
        # state[rule.id][group_key] = deque of event timestamps, IDs, and values
        self._state: Dict[str, Dict[str, Deque[Tuple[datetime, str, Any]]]] = defaultdict(lambda: defaultdict(deque))
        self._fired: Dict[str, set] = defaultdict(set)  # avoid re-firing every single event past threshold

    def process_event(self, event: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Feed one normalized event in. Returns a list of alert-trigger dicts
        (rule + group_key + matching event_ids) for any rule that just
        crossed its threshold because of this event.
        """
        triggers = []
        for rule in self.rules:
            cfg = rule.correlation
            group_field = cfg["group_by"]
            group_value = event.get(group_field)
            if group_value is None:
                fallback_field = cfg.get("group_by_fallback")
                fallback_value = event.get(fallback_field) if fallback_field else None
                if fallback_value is None:
                    continue
                group_key = f"{fallback_field}:{fallback_value}"
            else:
                group_key = str(group_value)
            if rule.match and not rule.matches_single_event(event):
                continue

            distinct_field = cfg.get("distinct_field")
            distinct_value = event.get(distinct_field) if distinct_field else None
            if distinct_field and distinct_value is None:
                continue

            window = timedelta(seconds=cfg["window_seconds"])
            threshold = cfg["threshold"]
            ts = _parse_ts(event["timestamp"])

            dq = self._state[rule.id][group_key]
            # evict anything outside the window
            cutoff = ts - window
            while dq and dq[0][0] < cutoff:
                dq.popleft()
            if not dq:
                self._fired[rule.id].discard(group_key)
            dq.append((ts, event["event_id"], distinct_value))

            count = len({value for _, _, value in dq}) if distinct_field else len(dq)
            if count >= threshold:
                # only fire once per distinct count, to avoid duplicate alerts
                # as more events keep arriving after crossing the threshold
                if group_key not in self._fired[rule.id]:
                    self._fired[rule.id].add(group_key)
                    triggers.append(
                        {
                            "rule": rule,
                            "group_field": group_field,
                            "group_value": group_key,
                            "event_ids": [event_id for _, event_id, _ in dq],
                            "count": count,
                        }
                    )
        return triggers

    def reset_group(self, rule_id: str, group_value: str):
        """Call after an incident is created/resolved so the same group can re-trigger later."""
        self._state[rule_id].pop(group_value, None)
        self._fired[rule_id].discard(group_value)


def _parse_ts(ts: str) -> datetime:
    dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt
