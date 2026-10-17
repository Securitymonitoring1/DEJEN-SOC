import { useEffect, useMemo, useState } from "react";
import { Activity, AlertTriangle, ArrowLeft, CalendarClock, Clock3, Flame, RefreshCw, ShieldAlert, X } from "lucide-react";
import { alertsApi, eventsApi, huntingApi } from "../services/api";
import type { HuntQuery, HuntResult, MITRETechnique } from "../types/threatHunting";
import { GlassWorkspace } from "../components/layout/GlassWorkspace";
import { useSoc } from "../context/SocContext";
import { toHuntResult, useThreatHunting, HUNT_PRESETS } from "../hooks/useThreatHunting";
import { HuntPresets } from "../components/threat-hunting/HuntPresets";
import { HuntResultsTable } from "../components/threat-hunting/HuntResultsTable";
import { HuntResultDrawer, type HuntEntityType } from "../components/threat-hunting/HuntResultDrawer";
import { HuntTimeline, type HuntTimelineRange } from "../components/threat-hunting/HuntTimeline";
import { MitreTechnique } from "../components/threat-hunting/MitreTechnique";
import { QueryEditor } from "../components/threat-hunting/QueryEditor";
import { QueryStats } from "../components/threat-hunting/QueryStats";
import "../components/threat-hunting/ThreatHunting.css";

type HeaderRange = "24h" | "7d" | "30d" | "custom";
interface HuntAlertView {
  id: string;
  alert_id?: string;
  title: string;
  eventId: string;
  severity: string;
}

const defaultQuery = 'severity = "CRITICAL"\nAND message CONTAINS "powershell"';
const getRangeStart = (range: HeaderRange, customStart: string) => {
  if (range === "custom") return customStart ? new Date(`${customStart}T00:00:00`).toISOString() : undefined;
  const duration = range === "24h" ? 24 : range === "7d" ? 24 * 7 : 24 * 30;
  return new Date(Date.now() - duration * 60 * 60 * 1000).toISOString();
};
const getRangeEnd = (range: HeaderRange, customEnd: string) => range === "custom" && customEnd
  ? new Date(`${customEnd}T23:59:59.999`).toISOString()
  : undefined;

