import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, RefreshCw, Search, X } from "lucide-react";
import { GlassWorkspace } from "../components/layout/GlassWorkspace";
import { useSoc } from "../context/SocContext";

const stamp = (value) => value ? new Date(value).toLocaleString() : "-";
const eventLabel = (value) => value?.replaceAll("_", " ") || "Unknown event";
const eventSummary = (event) => {
  const type = event.event_type?.toLowerCase().replaceAll(" ", "_");
  const summaries = {
    authentication_success: "A sign-in completed successfully.",
    authentication_failed: "A sign-in attempt was rejected.",
    login_failure: "A sign-in attempt was rejected.",
    user_created: "A user account was created.",
    user_deleted: "A user account was deleted.",
    group_membership_added: "An account was added to a group.",
    group_membership_removed: "An account was removed from a group.",
  };
  if (summaries[type]) return summaries[type];
  return event.message?.split(/\r?\n/).find((line) => line.trim())?.trim() || "No event summary is available.";
};
const severityClass = (severity) => ({
  CRITICAL: "bg-red-600 text-white",
  HIGH: "bg-orange-400 text-orange-950",
  MEDIUM: "bg-yellow-300 text-yellow-950",
  LOW: "bg-green-400 text-green-950",
}[severity?.toUpperCase()] || "bg-neutral-100 text-neutral-700");

