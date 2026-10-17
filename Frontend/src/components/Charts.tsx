import { useMemo, useState } from "react";
import { Area, AreaChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ApiEvent } from "../services/api";

interface AlertActivityRecord {
  timestamp: string;
}

interface ChartsProps {
  alerts: AlertActivityRecord[];
  events: ApiEvent[];
}

const severityColors: Record<string, string> = { CRITICAL: "#c9535b", HIGH: "#d18b45", MEDIUM: "#6297aa", LOW: "#58a084" };
const activityRanges = ["day", "week", "month", "year"] as const;
type ActivityRange = (typeof activityRanges)[number];

const rangeLabels: Record<ActivityRange, string> = {
  day: "Last 24 hours",
  week: "Last 7 days",
  month: "Last 30 days",
  year: "Last 12 months",
};

function activityBuckets(range: ActivityRange, now: Date) {
  if (range === "day") {
    return Array.from({ length: 24 }, (_, index) => {
      const bucketTime = new Date(now);
      bucketTime.setMinutes(0, 0, 0);
      bucketTime.setHours(bucketTime.getHours() - (23 - index));
      return { key: bucketTime.getTime(), label: bucketTime.toLocaleTimeString([], { hour: "2-digit" }), events: 0, alerts: 0 };
    });
  }

  if (range === "week" || range === "month") {
    const length = range === "week" ? 7 : 30;
    return Array.from({ length }, (_, index) => {
      const bucketTime = new Date(now);
      bucketTime.setHours(0, 0, 0, 0);
      bucketTime.setDate(bucketTime.getDate() - (length - 1 - index));
      return {
        key: bucketTime.getTime(),
        label: range === "week"
          ? bucketTime.toLocaleDateString([], { weekday: "short" })
          : bucketTime.toLocaleDateString([], { month: "numeric", day: "numeric" }),
        events: 0,
        alerts: 0,
      };
    });
  }

  return Array.from({ length: 12 }, (_, index) => {
    const bucketTime = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    return {
      key: bucketTime.getTime(),
      label: bucketTime.toLocaleDateString([], { month: "short" }),
      events: 0,
      alerts: 0,
    };
  });
}

export const Charts = ({ alerts, events }: ChartsProps) => {
  const [activityRange, setActivityRange] = useState<ActivityRange>("day");
  const chartData = useMemo(() => {
    const now = new Date();
    const buckets = activityBuckets(activityRange, now);
    const bucketSpan = activityRange === "day" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
    const rangeStart = buckets[0].key;
    const monthIndices = new Map(buckets.map((bucket, index) => [bucket.key, index]));
    const addRecord = (timestamp: string, key: "events" | "alerts") => {
      const recordTime = new Date(timestamp);
      if (Number.isNaN(recordTime.getTime())) return;
      let bucketIndex: number;
      if (activityRange === "year") {
        const month = new Date(recordTime.getFullYear(), recordTime.getMonth(), 1).getTime();
        const index = monthIndices.get(month);
        if (index === undefined) return;
        bucketIndex = index;
      } else {
        const delta = recordTime.getTime() - rangeStart;
        if (delta < 0 || recordTime.getTime() > now.getTime()) return;
        bucketIndex = Math.floor(delta / bucketSpan);
        if (bucketIndex >= buckets.length) return;
      }
      buckets[bucketIndex][key] += 1;
    };
    events.forEach((event) => addRecord(event.timestamp, "events"));
    alerts.forEach((alert) => addRecord(alert.timestamp, "alerts"));
    return buckets;
  }, [activityRange, alerts, events]);
  const severityData = useMemo(() => ["CRITICAL", "HIGH", "MEDIUM", "LOW"].map((severity) => ({
    name: severity,
    value: events.filter((event) => event.severity === severity).length,
  })).filter((item) => item.value > 0), [events]);
  const totalSeverityEvents = severityData.reduce((total, item) => total + item.value, 0);

  return <section className="soc-chart-grid" aria-label="Security analytics">
    <article className="soc-glass-panel soc-chart-panel">
      <div className="soc-panel-heading">
        <div><span className="soc-eyebrow">TELEMETRY VELOCITY</span><h2>Event activity</h2></div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="soc-panel-count">{rangeLabels[activityRange]}</span>
          <div className="inline-flex rounded-md border border-black/10 bg-white p-0.5" role="group" aria-label="Event activity range">
            {activityRanges.map((range) => <button key={range} type="button" aria-pressed={activityRange === range} onClick={() => setActivityRange(range)} className={`rounded px-2 py-1 text-[10px] font-semibold capitalize transition-colors ${activityRange === range ? "bg-[#292b2e] text-white" : "text-[#62686d] hover:bg-black/5"}`}>{range}</button>)}
          </div>
        </div>
      </div>
      <div className="soc-chart-body">
        {events.length || alerts.length ? <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -22, bottom: 0 }}>
            <defs>
              <linearGradient id="dashboardEventFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4d9d89" stopOpacity={0.42} />
                <stop offset="100%" stopColor="#4d9d89" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "#788681", fontSize: 9 }} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#788681", fontSize: 9 }} />
            <Tooltip contentStyle={{ border: "1px solid rgba(255,255,255,.8)", borderRadius: 8, background: "#24302f", color: "#fff", fontSize: 10 }} />
            <Area type="monotone" dataKey="events" name="Events" stroke="#3e7d6e" strokeWidth={2} fill="url(#dashboardEventFill)" />
            <Area type="monotone" dataKey="alerts" name="Alerts" stroke="#c9535b" strokeWidth={1.5} fill="none" />
          </AreaChart>
        </ResponsiveContainer> : <p className="soc-empty-state">Event activity will appear here after telemetry is received.</p>}
      </div>
      <div className="soc-chart-legend"><span><i className="soc-legend-events" />Events</span><span><i className="soc-legend-alerts" />Alerts</span></div>
    </article>

    <article className="soc-glass-panel soc-chart-panel">
      <div className="soc-panel-heading">
        <div><span className="soc-eyebrow">SEVERITY MIX</span><h2>Telemetry profile</h2></div>
        <span className="soc-panel-count">{totalSeverityEvents} events</span>
      </div>
      <div className="soc-donut-body">
        {severityData.length ? <>
          <div className="soc-donut-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={severityData} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={3} stroke="none">
                  {severityData.map((item) => <Cell key={item.name} fill={severityColors[item.name]} />)}
                </Pie>
                <Tooltip contentStyle={{ border: "1px solid rgba(255,255,255,.8)", borderRadius: 8, background: "#24302f", color: "#fff", fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
            <strong>{totalSeverityEvents}</strong><small>Total</small>
          </div>
          <div className="soc-severity-list">{severityData.map((item) => <div key={item.name}><span><i style={{ background: severityColors[item.name] }} />{item.name}</span><strong>{item.value}</strong></div>)}</div>
        </> : <p className="soc-empty-state">Severity distribution will appear with incoming events.</p>}
      </div>
    </article>
  </section>;
};