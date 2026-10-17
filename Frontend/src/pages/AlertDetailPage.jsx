import { useState } from "react";
import { useSoc } from "../context/SocContext";
import { GlassWorkspace } from "../components/layout/GlassWorkspace";

export const AlertDetailPage = () => {
  const { routeParams, alerts, events, navigate, updateAlertStatus, currentUser } = useSoc();
  const canManage = ["ADMIN", "ANALYST"].includes(currentUser?.role);
  const [actionError, setActionError] = useState("");
  const alert = alerts.find((item) => item.id === routeParams.id);
  const event = events.find((item) => item.event_id === alert?.eventId);

  if (!alert) return <GlassWorkspace><p className="rounded-md border border-black/10 bg-white p-6 text-sm">Alert is not present in the backend response. <button onClick={() => navigate("/alerts")} className="ml-2 text-teal-800 underline">Return to alerts</button></p></GlassWorkspace>;

  const setStatus = async (status) => {
    setActionError("");
    try {
      await updateAlertStatus(alert.id, status);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Could not update alert status.");
    }
  };

  return <GlassWorkspace>
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 pb-3">
        <div><button onClick={() => navigate("/alerts")} className="mb-2 text-xs font-semibold text-[#287b70] hover:underline">← Alerts</button><h1 className="text-xl font-bold">{alert.title}</h1><p className="mt-1 text-xs text-[#62686d]">{alert.id} · {new Date(alert.timestamp).toLocaleString()}</p></div>
        <label className="text-xs font-medium">Status<select value={alert.status} disabled={!canManage} onChange={(event) => setStatus(event.target.value)} className="ml-2 rounded-md border border-black/15 bg-white px-3 py-2 text-xs disabled:bg-[#f2f3f3]">{["OPEN", "INVESTIGATING", "RESOLVED"].map((status) => <option key={status}>{status}</option>)}</select></label>
      </div>

      {actionError && <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">{actionError}</p>}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Severity", alert.severity], ["Risk score", alert.riskScore], ["Detection rule", alert.rule], ["Status", alert.status], ["Source IP", event?.source_ip || "Not recorded (local or unavailable)"]].map(([label, value]) => <div key={label} className="rounded-md border border-black/10 bg-white p-4"><div className="text-[11px] text-[#62686d]">{label}</div><div className="mt-1 break-words font-mono text-sm font-semibold">{value}</div></div>)}
      </section>
      <section className="rounded-md border border-black/10 bg-white p-4">
        <h2 className="text-sm font-bold">Alert description</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#41474b]">{alert.description}</p>
      </section>
      <section className="rounded-md border border-black/10 bg-white p-4">
        <h2 className="text-sm font-bold">Related event</h2>
        {event ? <dl className="mt-3 grid grid-cols-1 gap-x-5 gap-y-3 text-xs sm:grid-cols-2"><div><dt className="text-[#62686d]">Event ID</dt><dd className="mt-1 break-all font-mono">{event.event_id}</dd></div><div><dt className="text-[#62686d]">Timestamp</dt><dd className="mt-1">{new Date(event.timestamp).toLocaleString()}</dd></div><div><dt className="text-[#62686d]">Host / Agent</dt><dd className="mt-1">{event.host} / {event.agent_id}</dd></div><div><dt className="text-[#62686d]">Type / Severity</dt><dd className="mt-1">{event.event_type} / {event.severity}</dd></div><div><dt className="text-[#62686d]">Username / Source IP</dt><dd className="mt-1">{event.username || "-"} / {event.source_ip || "-"}</dd></div><div className="sm:col-span-2"><dt className="text-[#62686d]">Message</dt><dd className="mt-1 whitespace-pre-wrap">{event.message}</dd></div></dl> : <p className="mt-2 text-xs text-[#62686d]">The related event is not available in the current backend response.</p>}
          {event ? <dl className="mt-3 grid grid-cols-1 gap-x-5 gap-y-3 text-xs sm:grid-cols-2"><div><dt className="text-[#62686d]">Event ID</dt><dd className="mt-1 break-all font-mono">{event.event_id}</dd></div><div><dt className="text-[#62686d]">Timestamp</dt><dd className="mt-1">{new Date(event.timestamp).toLocaleString()}</dd></div><div><dt className="text-[#62686d]">Host / Agent</dt><dd className="mt-1">{event.host} / {event.agent_id}</dd></div><div><dt className="text-[#62686d]">Type / Severity</dt><dd className="mt-1">{event.event_type} / {event.severity}</dd></div><div><dt className="text-[#62686d]">Username</dt><dd className="mt-1">{event.username || "-"}</dd></div><div><dt className="text-[#62686d]">Source IP</dt><dd className="mt-1 font-mono">{event.source_ip || "Not recorded (local or unavailable)"}</dd></div><div className="sm:col-span-2"><dt className="text-[#62686d]">Message</dt><dd className="mt-1 whitespace-pre-wrap">{event.message}</dd></div></dl> : <p className="mt-2 text-xs text-[#62686d]">The related event is not available in the current backend response.</p>}
      </section>
    </div>
  </GlassWorkspace>;
};
