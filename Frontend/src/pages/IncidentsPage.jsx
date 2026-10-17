import { useEffect, useMemo, useState } from "react";
import { GlassWorkspace } from "../components/layout/GlassWorkspace";
import { SeverityBadge } from "../components/SeverityBadge";
import { IncidentReportingCountdown } from "../components/widgets/IncidentReportingCountdown";
import { useSoc } from "../context/SocContext";

export const IncidentsPage = () => {
  const { incidents, alerts, createIncident, navigate, currentUser, routeParams } = useSoc();
  const canManage = ["ADMIN", "ANALYST"].includes(currentUser?.role);
  const [showCreate, setShowCreate] = useState(false);
  const [alertId, setAlertId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("HIGH");
  const [assignedTo, setAssignedTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState(routeParams.query || "");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  useEffect(() => {
    setQuery(routeParams.query || "");
  }, [routeParams.query]);
  const filteredIncidents = useMemo(() => incidents.filter((incident) => {
    const searchable = [incident.id, incident.title, incident.description, incident.assignedAnalyst, incident.alertId].join(" ").toLowerCase();
    return (!query || searchable.includes(query.trim().toLowerCase()))
      && (severityFilter === "ALL" || incident.severity === severityFilter)
      && (statusFilter === "ALL" || incident.status === statusFilter);
  }), [incidents, query, severityFilter, statusFilter]);

  const submitIncident = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const incident = await createIncident({
        alert_id: alertId,
        title,
        description,
        severity,
        assigned_to: assignedTo || null,
      });
      setShowCreate(false);
      setTitle("");
      setDescription("");
      navigate(`/incidents/${incident.id}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not create incident.");
    } finally {
      setSaving(false);
    }
  };

  return <GlassWorkspace>
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-black/10 pb-3">
        <div><h1 className="text-xl font-bold">Incidents</h1><p className="mt-1 text-sm text-[#62686d]">Incident records and response status from the backend</p></div>
        {canManage && <button onClick={() => { setShowCreate((value) => !value); setError(""); }} disabled={!alerts.length} className="rounded-md bg-[#292b2e] px-3 py-2 text-xs font-semibold text-white hover:bg-[#373a3d] disabled:opacity-50" title={!alerts.length ? "An alert is required to create an incident" : "Create incident from an alert"}>
          {showCreate ? "Cancel" : "Create incident"}
        </button>}
      </div>

      {showCreate && <form onSubmit={submitIncident} className="grid grid-cols-1 gap-3 rounded-md border border-black/10 bg-white p-4 md:grid-cols-2">
        <label className="text-xs font-medium">Related alert<select required value={alertId} onChange={(event) => setAlertId(event.target.value)} className="mt-1 block w-full rounded-md border border-black/15 bg-white px-3 py-2 text-xs"><option value="">Choose an alert</option>{alerts.map((alert) => <option key={alert.id} value={alert.id}>{alert.title} ({alert.severity})</option>)}</select></label>
        <label className="text-xs font-medium">Title<input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 block w-full rounded-md border border-black/15 px-3 py-2 text-xs" /></label>
        <label className="text-xs font-medium">Severity<select value={severity} onChange={(event) => setSeverity(event.target.value)} className="mt-1 block w-full rounded-md border border-black/15 bg-white px-3 py-2 text-xs">{["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className="text-xs font-medium">Assigned to<input value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} className="mt-1 block w-full rounded-md border border-black/15 px-3 py-2 text-xs" /></label>
        <label className="text-xs font-medium md:col-span-2">Description<textarea required rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 block w-full rounded-md border border-black/15 px-3 py-2 text-xs" /></label>
        {error && <p role="alert" className="text-xs text-red-700 md:col-span-2">{error}</p>}
        <div className="md:col-span-2"><button disabled={saving || !alerts.length} className="rounded-md bg-[#287b70] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50">{saving ? "Creating..." : "Save incident"}</button></div>
      </form>}

      <div className="flex flex-wrap items-center gap-3 rounded-md border border-black/10 bg-white p-3">
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search incident, assignee, or alert ID" aria-label="Search incidents" className="min-w-52 flex-1 rounded-md border border-black/15 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-700" />
        <select aria-label="Filter incidents by severity" value={severityFilter} onChange={(event) => setSeverityFilter(event.target.value)} className="rounded-md border border-black/15 bg-white px-3 py-2 text-xs">{["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((value) => <option key={value} value={value}>{value === "ALL" ? "All severities" : value}</option>)}</select>
        <select aria-label="Filter incidents by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-md border border-black/15 bg-white px-3 py-2 text-xs">{["ALL", "OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"].map((value) => <option key={value} value={value}>{value === "ALL" ? "All statuses" : value}</option>)}</select>
        <span className="text-xs text-[#62686d]">{filteredIncidents.length} records</span>
      </div>

      <div className="overflow-x-auto rounded-md border border-black/10 bg-white">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="bg-[#f5f6f6] text-[#62686d]"><tr><th className="px-4 py-3">Incident</th><th className="px-4 py-3">Severity</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Assigned to</th><th className="px-4 py-3">Related alert</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">48h reporting</th></tr></thead>
          <tbody className="divide-y divide-black/5">
            {filteredIncidents.map((incident) => <tr key={incident.id} onClick={() => navigate(`/incidents/${incident.id}`)} className="cursor-pointer hover:bg-[#f8f9f9]"><td className="px-4 py-3"><span className="block font-semibold">{incident.title}</span><span className="mt-1 block font-mono text-[10px] text-[#73797e]">{incident.id}</span></td><td className="px-4 py-3"><SeverityBadge severity={incident.severity} /></td><td className="px-4 py-3">{incident.status}</td><td className="px-4 py-3">{incident.assignedAnalyst}</td><td className="px-4 py-3 font-mono text-[10px]">{incident.alertId}</td><td className="whitespace-nowrap px-4 py-3">{new Date(incident.createdAt).toLocaleString()}</td><td className="px-4 py-3"><IncidentReportingCountdown createdAt={incident.createdAt} compact /></td></tr>)}
            {!filteredIncidents.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-[#777d82]">{incidents.length ? "No incidents match these filters." : "No backend incidents found."}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  </GlassWorkspace>;
};
