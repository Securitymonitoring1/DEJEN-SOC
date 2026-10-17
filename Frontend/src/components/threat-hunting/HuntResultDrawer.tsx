import { useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowUpRight, Check, Clipboard, Crosshair, ExternalLink, Server, Terminal, UserRound, X } from "lucide-react";
import { SeverityBadge } from "../SeverityBadge";
import type { HuntResult, MITRETechnique } from "../../types/threatHunting";
import { EventJsonViewer } from "./EventJsonViewer";

export type HuntEntityType = "HOST" | "USER" | "PROCESS" | "IP";

interface HuntResultDrawerProps {
  result: HuntResult | null;
  relatedAlerts: Array<{ id: string; title: string; eventId: string; severity: string }>;
  canManage: boolean;
  onClose: () => void;
  onInvestigate: (type: HuntEntityType, value: string) => void;
  onViewAlerts: (query: string) => void;
  onViewEvent: (eventId: string) => void;
  onViewIncidents: (eventId: string) => void;
  onCreateAlert: (result: HuntResult) => void;
  onCreateIncident: (result: HuntResult) => void;
  onTechnique: (technique: MITRETechnique) => void;
  mode?: "drawer" | "page";
}

const Detail = ({ label, value }: { label: string; value?: string }) => <div className="min-w-0"><dt className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-1 break-words font-mono text-[11px] text-slate-200">{value || <span className="text-slate-700">Not present in event</span>}</dd></div>;

const eventSummary = (eventType: string, message: string) => {
  const firstLine = message.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "No event summary is available.";
  if (/^an account was successfully logged on\.?$/i.test(firstLine)) return "A sign-in succeeded.";
  if (/^an account failed to log on\.?$/i.test(firstLine)) return "A sign-in attempt failed.";
  if (/^a new process has been created\.?$/i.test(firstLine)) return "A process started.";
  if (/^a user account was created\.?$/i.test(firstLine)) return "A user account was created.";
  if (firstLine.length > 180) return `${eventType.replaceAll("_", " ")} event recorded.`;
  return firstLine;
};

