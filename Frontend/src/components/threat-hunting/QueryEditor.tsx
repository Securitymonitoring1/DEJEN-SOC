import { useRef } from "react";
import { BookmarkPlus, Braces, Play, Trash2 } from "lucide-react";

const suggestions = ["event.category", "event.type", "process.name", "process.command_line", "user.name", "host", "severity", "message", "timestamp", "source.ip", "AND", "OR", "CONTAINS"];
const queryTokenPattern = /("[^"\n]*"|'[^'\n]*'|\b(?:AND|OR|CONTAINS|NOT)\b|[=!]+|[\w.]+)/gi;

const highlightQuery = (value: string) => value.split(queryTokenPattern).map((part, index) => {
  if (/^("|').*\1$/.test(part)) return <span key={index} className="text-emerald-300">{part}</span>;
  if (/^(AND|OR|CONTAINS|NOT)$/i.test(part)) return <span key={index} className="font-semibold text-violet-300">{part}</span>;
  if (/^[=!]+$/.test(part)) return <span key={index} className="text-amber-300">{part}</span>;
  if (/^[\w.]+$/.test(part)) return <span key={index} className="text-sky-300">{part}</span>;
  return <span key={index}>{part}</span>;
});

interface QueryEditorProps {
  query: string;
  error: { line: number; message: string } | null;
  running: boolean;
  onQueryChange: (query: string) => void;
  onRun: () => void;
  onClear: () => void;
  onSave: () => void;
}

export const QueryEditor = ({ query, error, running, onQueryChange, onRun, onClear, onSave }: QueryEditorProps) => {
  const editor = useRef<HTMLTextAreaElement>(null);
  const highlightedQuery = useRef<HTMLPreElement>(null);
  const lineCount = Math.max(5, query.split("\n").length);
  const formatQuery = () => onQueryChange(query.replace(/\s+(AND|OR)\s+/gi, "\n$1 ").replace(/[ \t]+/g, " ").trim());
  const insertSuggestion = (value: string) => {
    const input = editor.current;
    if (!input) return;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    onQueryChange(`${query.slice(0, start)}${value}${query.slice(end)}`);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(start + value.length, start + value.length);
    });
  };
  return <section className="th-panel overflow-hidden" aria-label="Hunting query editor">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
      <div className="flex items-center gap-2"><span className="th-live-dot" /><div><p className="th-eyebrow">HUNTING QUERY</p><p className="mt-0.5 text-xs text-slate-400">Telemetry search workspace</p></div></div>
      <span className="rounded border border-white/10 px-2 py-1 text-[10px] font-medium text-slate-500">DEJEN Query</span>
    </div>
    <div className="flex items-center justify-between border-b border-white/5 bg-[#0a1118] px-4 py-2">
      <span className="font-mono text-[10px] text-slate-500">hunt.query <span className="text-cyan-500">●</span></span>
      <button type="button" onClick={formatQuery} className="th-icon-button" title="Format query" aria-label="Format query"><Braces size={14} /></button>
    </div>
    <div className="grid grid-cols-[38px_minmax(0,1fr)] bg-[#080e14]">
      <div aria-hidden="true" className="select-none border-r border-white/5 py-3 text-right font-mono text-[11px] leading-6 text-slate-600">{Array.from({ length: lineCount }, (_, index) => <div key={index} className={`pr-3 ${error?.line === index + 1 ? "text-rose-400" : ""}`}>{index + 1}</div>)}</div>
      <div className="relative min-w-0">
        <pre ref={highlightedQuery} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words px-4 py-3 font-mono text-xs leading-6">{highlightQuery(query)}</pre>
        <textarea ref={editor} value={query} onChange={(event) => onQueryChange(event.target.value)} onScroll={(event) => { if (highlightedQuery.current) highlightedQuery.current.scrollTop = event.currentTarget.scrollTop; }} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); onRun(); } if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "f") { event.preventDefault(); formatQuery(); } }} spellCheck={false} aria-label="Hunt query" aria-describedby="hunt-query-error" placeholder={'event.category = "process"\nAND process.name = "powershell.exe"\nAND process.command_line CONTAINS "EncodedCommand"'} className="relative z-10 min-h-36 w-full resize-y bg-transparent px-4 py-3 font-mono text-xs leading-6 text-transparent caret-cyan-300 outline-none selection:bg-cyan-400/25 placeholder:text-slate-700 placeholder:[-webkit-text-fill-color:#334155]" />
      </div>
    </div>
    {error && <p id="hunt-query-error" role="alert" className="flex items-center gap-2 border-t border-rose-400/20 bg-rose-950/30 px-4 py-2 text-[11px] text-rose-300"><span className="font-semibold">Query Error</span><span>Line {error.line || 1}: {error.message}</span></p>}
    <div className="border-t border-white/5 px-4 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-2"><span className="text-[9px] font-semibold uppercase tracking-widest text-slate-600">Autocomplete</span><span className="text-[9px] text-slate-600">Ctrl/⌘ + Enter to run · Ctrl/⌘ + Shift + F to format</span></div>
      <div className="flex flex-wrap gap-1">{suggestions.map((item) => <button type="button" key={item} onClick={() => insertSuggestion(item)} className="rounded border border-white/5 px-1.5 py-1 font-mono text-[9px] text-slate-500 hover:border-cyan-500/30 hover:text-cyan-300">{item}</button>)}</div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 bg-[#0b1219] px-4 py-3">
      <div className="flex gap-2"><button type="button" onClick={onClear} className="th-button"><Trash2 size={13} />Clear</button><button type="button" onClick={onSave} className="th-button"><BookmarkPlus size={13} />Save Query</button></div>
      <button type="button" onClick={onRun} disabled={running} className="th-run-button"><Play size={13} fill="currentColor" />{running ? "Running Hunt..." : "Run Hunt"}<span aria-hidden="true">→</span></button>
    </div>
  </section>;
};