export const EventsPage = () => {
  const { events, loading, error, refreshData, routeParams } = useSoc();
  const [query, setQuery] = useState(routeParams.query || "");
  const [severity, setSeverity] = useState("ALL");
  const [eventType, setEventType] = useState("ALL");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [panelWidth, setPanelWidth] = useState(340);
  const resizeState = useRef(null);

  useEffect(() => {
    setQuery(routeParams.query || "");
  }, [routeParams.query]);

  useEffect(() => {
    const matchingEvent = events.find((event) => event.event_id === routeParams.query);
    if (matchingEvent) setSelectedEvent(matchingEvent);
  }, [events, routeParams.query]);

  const startResize = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeState.current = {
      startX: event.clientX,
      width: panelWidth,
    };
  };
  const moveResize = (event) => {
    const resize = resizeState.current;
    if (!resize) return;
    const width = resize.width + resize.startX - event.clientX;
    setPanelWidth(Math.max(280, Math.min(720, window.innerWidth - 360, width)));
  };
  const stopResize = () => { resizeState.current = null; };
  const resizeWithKeyboard = (event) => {
    if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const widthChange = event.key === "ArrowLeft" ? 24 : -24;
    setPanelWidth((current) => Math.max(280, Math.min(720, window.innerWidth - 360, current + widthChange)));
  };

  const eventTypes = useMemo(() => [...new Set(events.map((event) => event.event_type).filter(Boolean))].sort(), [events]);
  const filteredEvents = useMemo(() => [...events]
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .filter((event) => {
      const searchable = [event.event_id, event.event_type, event.host, event.agent_id, event.username, event.source_ip, event.message]
        .filter(Boolean).join(" ").toLowerCase();
      return (!query || searchable.includes(query.toLowerCase()))
        && (severity === "ALL" || event.severity?.toUpperCase() === severity)
        && (eventType === "ALL" || event.event_type === eventType);
    }), [events, eventType, query, severity]);

  return <GlassWorkspace>
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-black/10 pb-4">
        <div>
          <span className="soc-eyebrow">TELEMETRY</span>
          <h1 className="text-2xl font-bold text-neutral-900">Event viewer</h1>
          <p className="mt-1 text-sm text-neutral-600">Inspect events received from enrolled endpoints.</p>
        </div>
        <button onClick={refreshData} disabled={loading} className="inline-flex items-center gap-2 rounded border border-black/15 bg-white px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50 disabled:opacity-60">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </header>

      {error && <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}

      <div className="flex flex-wrap items-center gap-3 border-b border-black/10 pb-4">
        <label className="relative min-w-56 flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events, hosts, users, IPs" className="w-full rounded border border-black/15 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-700" />
        </label>
        <select aria-label="Filter by severity" value={severity} onChange={(event) => setSeverity(event.target.value)} className="rounded border border-black/15 bg-white px-3 py-2 text-sm">
          {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((item) => <option key={item} value={item}>{item === "ALL" ? "All severities" : item}</option>)}
        </select>
        <select aria-label="Filter by event type" value={eventType} onChange={(event) => setEventType(event.target.value)} className="max-w-56 rounded border border-black/15 bg-white px-3 py-2 text-sm">
          <option value="ALL">All event types</option>
          {eventTypes.map((item) => <option key={item} value={item}>{item.replaceAll("_", " ")}</option>)}
        </select>
        <span className="text-xs tabular-nums text-neutral-500">{filteredEvents.length} of {events.length} events</span>
      </div>

      <div className={selectedEvent ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_var(--event-panel-width)]" : ""} style={{ "--event-panel-width": `${panelWidth}px` }}>
        <section aria-label="Events" className="overflow-hidden rounded border border-black/10 bg-white">
          <div className="max-h-[calc(100vh-280px)] min-h-[280px] overflow-auto">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-black/10 bg-neutral-50 text-[11px] uppercase tracking-wide text-neutral-500">
                <tr><th className="px-4 py-3">Time</th><th className="px-4 py-3">Severity</th><th className="px-4 py-3">Event</th><th className="px-4 py-3">Endpoint</th><th className="px-4 py-3">User / source</th><th className="px-4 py-3">Message</th></tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filteredEvents.map((event) => <tr key={event.event_id} onClick={() => setSelectedEvent(event)} className={`cursor-pointer align-top hover:bg-teal-50/50 ${selectedEvent?.event_id === event.event_id ? "bg-teal-50" : ""}`}>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-600">{stamp(event.timestamp)}</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded px-2 py-1 text-[10px] font-bold ${severityClass(event.severity)}`}>{event.severity || "UNKNOWN"}</span></td>
                  <td className="px-4 py-3 font-semibold text-neutral-900">{event.event_type?.replaceAll("_", " ") || "Unknown event"}</td>
                  <td className="px-4 py-3 text-neutral-700">{event.host || "-"}<small className="block text-xs text-neutral-400">Agent {event.agent_id || "-"}</small></td>
                  <td className="px-4 py-3 text-neutral-700">{event.username || "-"}<small className="block text-xs text-neutral-400">{event.source_ip || "No source IP"}</small></td>
                  <td className="max-w-xs px-4 py-3 text-xs text-neutral-600"><span className="line-clamp-2">{event.message || "-"}</span></td>
                </tr>)}
                {!filteredEvents.length && <tr><td colSpan="6" className="px-4 py-14 text-center">
                  <Activity size={20} className="mx-auto mb-2 text-neutral-400" />
                  <p className="font-medium text-neutral-700">{events.length ? "No events match these filters" : loading ? "Loading events…" : "No endpoint events received yet"}</p>
                  <p className="mt-1 text-xs text-neutral-500">{events.length ? "Try another search or filter." : "Events will appear here after an agent sends telemetry."}</p>
                </td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        {selectedEvent && <aside aria-label="Selected event details" className="relative sticky top-4 self-start overflow-hidden rounded border border-black/10 bg-white" style={{ height: "min(75vh, 480px)" }}>
          <div className="flex items-start justify-between gap-3 border-b border-black/10 p-4">
            <div><span className="soc-eyebrow">EVENT DETAILS</span><h2 className="mt-1 text-base font-bold text-neutral-900">{eventLabel(selectedEvent.event_type)}</h2></div>
            <button onClick={() => setSelectedEvent(null)} className="rounded p-1.5 text-neutral-500 hover:bg-neutral-100" aria-label="Close event details"><X size={17} /></button>
          </div>
          <div className="space-y-4 overflow-y-auto p-4" style={{ maxHeight: "calc(100% - 74px)" }}>
            <div className="event-summary-card rounded border border-teal-900/10 bg-teal-50/60 p-3">
              <p className="event-summary-label text-[10px] font-semibold uppercase tracking-wide text-teal-900/70">What happened</p>
              <p className="event-summary-text mt-1 text-sm leading-5 text-neutral-800">{eventSummary(selectedEvent)}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-4">
              {[["Time", stamp(selectedEvent.timestamp)], ["Severity", selectedEvent.severity], ["Endpoint", selectedEvent.host], ["User", selectedEvent.username || "Not recorded"], ["Source IP", selectedEvent.source_ip || "Not recorded"], ["Agent", selectedEvent.agent_id || "Not recorded"]].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">{label}</dt><dd className="mt-1 break-all text-sm text-neutral-800">{value || "-"}</dd></div>)}
            </dl>
            <details className="border-t border-black/10 pt-3">
              <summary className="cursor-pointer text-xs font-semibold text-neutral-700">Technical details</summary>
              <dl className="mt-3 space-y-3">
                <div><dt className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Platform event ID</dt><dd className="mt-1 break-all font-mono-tech text-xs text-neutral-700">{selectedEvent.event_id}</dd></div>
                <div><dt className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Raw event message</dt><dd className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded bg-neutral-50 p-2 text-xs leading-5 text-neutral-700">{selectedEvent.message || "No raw message recorded."}</dd></div>
              </dl>
            </details>
          </div>
          <button type="button" aria-label="Resize details panel width" title="Drag to resize width; use left and right arrow keys" className="absolute inset-y-0 left-0 hidden w-3 cursor-col-resize touch-none items-center justify-center bg-neutral-100/70 text-neutral-400 hover:bg-teal-100 hover:text-teal-800 xl:flex" style={{ touchAction: "none" }} onPointerDown={startResize} onPointerMove={moveResize} onPointerUp={stopResize} onPointerCancel={stopResize} onKeyDown={resizeWithKeyboard}><span className="h-10 w-0.5 rounded bg-current" /></button>
        </aside>}
      </div>
    </div>
  </GlassWorkspace>;
};