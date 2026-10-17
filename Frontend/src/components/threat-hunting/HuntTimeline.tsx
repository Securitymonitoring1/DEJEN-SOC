import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { HuntResult } from "../../types/threatHunting";

export type HuntTimelineRange = "1h" | "6h" | "24h" | "7d" | "30d";
const durations: Record<HuntTimelineRange, number> = { "1h": 60 * 60_000, "6h": 6 * 60 * 60_000, "24h": 24 * 60 * 60_000, "7d": 7 * 24 * 60 * 60_000, "30d": 30 * 24 * 60 * 60_000 };

interface HuntTimelineProps {
  results: HuntResult[];
  range: HuntTimelineRange;
  selectedBucket: number | null;
  onRangeChange: (range: HuntTimelineRange) => void;
  onSelectBucket: (from: number, to: number) => void;
}

export const HuntTimeline = ({ results, range, selectedBucket, onRangeChange, onSelectBucket }: HuntTimelineProps) => {
  const now = Date.now();
  const buckets = Array.from({ length: 12 }, (_, index) => {
    const end = now - (11 - index) * durations[range] / 12;
    const start = end - durations[range] / 12;
    return { time: new Date(end).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), start, end, events: results.filter((item) => { const timestamp = new Date(item.timestamp).getTime(); return timestamp >= start && timestamp < end; }).length };
  });
  return <section className="th-panel px-3 pb-2 pt-3" aria-label="Hunt result timeline">
    <div className="mb-1 flex flex-wrap items-center justify-between gap-2"><div><p className="th-eyebrow">HUNT TIMELINE</p><p className="mt-0.5 text-[10px] text-slate-500">Select a bucket to focus the result list</p></div><div className="flex gap-1">{(["1h", "6h", "24h", "7d", "30d"] as HuntTimelineRange[]).map((item) => <button type="button" key={item} onClick={() => { onRangeChange(item); onSelectBucket(0, 0); }} className={`th-range-button ${range === item ? "is-active" : ""}`}>{item}</button>)}</div></div>
    <div className="h-28 w-full">{results.length ? <ResponsiveContainer width="100%" height="100%"><AreaChart data={buckets} margin={{ top: 5, right: 10, left: -24, bottom: 0 }} onClick={(state) => { const index = state?.activeTooltipIndex; if (typeof index === "number") onSelectBucket(buckets[index].start, buckets[index].end); }}>
      <defs><linearGradient id="huntFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#20c4d8" stopOpacity={0.3} /><stop offset="100%" stopColor="#20c4d8" stopOpacity={0.015} /></linearGradient></defs>
      <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="time" tickLine={false} axisLine={false} tick={{ fill: "#718096", fontSize: 9 }} minTickGap={24} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#718096", fontSize: 9 }} /><Tooltip contentStyle={{ background: "#0b1219", border: "1px solid rgba(255,255,255,.12)", borderRadius: 4, color: "#e2e8f0", fontSize: 10 }} />
      <Area type="monotone" dataKey="events" name="Events" stroke="#22c7d9" strokeWidth={1.8} fill="url(#huntFill)" activeDot={{ r: 4, fill: "#22c7d9", stroke: "#081019", strokeWidth: 2 }} />
    </AreaChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-[10px] text-slate-600">Run a query to populate the hunt timeline.</div>}</div>
    {selectedBucket !== null && <button type="button" onClick={() => onSelectBucket(0, 0)} className="text-[9px] text-cyan-400 hover:text-cyan-200">Clear timeline filter</button>}
  </section>;
};