export const HuntResultDrawer = ({ result, relatedAlerts, canManage, onClose, onInvestigate, onViewAlerts, onViewEvent, onViewIncidents, onCreateAlert, onCreateIncident, onTechnique, mode = "drawer" }: HuntResultDrawerProps) => {
  const [copied, setCopied] = useState(false);
  if (!result) return null;
  const copyCommand = async () => {
    if (!result.commandLine) return;
    await navigator.clipboard.writeText(result.commandLine);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  const eventAlerts = relatedAlerts.filter((alert) => alert.eventId === result.eventId);
  const entities: Array<{ type: HuntEntityType; value?: string; label: string; icon: typeof Server }> = [
    { type: "HOST", value: result.host, label: "Investigate Host", icon: Server },
    { type: "USER", value: result.user, label: "Investigate User", icon: UserRound },
    { type: "PROCESS", value: result.process, label: "Investigate Process", icon: Terminal },
    { type: "IP", value: result.sourceIp, label: "Investigate IP", icon: ExternalLink },
  ];
  return <>
    {mode === "drawer" && <button type="button" className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" onClick={onClose} aria-label="Close event details" />}
    <section role={mode === "drawer" ? "dialog" : undefined} aria-modal={mode === "drawer" ? true : undefined} aria-labelledby="hunt-detail-title" className={mode === "page" ? "th-panel mx-auto flex min-h-[min(75vh,760px)] w-full max-w-5xl flex-col overflow-hidden" : "fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l border-white/10 bg-[#0c131a] shadow-2xl max-sm:inset-x-0 max-sm:top-auto max-sm:max-h-[88dvh] max-sm:rounded-t-xl max-sm:border-l-0 max-sm:border-t"}>
      <header className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-4"><div className="min-w-0">{mode === "page" && <button type="button" onClick={onClose} className="mb-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-cyan-500 hover:text-cyan-300"><ArrowLeft size={13} />Back to results</button>}<p className="th-eyebrow">EVENT DETAILS</p><h2 id="hunt-detail-title" className="mt-1 truncate text-sm font-semibold text-slate-100">{result.eventType.replaceAll("_", " ")}</h2><p className="mt-1 font-mono text-[10px] text-slate-500">{new Date(result.timestamp).toLocaleString()}</p></div><div className="flex items-center gap-2"><SeverityBadge severity={result.severity} />{mode === "drawer" && <button type="button" onClick={onClose} className="th-icon-button" aria-label="Close details"><X size={15} /></button>}</div></header>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <section className="rounded border border-white/10 bg-white/[0.025] p-3">
          <h3 className="th-eyebrow">SUMMARY</h3>
          <p className="mt-1 text-xs leading-5 text-slate-200">{eventSummary(result.eventType, result.message)}</p>
          <details className="mt-3 border-t border-white/10 pt-2">
            <summary className="cursor-pointer text-[10px] font-semibold text-slate-400 hover:text-slate-200">View full log message</summary>
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded border border-white/10 bg-[#05090d] p-3 font-mono text-[10px] leading-4 text-slate-300">{result.message || "No raw message recorded."}</pre>
          </details>
        </section>
        <section><h3 className="th-eyebrow mb-3">OBSERVED ENTITIES</h3><dl className="grid grid-cols-2 gap-x-4 gap-y-3"><Detail label="Timestamp" value={new Date(result.timestamp).toLocaleString()} /><Detail label="Host" value={result.host} /><Detail label="User" value={result.user} /><Detail label="Source IP" value={result.sourceIp} /><Detail label="Destination IP" value={result.destinationIp} /><Detail label="Process" value={result.process} /><Detail label="Parent Process" value={result.parentProcess} /><Detail label="Event ID" value={result.eventId} /></dl></section>
        {result.commandLine && <section className="border-t border-white/10 pt-3"><div className="mb-2 flex items-center justify-between"><h3 className="th-eyebrow">COMMAND LINE</h3><button type="button" onClick={copyCommand} className="th-button !px-2 !py-1">{copied ? <Check size={12} /> : <Clipboard size={12} />}{copied ? "Copied" : "Copy"}</button></div><pre className="overflow-x-auto rounded border border-white/10 bg-[#05090d] p-3 font-mono text-[10px] leading-5 text-cyan-100">{result.commandLine}</pre></section>}
        <section className="border-t border-white/10 pt-3"><h3 className="th-eyebrow mb-2">MITRE ATT&CK</h3>{result.mitreTechnique ? <button type="button" onClick={() => onTechnique(result.mitreTechnique!)} className="flex w-full items-center justify-between rounded border border-cyan-400/20 bg-cyan-400/[0.06] p-3 text-left hover:border-cyan-400/40"><span><span className="block font-mono text-xs font-semibold text-cyan-300">{result.mitreTechnique.id} · {result.mitreTechnique.name}</span><span className="mt-1 block text-[10px] text-slate-500">{result.mitreTechnique.tactic}</span></span><Crosshair size={15} className="text-cyan-400" /></button> : <p className="text-[10px] text-slate-600">No technique mapped by available event details.</p>}</section>
        {result.mitreTechnique && <section className="grid grid-cols-3 gap-2 rounded border border-white/10 p-3 text-center"><div><p className="font-mono text-sm text-slate-100">1</p><p className="text-[9px] text-slate-500">Related event</p></div><div><p className="font-mono text-sm text-slate-100">{result.host ? 1 : 0}</p><p className="text-[9px] text-slate-500">Related host</p></div><div><p className="font-mono text-sm text-slate-100">{eventAlerts.length}</p><p className="text-[9px] text-slate-500">Related alerts</p></div></section>}
        {eventAlerts.length > 0 && <section className="border-t border-white/10 pt-3"><h3 className="th-eyebrow mb-2">RELATED ALERTS</h3>{eventAlerts.map((alert) => <button key={alert.id} type="button" onClick={() => onViewAlerts(alert.title)} className="mb-1 flex w-full items-center justify-between gap-3 rounded border border-white/10 p-2 text-left text-[10px] text-slate-300 hover:border-cyan-400/30"><span className="truncate">{alert.title}</span><span className="shrink-0 text-[9px] text-rose-300">{alert.severity}</span></button>)}</section>}
        <section className="border-t border-white/10 pt-3"><h3 className="th-eyebrow mb-2">INVESTIGATE ENTITY</h3><div className="grid grid-cols-2 gap-2">{entities.map(({ type, value, label, icon: Icon }) => <button key={type} type="button" disabled={!value} onClick={() => value && onInvestigate(type, value)} className="th-button justify-start disabled:cursor-not-allowed disabled:opacity-35"><Icon size={12} />{label}<ArrowUpRight size={11} className="ml-auto" /></button>)}</div></section>
        <EventJsonViewer result={result} />
      </div>
      <footer className="flex flex-wrap gap-2 border-t border-white/10 bg-[#090f15] p-3"><button type="button" onClick={() => onViewEvent(result.eventId)} className="th-button"><ExternalLink size={13} />Open Event</button><button type="button" onClick={() => onViewAlerts(result.eventId)} className="th-button"><ExternalLink size={13} />Related Alerts</button><button type="button" onClick={() => onViewIncidents(result.eventId)} className="th-button"><ExternalLink size={13} />Related Incidents</button>{canManage && <button type="button" onClick={() => onCreateAlert(result)} className="th-button"><AlertTriangle size={13} />Create Alert</button>}{canManage && <button type="button" onClick={() => onCreateIncident(result)} className="th-run-button ml-auto">Create Incident<ArrowUpRight size={13} /></button>}</footer>
    </section>
  </>;
};