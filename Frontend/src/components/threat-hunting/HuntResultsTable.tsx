import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Search, Settings2 } from "lucide-react";
import { SeverityBadge } from "../SeverityBadge";
import type { HuntResult } from "../../types/threatHunting";
import { MitreTechnique } from "./MitreTechnique";

const columns = ["Timestamp", "Severity", "Event Type", "Host", "User", "Source IP", "Destination IP", "Process", "Command", "MITRE"] as const;
type Column = typeof columns[number];
const valueFor = (row: HuntResult, column: Column) => ({ Timestamp: row.timestamp, Severity: row.severity, "Event Type": row.eventType, Host: row.host, User: row.user, "Source IP": row.sourceIp, "Destination IP": row.destinationIp, Process: row.process, Command: row.commandLine, MITRE: row.mitreTechnique?.id }[column] || "");

interface HuntResultsTableProps {
  results: HuntResult[];
  completed: boolean;
  selectedId?: string;
  timeWindow?: [number, number] | null;
  onSelect: (result: HuntResult) => void;
  onTechnique: (technique: NonNullable<HuntResult["mitreTechnique"]>) => void;
}

export const HuntResultsTable = ({ results, completed, selectedId, timeWindow, onSelect, onTechnique }: HuntResultsTableProps) => {
  const [search, setSearch] = useState("");
  const [severity, setSeverity] = useState("ALL");
  const [visibleColumns, setVisibleColumns] = useState<Column[]>([...columns]);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ column: Column; direction: "asc" | "desc" }>({ column: "Timestamp", direction: "desc" });
  const pageSize = 12;
  const filtered = useMemo(() => results.filter((row) => {
    const searchable = [row.eventType, row.host, row.user, row.sourceIp, row.destinationIp, row.process, row.commandLine, row.message, row.mitreTechnique?.id].filter(Boolean).join(" ").toLowerCase();
    const time = new Date(row.timestamp).getTime();
    return (severity === "ALL" || row.severity === severity) && (!search || searchable.includes(search.toLowerCase())) && (!timeWindow || (time >= timeWindow[0] && time < timeWindow[1]));
  }).sort((first, second) => {
    const a = valueFor(first, sort.column).toLowerCase();
    const b = valueFor(second, sort.column).toLowerCase();
    return (a < b ? -1 : a > b ? 1 : 0) * (sort.direction === "asc" ? 1 : -1);
  }), [results, search, severity, timeWindow, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleRows = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const exportCsv = () => {
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const csv = [visibleColumns.join(","), ...filtered.map((row) => visibleColumns.map((column) => escape(valueFor(row, column))).join(","))].join("\n");
    const href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = "dejen-hunt-results.csv";
    anchor.click();
    URL.revokeObjectURL(href);
  };
  const toggleColumn = (column: Column) => setVisibleColumns((current) => current.includes(column) ? current.filter((item) => item !== column) : [...current, column]);
  const toggleSort = (column: Column) => setSort((current) => ({ column, direction: current.column === column && current.direction === "desc" ? "asc" : "desc" }));
  return <section className="th-panel min-w-0 overflow-hidden" aria-label="Hunt results">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2.5">
      <div><p className="th-eyebrow">MATCHED TELEMETRY</p><p className="mt-0.5 text-[10px] text-slate-500">{filtered.length.toLocaleString()} records · select a row to inspect</p></div>
      <div className="flex flex-wrap items-center gap-1.5">
        <label className="flex items-center gap-1.5 rounded border border-white/10 px-2 py-1.5 text-slate-500"><Search size={12} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }} placeholder="Search results" className="w-28 bg-transparent text-[10px] text-slate-200 outline-none placeholder:text-slate-600 sm:w-36" /></label>
        <select value={severity} onChange={(event) => { setSeverity(event.target.value); setPage(0); }} className="th-select !py-1.5 !text-[10px]">{["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((item) => <option key={item}>{item}</option>)}</select>
        <div className="relative"><button type="button" onClick={() => setColumnsOpen((value) => !value)} className="th-button !px-2 !py-1.5" title="Configure columns"><Settings2 size={12} /><span className="hidden sm:inline">Columns</span><ChevronDown size={10} /></button>{columnsOpen && <div className="absolute right-0 z-20 mt-1 max-h-72 w-44 overflow-y-auto rounded border border-white/10 bg-[#101820] p-2 shadow-xl">{columns.map((column) => <label key={column} className="flex items-center gap-2 py-1 text-[10px] text-slate-300"><input type="checkbox" checked={visibleColumns.includes(column)} onChange={() => toggleColumn(column)} className="accent-cyan-400" />{column}</label>)}</div>}</div>
        <button type="button" onClick={exportCsv} disabled={!filtered.length} className="th-button !px-2 !py-1.5"><Download size={12} /><span className="hidden sm:inline">CSV</span></button>
      </div>
    </div>
    <div className="max-h-[min(52vh,560px)] overflow-auto">
      <table className="w-full min-w-[980px] border-collapse text-left text-[10px]">
        <thead className="sticky top-0 z-10 bg-[#101820] text-[9px] uppercase tracking-wider text-slate-500"><tr><th className="w-8 px-2 py-2"><input type="checkbox" aria-label="Select all results" checked={visibleRows.length > 0 && visibleRows.every((row) => selected.includes(row.id))} onChange={(event) => setSelected(event.target.checked ? [...new Set([...selected, ...visibleRows.map((row) => row.id)])] : selected.filter((id) => !visibleRows.some((row) => row.id === id)))} className="accent-cyan-400" /></th>{visibleColumns.map((column) => <th key={column} className="whitespace-nowrap px-2 py-2"><button type="button" onClick={() => toggleSort(column)} className="inline-flex items-center gap-1 hover:text-cyan-300">{column}{sort.column === column && <span>{sort.direction === "desc" ? "↓" : "↑"}</span>}</button></th>)}</tr></thead>
        <tbody className="divide-y divide-white/[0.045]">{visibleRows.map((row) => <tr key={row.id} onClick={() => onSelect(row)} className={`cursor-pointer transition hover:bg-cyan-400/[0.045] ${selectedId === row.id ? "bg-cyan-400/[0.08]" : ""}`}>
          <td className="px-2 py-2" onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selected.includes(row.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))} aria-label={`Select ${row.eventType} event`} className="accent-cyan-400" /></td>
          {visibleColumns.map((column) => <td key={column} className="max-w-52 truncate px-2 py-2 font-mono text-slate-300" title={String(valueFor(row, column) || row.message)}>{column === "Timestamp" ? new Date(row.timestamp).toLocaleString() : column === "Severity" ? <SeverityBadge severity={row.severity} /> : column === "MITRE" ? <MitreTechnique technique={row.mitreTechnique} onClick={onTechnique} /> : valueFor(row, column) || <span className="text-slate-700">-</span>}</td>)}
        </tr>)}{!visibleRows.length && <tr><td colSpan={visibleColumns.length + 1} className="px-3 py-10 text-center text-xs text-slate-500">{results.length ? "No rows match the current filters." : completed ? "No events matched this hunt. Try a broader query or longer time range." : "Run a hunt to search available security telemetry."}</td></tr>}</tbody>
      </table>
    </div>
    <div className="flex items-center justify-between border-t border-white/10 px-3 py-2 text-[10px] text-slate-500"><span>{selected.length} selected</span><div className="flex items-center gap-2"><span>Page {page + 1} of {pageCount}</span><button type="button" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} aria-label="Previous page" className="th-icon-button"><ChevronLeft size={14} /></button><button type="button" disabled={page + 1 >= pageCount} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} aria-label="Next page" className="th-icon-button"><ChevronRight size={14} /></button></div></div>
  </section>;
};