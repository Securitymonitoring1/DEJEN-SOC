import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, MonitorCheck, Server, ShieldAlert, Siren } from "lucide-react";
import { GlassWorkspace } from "../components/layout/GlassWorkspace";
import { Charts } from "../components/Charts";
import { EventTimeline } from "../components/EventTimeline";
import { IncidentCard } from "../components/IncidentCard";
import { IncidentReportingCountdown } from "../components/widgets/IncidentReportingCountdown";
import { useSoc } from "../context/SocContext";
import { getIncidentReportingDeadline } from "../utils/incidentReporting";

const URGENT_WINDOW_MS = 12 * 60 * 60 * 1000;

const metrics = [
  { label: "Events received", key: "total_events", icon: Activity, tone: "mint" },
  { label: "Detections", key: "total_alerts", icon: ShieldAlert, tone: "blue" },
  { label: "Open alerts", key: "open_alerts", icon: Siren, tone: "rose" },
  { label: "Open incidents", key: "open_incidents", icon: Server, tone: "amber" },
  { label: "Active endpoints", key: "active_endpoints", icon: MonitorCheck, tone: "mint" },
];
const stamp = (value) => value ? new Date(value).toLocaleString() : "-";

export const DashboardPage = () => {
  const { summary, alerts, incidents, events, loading, navigate } = useSoc();
  const [clockNow, setClockNow] = useState(Date.now());
  useEffect(() => {
    const intervalId = window.setInterval(() => setClockNow(Date.now()), 60_000);
    return () => window.clearInterval(intervalId);
  }, []);
  const urgentIncidents = incidents
    .filter((incident) => {
      if (["RESOLVED", "CLOSED"].includes(incident.status)) return false;
      const deadline = getIncidentReportingDeadline(incident.reportingStartedAt);
      return deadline !== null && deadline.getTime() - clockNow <= URGENT_WINDOW_MS;
    })
    .sort((first, second) => getIncidentReportingDeadline(first.reportingStartedAt).getTime() - getIncidentReportingDeadline(second.reportingStartedAt).getTime());
  return <GlassWorkspace>
    <div className="soc-dashboard">
      <div className="soc-view-head">
        <div><span className="soc-eyebrow">SECURITY CENTER / OVERVIEW</span><h1>Operations overview</h1><p>Live telemetry and response activity across your environment.</p></div>
        <div className="soc-head-actions">
          <span className="soc-live-label"><i />{loading ? "Syncing" : "Live data"}</span>
        </div>
      </div>

      <section className="soc-metrics" aria-label="Backend summary">
        {metrics.map(({ label, key, icon: Icon, tone }) => <article className={`soc-metric soc-tone-${tone}`} key={key}>
          <span className="soc-metric-icon"><Icon size={15} /></span><span className="soc-metric-label">{label}</span>
          <strong>{summary?.[key] ?? "-"}</strong><span className="soc-metric-foot">{key === "active_endpoints" ? `${summary?.total_endpoints ?? 0} registered` : "Backend total"}</span>
        </article>)}
      </section>

      {urgentIncidents.length > 0 && <section aria-label="Urgent incident reporting deadlines" className="rounded-md border border-red-300 bg-red-50 p-4">
        <div className="flex items-start gap-3">
          <Siren size={18} className="mt-0.5 shrink-0 text-red-700" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-bold text-red-900">Urgent incident reporting</h2>
              <span className="text-xs font-semibold text-red-800">{urgentIncidents.length} {urgentIncidents.length === 1 ? "incident" : "incidents"} due within 12 hours or overdue</span>
            </div>
            <div className="mt-3 divide-y divide-red-200">
              {urgentIncidents.map((incident) => <button key={incident.id} onClick={() => navigate(`/incidents/${incident.id}`)} className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2 text-left hover:bg-red-100/70">
                <span className="min-w-0 flex-1 truncate text-xs font-semibold text-red-950">{incident.title}<span className="ml-2 font-normal text-red-800">{incident.severity} · {incident.status}</span></span>
                <span className="whitespace-nowrap text-xs"><IncidentReportingCountdown startedAt={incident.reportingStartedAt} compact /></span>
              </button>)}
            </div>
          </div>
        </div>
      </section>}

      <Charts alerts={alerts} events={events} />

      <div className="soc-content-grid">
        <section className="soc-glass-panel soc-panel-alerts">
          <div className="soc-panel-heading"><div><span className="soc-eyebrow">DETECTION QUEUE</span><h2>Recent alerts</h2></div><button className="soc-panel-link" onClick={() => navigate("/alerts")}>View all <ArrowUpRight size={13} /></button></div>
          <div className="soc-record-list">
            {alerts.slice(0, 5).map((alert) => <button key={alert.id} onClick={() => navigate(`/alerts/${alert.id}`)} className="soc-record-row">
              <span className={`soc-severity-dot sev-${alert.severity?.toLowerCase()}`} />
              <span className="soc-record-main"><strong>{alert.title}</strong><small>{alert.host} <i>·</i> {alert.rule}</small></span>
              <span className="soc-record-state">{alert.status}</span><time>{stamp(alert.timestamp)}</time>
            </button>)}
            {!alerts.length && <p className="soc-empty-state">No alerts yet. Events that match detection rules will appear here.</p>}
          </div>
        </section>

        <EventTimeline events={events} />

        <section className="soc-glass-panel soc-panel-incidents">
          <div className="soc-panel-heading"><div><span className="soc-eyebrow">RESPONSE WORKSPACE</span><h2>Incident response</h2></div><button className="soc-panel-link" onClick={() => navigate("/incidents")}>View cases <ArrowUpRight size={13} /></button></div>
          <div className="soc-incident-grid">
            {incidents.slice(0, 4).map((incident) => <IncidentCard key={incident.id} incident={incident} onOpen={(item) => navigate(`/incidents/${item.id}`)} />)}
            {!incidents.length && <p className="soc-empty-state">No incidents have been opened.</p>}
          </div>
        </section>
      </div>
    </div>
  </GlassWorkspace>;
};
