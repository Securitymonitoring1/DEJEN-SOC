import type { ApiEvent } from "../services/api";

interface EventTimelineProps {
  events: ApiEvent[];
}

const stamp = (value: string) => value ? new Date(value).toLocaleString() : "-";

export const EventTimeline = ({ events }: EventTimelineProps) => (
  <section className="soc-glass-panel soc-panel-events">
    <div className="soc-panel-heading"><div><span className="soc-eyebrow">INGEST STREAM</span><h2>Recent events</h2></div><span className="soc-panel-count">{events.length} total</span></div>
    <div className="soc-event-list">
      {events.slice(0, 5).map((event) => <div className="soc-event-row" key={event.event_id}>
        <span className={`soc-event-marker sev-${event.severity?.toLowerCase()}`} />
        <div><strong>{event.event_type}</strong><small>{event.host} <i>·</i> {event.agent_id}</small><p>{event.message}</p></div>
        <time>{stamp(event.timestamp)}</time>
      </div>)}
      {!events.length && <p className="soc-empty-state">No telemetry received. Use “Ingest event” to submit a record.</p>}
    </div>
  </section>
);