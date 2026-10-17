import { useMemo, useState } from "react";
import { Activity, ArrowLeft, Crosshair, RefreshCw } from "lucide-react";
import { InvestigationGraph } from "../components/investigation/InvestigationGraph";
import { GlassWorkspace } from "../components/layout/GlassWorkspace";
import { useSoc } from "../context/SocContext";

const severityRank = { UNKNOWN: 0, LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
const severityForRisk = { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH", CRITICAL: "CRITICAL" };

function riskForSeverity(severity) {
  return severityForRisk[String(severity || "").toUpperCase()] || "UNKNOWN";
}

function makeNodeId(type, name) {
  return `${type}:${encodeURIComponent(name)}`;
}

function buildTopology(events) {
  const nodeMap = new Map();
  const edgeMap = new Map();
  const observations = new Map();

  const ensureNode = (type, name, severity) => {
    const id = makeNodeId(type, name);
    const current = nodeMap.get(id);
    if (!current) {
      nodeMap.set(id, { id, name, type, risk: riskForSeverity(severity), eventCount: 0 });
    } else if (severityRank[severity] > severityRank[current.risk]) {
      current.risk = riskForSeverity(severity);
    }
    return id;
  };

  for (const event of events) {
    const eventType = event.event_type || "Unknown event";
    const severity = String(event.severity || "").toUpperCase();
    const eventNode = ensureNode("EVENT", eventType, severity);
    const related = [
      ["HOST", event.host],
      ["USER", event.username],
      ["EXTERNAL IP", event.source_ip],
    ].filter(([, value]) => typeof value === "string" && value.trim());
    const relatedIds = new Set([eventNode]);

    for (const [type, value] of related) {
      const entityId = ensureNode(type, value.trim(), severity);
      relatedIds.add(entityId);
      const key = `${eventNode}->${entityId}`;
      const edge = edgeMap.get(key);
      if (edge) {
        edge.eventCount += 1;
        if (severityRank[severity] > severityRank[edge.severity]) edge.severity = severity;
      } else {
        edgeMap.set(key, {
          id: key,
          source: eventNode,
          target: entityId,
          relationship: "Observed together",
          eventCount: 1,
          severity,
        });
      }
    }

    for (const id of relatedIds) {
      const node = nodeMap.get(id);
      node.eventCount += 1;
      if (!observations.has(id)) observations.set(id, []);
      observations.get(id).push(event);
    }
  }

  const positions = { EVENT: 40, "EXTERNAL IP": 310, USER: 580, HOST: 850 };
  const rowByType = new Map();
  const nodes = [...nodeMap.values()].map((node) => {
    const row = rowByType.get(node.type) || 0;
    rowByType.set(node.type, row + 1);
    return { ...node, position: { x: positions[node.type], y: 100 + row * 112 } };
  });
  const edges = [...edgeMap.values()].map((edge) => ({
    ...edge,
    risk: edge.severity === "CRITICAL" ? "CRITICAL" : ["HIGH", "MEDIUM"].includes(edge.severity) ? "SUSPICIOUS" : "NORMAL",
    animated: edge.severity === "HIGH" || edge.severity === "CRITICAL",
  }));

  return { nodes, edges, observations };
}

export const InvestigationPage = () => {
  const { routeParams, navigate, events, refreshData, loading } = useSoc();
  const [logLimit, setLogLimit] = useState(100);
  const [selectedNode, setSelectedNode] = useState(undefined);
  const entity = routeParams.entity || "";
  const sourceEvents = useMemo(() => [...events].sort((left, right) => new Date(right.timestamp) - new Date(left.timestamp)), [events]);
  const comparedEvents = useMemo(() => sourceEvents.slice(0, logLimit), [sourceEvents, logLimit]);
  const topology = useMemo(() => buildTopology(comparedEvents), [comparedEvents]);
  const initialSelection = useMemo(() => {
    if (!entity) return null;
    const selectedType = String(routeParams.entityType || "").toUpperCase();
    const type = selectedType === "USER" ? "USER" : selectedType === "PROCESS" ? "PROCESS" : selectedType === "IP" ? "EXTERNAL IP" : "HOST";
    return topology.nodes.find((node) => node.type === type && node.name === entity) || null;
  }, [entity, routeParams.entityType, topology.nodes]);
  const activeNode = selectedNode === undefined ? initialSelection : selectedNode;
  const linkedEvents = activeNode
    ? topology.observations.get(activeNode.id) || []
    : comparedEvents.slice(0, 8);
  const riskCounts = comparedEvents.reduce((counts, event) => {
    const severity = String(event.severity || "LOW").toUpperCase();
    counts[severity] = (counts[severity] || 0) + 1;
    return counts;
  }, {});
  const routeSelectedId = initialSelection?.id || null;

  return <GlassWorkspace>
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-black/10 pb-3">
        <div><button type="button" onClick={() => navigate("/hunting")} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-[#287b70] hover:underline"><ArrowLeft size={13} />Threat Hunting</button><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#287b70]">Observed Log Relationships</p><h1 className="mt-1 text-xl font-bold">Forensic Entity Topology</h1><p className="mt-1 text-xs text-[#62686d]">Links show entities recorded together in source logs; they do not imply causation.</p></div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-[#62686d]">Compare
            <select value={logLimit} onChange={(event) => setLogLimit(Number(event.target.value))} className="rounded border border-black/15 bg-white px-2 py-1.5 text-xs text-[#283532]">
              {[25, 50, 100, 250].map((limit) => <option key={limit} value={limit}>Last {limit} logs</option>)}
            </select>
          </label>
          <button type="button" onClick={refreshData} disabled={loading} aria-label="Refresh logs" title="Refresh logs" className="inline-flex h-8 w-8 items-center justify-center rounded border border-black/15 bg-white text-[#34434c] hover:border-teal-600 disabled:opacity-50"><RefreshCw size={14} className={loading ? "animate-spin" : ""} /></button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-5 gap-y-3 border-b border-black/10 pb-3 sm:grid-cols-5">
        <div><p className="text-[10px] uppercase text-[#697974]">Logs compared</p><p className="mt-1 text-lg font-semibold">{comparedEvents.length}<span className="ml-1 text-xs font-normal text-[#697974]">/ {events.length}</span></p></div>
        <div><p className="text-[10px] uppercase text-[#697974]">Entities</p><p className="mt-1 text-lg font-semibold">{topology.nodes.length}</p></div>
        <div><p className="text-[10px] uppercase text-[#697974]">Observed links</p><p className="mt-1 text-lg font-semibold">{topology.edges.length}</p></div>
        <div><p className="text-[10px] uppercase text-[#697974]">High / critical</p><p className="mt-1 text-lg font-semibold text-[#a74643]">{(riskCounts.HIGH || 0) + (riskCounts.CRITICAL || 0)}</p></div>
        <div><p className="text-[10px] uppercase text-[#697974]">Time span</p><p className="mt-1 text-xs font-medium">{comparedEvents.length > 1 ? `${new Date(comparedEvents.at(-1).timestamp).toLocaleString()} – ${new Date(comparedEvents[0].timestamp).toLocaleString()}` : comparedEvents[0] ? new Date(comparedEvents[0].timestamp).toLocaleString() : "No logs"}</p></div>
      </div>
      {topology.nodes.length ? <InvestigationGraph nodes={topology.nodes} edges={topology.edges} selectedNode={activeNode?.id || null} onNodeSelect={setSelectedNode} /> : <div className="rounded-md border border-black/10 bg-white px-5 py-12 text-center"><Activity size={20} className="mx-auto text-[#73818a]" /><h2 className="mt-3 text-sm font-semibold text-[#283532]">No logs available to compare</h2><p className="mt-1 text-xs text-[#697974]">Events will appear here after they are ingested by the platform.</p></div>}
      <section className="border-t border-black/10 pt-3" aria-labelledby="topology-logs-heading">
        <div className="mb-3 flex items-center justify-between gap-3"><div><h2 id="topology-logs-heading" className="text-sm font-semibold">{activeNode ? `Logs linked to ${activeNode.name}` : "Recent source logs"}</h2><p className="mt-0.5 text-xs text-[#697974]">{activeNode ? `${linkedEvents.length} matching log${linkedEvents.length === 1 ? "" : "s"} in the comparison window` : "Select a node to compare its related records."}</p></div>{activeNode && <span className="inline-flex items-center gap-1.5 rounded border border-black/10 bg-white px-2 py-1 text-[10px] text-[#62686d]"><Crosshair size={11} />{activeNode.type}</span>}</div>
        {linkedEvents.length ? <div className="divide-y divide-black/10 border-y border-black/10">
          {linkedEvents.slice(0, 8).map((event) => <article key={event.event_id} className="grid gap-2 py-2.5 text-xs sm:grid-cols-[150px_130px_1fr_auto] sm:items-center">
            <time className="font-mono text-[10px] text-[#697974]">{new Date(event.timestamp).toLocaleString()}</time>
            <span className="font-semibold text-[#283532]">{event.event_type}</span>
            <span className="truncate text-[#62686d]" title={event.message}>{event.message}</span>
            <span className={`text-[10px] font-semibold uppercase ${["HIGH", "CRITICAL"].includes(event.severity) ? "text-[#a74643]" : "text-[#697974]"}`}>{event.severity}</span>
          </article>)}
        </div> : <p className="border-y border-black/10 py-6 text-center text-xs text-[#697974]">No source logs match this selection.</p>}
      </section>
    </div>
  </GlassWorkspace>;
};