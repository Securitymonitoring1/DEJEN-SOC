from pydantic import BaseModel


class DashboardSummaryResponse(BaseModel):
    total_events: int
    total_alerts: int
    open_alerts: int
    critical_alerts: int
    total_incidents: int
    open_incidents: int
    investigating_incidents: int
    resolved_incidents: int
    total_endpoints: int
    active_endpoints: int
