import { Crosshair } from "lucide-react";
import type { MITRETechnique } from "../../types/threatHunting";

export const MitreTechnique = ({ technique, onClick }: { technique?: MITRETechnique; onClick?: (technique: MITRETechnique) => void }) => technique ? <button type="button" onClick={(event) => { event.stopPropagation(); onClick?.(technique); }} className="group inline-flex min-w-20 flex-col items-start rounded border border-cyan-500/20 bg-cyan-500/[0.06] px-1.5 py-1 text-left hover:border-cyan-400/45" title={`${technique.name} · ${technique.tactic}`}>
  <span className="flex items-center gap-1 font-mono text-[9px] font-semibold text-cyan-300"><Crosshair size={10} />{technique.id}</span><span className="max-w-28 truncate text-[8px] text-slate-500 group-hover:text-slate-300">{technique.name}</span>
</button> : <span className="text-slate-600">-</span>;