export const ThreatHunting = () => {
  const { alerts, createIncident, currentRoute, currentUser, navigate, refreshData, routeParams } = useSoc();
  const { results, statistics, isRunning, error, execution, runQuery, clearResults } = useThreatHunting();
  const [query, setQuery] = useState(defaultQuery);
  const [headerRange, setHeaderRange] = useState<HeaderRange>("30d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [savedQueries, setSavedQueries] = useState<HuntQuery[]>(() => huntingApi.getSavedQueries());
  const [selectedResult, setSelectedResult] = useState<HuntResult | null>(null);
  const [technique, setTechnique] = useState<MITRETechnique | null>(null);
  const [timelineRange, setTimelineRange] = useState<HuntTimelineRange>("24h");
  const [timeWindow, setTimeWindow] = useState<[number, number] | null>(null);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [incidentDraft, setIncidentDraft] = useState<HuntResult | null>(null);
  const [incidentTitle, setIncidentTitle] = useState("");
  const [incidentSeverity, setIncidentSeverity] = useState("HIGH");
  const [incidentBusy, setIncidentBusy] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const canManage = ["ADMIN", "ANALYST"].includes(currentUser?.role);
  const typedAlerts = alerts as HuntAlertView[];
  const eventAlerts = useMemo(() => typedAlerts.map((alert) => ({ id: alert.id, title: alert.title, eventId: alert.eventId, severity: alert.severity })), [alerts]);

  useEffect(() => {
    if (currentRoute !== "/hunting/:id" || !routeParams.id) return;
    let active = true;
    const match = results.find((item) => item.eventId === routeParams.id);
    if (match) {
      setSelectedResult(match);
      setDetailError("");
      setDetailLoading(false);
      return () => { active = false; };
    }
    setDetailLoading(true);
    setDetailError("");
    eventsApi.getById(routeParams.id)
      .then((event) => { if (active) setSelectedResult(toHuntResult(event)); })
      .catch((requestError) => { if (active) setDetailError(requestError instanceof Error ? requestError.message : "Could not load this hunt result."); })
      .finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [currentRoute, routeParams.id, results]);

  const run = () => {
    if (headerRange === "custom" && (!customStart || !customEnd || customEnd < customStart)) {
      setActionError("Choose a valid custom range with an end date on or after the start date.");
      return;
    }
    setTimeWindow(null);
    setActionError("");
    setNotice("");
    void runQuery(query, getRangeStart(headerRange, customStart), getRangeEnd(headerRange, customEnd));
  };
  const saveQuery = () => {
    const name = window.prompt("Name this hunting query", HUNT_PRESETS.find((preset) => preset.query === query)?.name || "Saved hunt");
    if (!name?.trim()) return;
    const saved: HuntQuery = { id: crypto.randomUUID(), name: name.trim(), query, language: "DEJEN Query", createdAt: new Date().toISOString() };
    setSavedQueries(huntingApi.saveQuery(saved));
    setNotice(`Saved hunt: ${saved.name}`);
  };
  const refresh = async () => {
    setActionError("");
    setNotice("");
    try {
      await refreshData();
      if (execution) await runQuery(query, getRangeStart(headerRange, customStart), getRangeEnd(headerRange, customEnd));
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Could not refresh telemetry.");
    }
  };
  const viewAlerts = (term: string) => {
    setSelectedResult(null);
    navigate(`/alerts?query=${encodeURIComponent(term)}`);
  };
  const viewEvent = (eventId: string) => {
    setSelectedResult(null);
    navigate(`/event-viewer?query=${encodeURIComponent(eventId)}`);
  };
  const viewIncidents = (eventId: string) => {
    setSelectedResult(null);
    navigate(`/incidents?query=${encodeURIComponent(eventId)}`);
  };
  const investigate = (type: HuntEntityType, value: string) => {
    if (!selectedResult) return;
    const params = new URLSearchParams({ type, entity: value });
    if (selectedResult.host) params.set("host", selectedResult.host);
    if (selectedResult.user) params.set("user", selectedResult.user);
    if (selectedResult.process) params.set("process", selectedResult.process);
    if (selectedResult.sourceIp) params.set("ip", selectedResult.sourceIp);
    setSelectedResult(null);
    navigate(`/investigation?${params.toString()}`);
  };
  const createAlert = async (result: HuntResult) => {
    setActionError("");
    try {
      const existing = typedAlerts.find((alert) => alert.eventId === result.eventId);
      if (existing) {
        setNotice("An alert already exists for this event.");
        navigate(`/alerts/${existing.id}`);
        return;
      }
      const alert = await alertsApi.create({
        event_id: result.eventId,
        rule_name: "Threat Hunting - Analyst Finding",
        title: `Hunt finding: ${result.host || result.eventType}`,
        description: `${result.message}${result.mitreTechnique ? ` MITRE ATT&CK ${result.mitreTechnique.id}: ${result.mitreTechnique.name}.` : ""}`,
        severity: result.severity,
        risk_score: result.severity === "CRITICAL" ? 95 : result.severity === "HIGH" ? 80 : result.severity === "MEDIUM" ? 55 : 25,
      });
      await refreshData();
      setNotice("Alert created from this hunt result.");
      navigate(`/alerts/${alert.alert_id}`);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Could not create an alert.");
    }
  };
  const openIncidentForm = (result: HuntResult) => {
    setIncidentDraft(result);
    setIncidentTitle(`Threat hunt: ${result.host || result.eventType}`);
    setIncidentSeverity(result.severity === "LOW" ? "MEDIUM" : result.severity);
    setActionError("");
  };
  const submitIncident = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!incidentDraft) return;
    setIncidentBusy(true);
    setActionError("");
    try {
      const existingAlert = typedAlerts.find((alert) => alert.eventId === incidentDraft.eventId);
      const relatedAlert = existingAlert || await alertsApi.create({
        event_id: incidentDraft.eventId,
        rule_name: "Threat Hunting - Analyst Finding",
        title: incidentTitle,
        description: incidentDraft.message,
        severity: incidentSeverity,
        risk_score: incidentSeverity === "CRITICAL" ? 95 : incidentSeverity === "HIGH" ? 80 : 55,
      });
      const incident = await createIncident({
        alert_id: "id" in relatedAlert ? relatedAlert.id : relatedAlert.alert_id!,
        title: incidentTitle,
        severity: incidentSeverity,
        description: [incidentDraft.message, `Affected host: ${incidentDraft.host || "Not recorded"}`, `User: ${incidentDraft.user || "Not recorded"}`, `Source IP: ${incidentDraft.sourceIp || "Not recorded"}`, `Related event: ${incidentDraft.eventId}`, `MITRE ATT&CK: ${incidentDraft.mitreTechnique ? `${incidentDraft.mitreTechnique.id} ${incidentDraft.mitreTechnique.name}` : "Not mapped"}`].join("\n"),
      });
      await refreshData();
      setIncidentDraft(null);
      navigate(`/incidents/${incident.id}`);
    } catch (requestError) {
      setActionError(requestError instanceof Error ? requestError.message : "Could not create an incident.");
    } finally {
      setIncidentBusy(false);
    }
  };

  return <GlassWorkspace>
    <div className="threat-hunting-theme">
    {currentRoute === "/hunting/:id" ? selectedResult?.eventId === routeParams.id ? <HuntResultDrawer mode="page" result={selectedResult} relatedAlerts={eventAlerts} canManage={canManage} onClose={() => { setSelectedResult(null); navigate("/hunting"); }} onInvestigate={investigate} onViewAlerts={viewAlerts} onViewEvent={viewEvent} onViewIncidents={viewIncidents} onCreateAlert={createAlert} onCreateIncident={openIncidentForm} onTechnique={setTechnique} /> : <div className="threat-hunting-page mx-auto max-w-5xl py-6" role="status">{detailLoading ? <p className="text-sm text-slate-500">Loading event details...</p> : <><p className="text-sm text-rose-500">{detailError || "Event details are unavailable."}</p><button type="button" onClick={() => navigate("/hunting")} className="th-button mt-3"><ArrowLeft size={13} />Back to results</button></>}</div> :
    <div className="threat-hunting-page space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-3">
        <div className="min-w-0"><p className="th-eyebrow">DEJEN / PROACTIVE DETECTION</p><h1 className="mt-1 text-xl font-semibold text-slate-100">Threat Hunting</h1></div>
        <div className="flex flex-wrap items-center gap-1.5"><label className="flex items-center gap-1.5 text-[9px] text-slate-500"><CalendarClock size={12} /><select value={headerRange} onChange={(event) => setHeaderRange(event.target.value as HeaderRange)} className="th-select">{[["24h", "Last 24 Hours"], ["7d", "Last 7 Days"], ["30d", "Last 30 Days"], ["custom", "Custom Range"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>{headerRange === "custom" && <><input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} aria-label="Custom start date" className="th-select" /><input type="date" value={customEnd} min={customStart || undefined} onChange={(event) => setCustomEnd(event.target.value)} aria-label="Custom end date" className="th-select" /></>}<button type="button" onClick={refresh} className="th-button"><RefreshCw size={12} />Refresh</button></div>
      </header>
      <nav aria-label="Hunt data views" className="flex flex-wrap gap-2">
        <button type="button" onClick={() => navigate("/event-viewer")} className="th-button"><Activity size={12} />Events</button>
        <button type="button" onClick={() => navigate("/alerts")} className="th-button"><ShieldAlert size={12} />Alerts</button>
        <button type="button" onClick={() => navigate("/incidents")} className="th-button"><Flame size={12} />Incidents</button>
      </nav>
      <QueryEditor query={query} error={error} running={isRunning} onQueryChange={setQuery} onRun={run} onClear={() => { setQuery(""); clearResults(); }} onSave={saveQuery} />
      <HuntPresets presets={HUNT_PRESETS} saved={savedQueries} onSelect={(value) => { setQuery(value); clearResults(); setNotice(""); }} />
      <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 text-[10px] text-slate-500" aria-live="polite">{isRunning ? <span className="inline-flex items-center gap-2 text-cyan-300"><span className="th-spinner" />Searching...</span> : execution ? <span className="inline-flex items-center gap-1.5 text-emerald-300"><Activity size={12} />{statistics.eventsScanned.toLocaleString()} events searched · {statistics.results.toLocaleString()} matches</span> : <span className="inline-flex items-center gap-1.5"><Clock3 size={12} />Ready</span>}{notice && <span className="text-cyan-300">{notice}</span>}</div>
      <details className="px-0.5">
        <summary className="w-fit cursor-pointer text-[10px] font-medium text-slate-500 hover:text-slate-300">Search details</summary>
        <div className="mt-2 space-y-2">
          <QueryStats statistics={statistics} completed={Boolean(execution)} />
          <HuntTimeline results={results} range={timelineRange} selectedBucket={timeWindow ? timeWindow[0] : null} onRangeChange={setTimelineRange} onSelectBucket={(start, end) => setTimeWindow(start === 0 && end === 0 ? null : [start, end])} />
        </div>
      </details>
      {(actionError || error?.line === 0) && <p role="alert" className="rounded border border-rose-400/20 bg-rose-950/25 px-3 py-2 text-xs text-rose-300"><AlertTriangle size={13} className="mr-1 inline" />{actionError || error?.message}</p>}
      <HuntResultsTable results={results} completed={Boolean(execution)} selectedId={selectedResult?.id} timeWindow={timeWindow} onSelect={(result) => { setSelectedResult(result); navigate(`/hunting/${result.eventId}`); }} onTechnique={setTechnique} />
    </div>
    }
    {technique && <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" onClick={() => setTechnique(null)}><section role="dialog" aria-modal="true" aria-labelledby="technique-title" onClick={(event) => event.stopPropagation()} className="th-panel w-full max-w-md p-4 shadow-2xl"><div className="flex items-start justify-between"><div><p className="th-eyebrow">MITRE ATT&CK TECHNIQUE</p><h2 id="technique-title" className="mt-2 font-mono text-lg font-semibold text-cyan-300">{technique.id}</h2><p className="mt-1 text-sm text-slate-100">{technique.name}</p></div><button type="button" onClick={() => setTechnique(null)} className="th-icon-button" aria-label="Close technique details"><X size={14} /></button></div><dl className="mt-4 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-center"><div><dt className="text-[9px] uppercase text-slate-500">Tactic</dt><dd className="mt-1 text-[11px] text-slate-200">{technique.tactic}</dd></div><div><dt className="text-[9px] uppercase text-slate-500">Related events</dt><dd className="mt-1 font-mono text-[11px] text-slate-200">{results.filter((item) => item.mitreTechnique?.id === technique.id).length}</dd></div><div><dt className="text-[9px] uppercase text-slate-500">Related alerts</dt><dd className="mt-1 font-mono text-[11px] text-slate-200">{typedAlerts.filter((alert) => results.some((item) => item.eventId === alert.eventId && item.mitreTechnique?.id === technique.id)).length}</dd></div></dl><div className="mt-3 flex flex-wrap gap-1">{results.filter((item) => item.mitreTechnique?.id === technique.id).map((item) => <MitreTechnique key={item.id} technique={item.mitreTechnique} />)}</div></section></div>}
    {incidentDraft && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 p-4" onClick={() => !incidentBusy && setIncidentDraft(null)}><form onSubmit={submitIncident} onClick={(event) => event.stopPropagation()} className="th-panel w-full max-w-lg space-y-3 p-4 shadow-2xl"><div className="flex items-start justify-between"><div><p className="th-eyebrow">ANALYST CONFIRMATION</p><h2 className="mt-1 text-sm font-semibold text-slate-100">Create incident from hunt result</h2><p className="mt-1 text-[10px] text-slate-500">Review the prefilled context before creating a backend incident.</p></div><button type="button" disabled={incidentBusy} onClick={() => setIncidentDraft(null)} className="th-icon-button" aria-label="Close incident form"><X size={14} /></button></div>
      <label className="block text-[10px] font-medium text-slate-400">Incident title<input required maxLength={255} value={incidentTitle} onChange={(event) => setIncidentTitle(event.target.value)} className="th-input mt-1" /></label><label className="block text-[10px] font-medium text-slate-400">Severity<select value={incidentSeverity} onChange={(event) => setIncidentSeverity(event.target.value)} className="th-select mt-1 block w-full">{["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((item) => <option key={item}>{item}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-2 rounded border border-white/10 bg-white/[0.025] p-3 font-mono text-[10px] text-slate-400"><span>Host: {incidentDraft.host || "Not recorded"}</span><span>User: {incidentDraft.user || "Not recorded"}</span><span>Source IP: {incidentDraft.sourceIp || "Not recorded"}</span><span>Event: {incidentDraft.eventId.slice(0, 12)}...</span><span className="col-span-2">MITRE: {incidentDraft.mitreTechnique ? `${incidentDraft.mitreTechnique.id} ${incidentDraft.mitreTechnique.name}` : "Not mapped"}</span></div>
      {(actionError || error) && <p role="alert" className="text-xs text-rose-300">{actionError || error?.message}</p>}<div className="flex justify-end gap-2"><button type="button" disabled={incidentBusy} onClick={() => setIncidentDraft(null)} className="th-button">Cancel</button><button type="submit" disabled={incidentBusy} className="th-run-button">{incidentBusy ? "Creating..." : "Confirm and create incident"}</button></div>
    </form></div>}
    </div>
  </GlassWorkspace>;
};