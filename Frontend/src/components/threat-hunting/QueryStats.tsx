import { Activity, Clock3, Globe2, Server, UserRound, Zap } from "lucide-react";
import type { HuntStatistics } from "../../types/threatHunting";

const statDefinitions = [
  { key: "eventsScanned", label: "Events scanned", icon: Activity },
  { key: "results", label: "Results", icon: Zap },
  { key: "hosts", label: "Hosts", icon: Server },
  { key: "users", label: "Users", icon: UserRound },
  { key: "externalIps", label: "External IPs", icon: Globe2 },
  { key: "executionMs", label: "Execution", icon: Clock3, suffix: "ms" },
] as const;

export const QueryStats = ({ statistics, completed }: { statistics: HuntStatistics; completed: boolean }) => <section className="grid grid-cols-2 gap-px overflow-hidden rounded border border-white/10 bg-white/10 sm:grid-cols-3 xl:grid-cols-6" aria-label="Query statistics">
  {statDefinitions.map((definition) => {
    const { key, label, icon: Icon } = definition;
    const suffix = "suffix" in definition ? definition.suffix : "";
    return <div key={key} className="bg-[#0b1219] px-3 py-2.5">
    <div className="flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500"><Icon size={11} className="text-cyan-500/80" />{label}</div>
    <div className="mt-1 font-mono text-base font-semibold tabular-nums text-slate-100">{completed ? statistics[key].toLocaleString() : "-"}<span className="ml-1 text-[9px] font-normal text-slate-500">{suffix}</span></div>
  </div>;
  })}
</section>;