import { useEffect, useState } from "react";
import { FileDown } from "lucide-react";
import { GlassWorkspace } from "../components/layout/GlassWorkspace";
import { IncidentReportingCountdown } from "../components/widgets/IncidentReportingCountdown";
import { useSoc } from "../context/SocContext";
import { incidentsApi } from "../services/api";
import { downloadReportPdf } from "../utils/fileDownloader";

const formatTimestamp = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleString();
};

export const IncidentDetailPage = () => {
  const { routeParams, incidents, navigate, updateIncidentStatus, assignIncident, currentUser } = useSoc();
  const canManage = ["ADMIN", "ANALYST"].includes(currentUser?.role);
  const incident = incidents.find((item) => item.id === routeParams.id);
  const [notes, setNotes] = useState([]);
  const [actions, setActions] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!routeParams.id) return;
    let active = true;
    setLoading(true);
    Promise.all([incidentsApi.getNotes(routeParams.id), incidentsApi.getActions(routeParams.id)])
      .then(([incidentNotes, incidentActions]) => {
        if (active) {
          setNotes(incidentNotes);
          setActions(incidentActions);
          setError("");
        }
      })
      .catch((requestError) => {
        if (active) setError(requestError instanceof Error ? requestError.message : "Could not load incident activity.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [routeParams.id]);

  useEffect(() => {
    setAssignedTo(incident?.assignedTo || "");
  }, [incident?.id, incident?.assignedTo]);

  const changeStatus = async (event) => {
    setError("");
    try {
      await updateIncidentStatus(routeParams.id, event.target.value);
      const refreshed = await incidentsApi.getActions(routeParams.id);
      setActions(refreshed);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update incident.");
    }
  };

  const saveAssignment = async (event) => {
    event.preventDefault();
    setError("");
    try {
      await assignIncident(routeParams.id, assignedTo.trim());
      setActions(await incidentsApi.getActions(routeParams.id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not update assignment.");
    }
  };

  const submitNote = async (event) => {
    event.preventDefault();
    if (!noteText.trim()) return;
    setError("");
    try {
      const note = await incidentsApi.addNote(routeParams.id, noteText.trim());
      setNotes((items) => [...items, note]);
      setNoteText("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not add note.");
    }
  };

  const downloadIncidentPdf = async () => {
    try {
      await downloadReportPdf({
      id: incident.id,
      title: incident.title,
      type: "INCIDENT_REPORT",
      classification: "INTERNAL_SOC",
      createdAt: new Date().toISOString(),
      author: currentUser?.username || "DEJEN user",
      status: "DRAFT",
      summary: `Snapshot of incident ${incident.id} from the DEJEN backend. This report contains the incident record and recorded activity; it is not a regulatory filing.`,
      findings: [
        `Status: ${incident.status}`,
        `Severity: ${incident.severity}`,
        `Assigned to: ${incident.assignedAnalyst}`,
        `Related alert: ${incident.alertId}`,
        `Created: ${incident.createdAt}`,
        `Last updated: ${incident.updatedAt || "Not recorded"}`,
        incident.description || incident.summary,
        ...actions.map((action) => `${action.created_at} | ${action.action_type} | ${action.username}: ${action.description}`),
        ...notes.map((note) => `${note.created_at} | Note by ${note.username}: ${note.content}`),
      ],
    });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not create the incident PDF.");
    }
  };

  if (!incident) return <GlassWorkspace><p className="rounded-md border border-black/10 bg-white p-6 text-sm">Incident is not present in the backend response. <button onClick={() => navigate("/incidents")} className="ml-2 text-teal-800 underline">Return to incidents</button></p></GlassWorkspace>;

  return <GlassWorkspace>
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 pb-3">
        <div><button onClick={() => navigate("/incidents")} className="mb-2 text-xs font-semibold text-[#287b70] hover:underline">← Incidents</button><h1 className="text-xl font-bold">{incident.title}</h1></div>
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={downloadIncidentPdf} disabled={loading} className="inline-flex items-center gap-2 rounded-md border border-black/15 bg-white px-3 py-2 text-xs font-semibold hover:bg-[#f5f6f6] disabled:opacity-50" title="Download incident as PDF"><FileDown size={14} />Download PDF</button>
          <label className="text-xs font-medium">Status<select value={incident.status} disabled={!canManage} onChange={changeStatus} className="ml-2 rounded-md border border-black/15 bg-white px-3 py-2 text-xs disabled:bg-[#f2f3f3]">{["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"].map((status) => <option key={status}>{status}</option>)}</select></label>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-md border border-black/10 bg-white p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#62686d]">48h Reporting Deadline</div>
          <div className="mt-2 text-lg"><IncidentReportingCountdown createdAt={incident.createdAt} /></div>
        </div>
        <div className="rounded-md border border-black/10 bg-white p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#62686d]">Created</div>
          <div className="mt-2 text-sm font-semibold text-[#1d2a2e]">{formatTimestamp(incident.createdAt)}</div>
        </div>
        <div className="rounded-md border border-black/10 bg-white p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#62686d]">Updated</div>
          <div className="mt-2 text-sm font-semibold text-[#1d2a2e]">{formatTimestamp(incident.updatedAt)}</div>
        </div>
        <div className="rounded-md border border-black/10 bg-white p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#62686d]">Incident ID</div>
          <div className="mt-2 break-all text-sm font-mono font-semibold text-[#1d2a2e]">{incident.id}</div>
        </div>
      </div>

      {error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}
      <section className="rounded-md border border-black/10 bg-white p-4">
        <h2 className="text-sm font-bold">Incident details</h2>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#41474b]">{incident.description || incident.summary}</p>
        <dl className="mt-4 grid grid-cols-1 gap-4 text-xs sm:grid-cols-3"><div><dt className="text-[#62686d]">Severity</dt><dd className="mt-1 font-semibold">{incident.severity}</dd></div><div><dt className="text-[#62686d]">Related alert</dt><dd className="mt-1 break-all font-mono">{incident.alertId}</dd></div><div><dt className="text-[#62686d]">Last updated</dt><dd className="mt-1">{new Date(incident.updatedAt).toLocaleString()}</dd></div></dl>
        {canManage && <form onSubmit={saveAssignment} className="mt-5 flex flex-wrap items-end gap-2 border-t border-black/10 pt-4"><label className="text-xs font-medium">Assigned to<input value={assignedTo} onChange={(event) => setAssignedTo(event.target.value)} className="mt-1 block min-w-60 rounded-md border border-black/15 px-3 py-2 text-xs" /></label><button className="rounded-md bg-[#292b2e] px-3 py-2 text-xs font-semibold text-white">Save assignment</button></form>}
      </section>

      <section className="rounded-md border border-black/10 bg-white p-4">
        <h2 className="text-sm font-bold">Related alert</h2>
        <p className="mt-1 text-xs text-[#62686d]">The backend links this incident to an alert. It does not currently provide a verified entity relationship graph.</p>
        <button type="button" onClick={() => navigate(`/alerts/${incident.alertId}`)} className="mt-3 rounded-md border border-black/15 px-3 py-2 text-xs font-semibold text-[#287b70] hover:bg-[#f5f6f6]">Open linked alert</button>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="rounded-md border border-black/10 bg-white p-4">
          <h2 className="text-sm font-bold">Investigation notes</h2>
          {canManage && <form onSubmit={submitNote} className="mt-3 space-y-2"><textarea required rows={3} value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder="Add an investigation note" className="block w-full rounded-md border border-black/15 px-3 py-2 text-xs" /><button className="rounded-md bg-[#287b70] px-3 py-2 text-xs font-semibold text-white">Add note</button></form>}
          <div className="mt-4 divide-y divide-black/5">{notes.map((note) => <article key={note.note_id} className="py-3"><div className="flex justify-between gap-3 text-[11px]"><strong>{note.username}</strong><time className="text-[#73797e]">{new Date(note.created_at).toLocaleString()}</time></div><p className="mt-1 whitespace-pre-wrap text-xs leading-5">{note.content}</p></article>)}{!loading && !notes.length && <p className="py-4 text-xs text-[#73797e]">No investigation notes.</p>}</div>
        </section>
        <section className="rounded-md border border-black/10 bg-white p-4">
          <h2 className="text-sm font-bold">Incident history</h2>
          <div className="mt-3 divide-y divide-black/5">{actions.map((action) => <article key={action.action_id} className="py-3"><div className="flex justify-between gap-3 text-[11px]"><strong>{action.action_type} · {action.username}</strong><time className="text-[#73797e]">{new Date(action.created_at).toLocaleString()}</time></div><p className="mt-1 text-xs">{action.description}</p></article>)}{!loading && !actions.length && <p className="py-4 text-xs text-[#73797e]">No recorded activity.</p>}</div>
          {loading && <p className="mt-3 text-xs text-[#73797e]">Loading activity...</p>}
        </section>
      </div>
    </div>
  </GlassWorkspace>;
};
