import { useState } from "react";
import { Check, ChevronDown, ChevronRight, Copy } from "lucide-react";
import type { HuntResult } from "../../types/threatHunting";

export const EventJsonViewer = ({ result }: { result: HuntResult }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const json = JSON.stringify(result.rawEvent, null, 2);
  const copy = async () => {
    await navigator.clipboard.writeText(json);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  return <section className="border-t border-white/10 pt-3">
    <div className="flex items-center justify-between"><button type="button" onClick={() => setOpen((value) => !value)} className="flex items-center gap-2 text-xs font-semibold text-slate-200">{open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}Raw Event</button>{open && <button type="button" onClick={copy} className="th-button !px-2 !py-1">{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? "Copied" : "Copy JSON"}</button>}</div>
    {open && <pre className="mt-2 max-h-64 overflow-auto rounded border border-white/10 bg-[#060b10] p-3 font-mono text-[10px] leading-5 text-cyan-100">{json}</pre>}
  </section>;
};