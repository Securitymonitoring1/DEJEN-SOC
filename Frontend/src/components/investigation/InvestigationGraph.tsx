import { useEffect, useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  EdgeLabelRenderer,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  getSmoothStepPath,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  Database,
  Activity,
  File,
  Globe,
  Server,
  ShieldAlert,
  Terminal,
  TriangleAlert,
  User,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize,
  type LucideIcon,
} from "lucide-react";
import "@xyflow/react/dist/style.css";
import "./InvestigationGraph.css";

export type EntityType = "EVENT" | "HOST" | "USER" | "PROCESS" | "INTERNAL IP" | "EXTERNAL IP" | "DOMAIN" | "FILE" | "MEMORY ARTIFACT" | "ALERT" | "INCIDENT";
export type EntityRisk = "UNKNOWN" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RelationshipRisk = "NORMAL" | "SUSPICIOUS" | "CRITICAL";

export interface InvestigationEntity {
  id: string;
  name: string;
  type: EntityType;
  risk: EntityRisk;
  eventCount?: number;
  position?: { x: number; y: number };
}

export interface InvestigationRelationship {
  id: string;
  source: string;
  target: string;
  relationship: string;
  risk?: RelationshipRisk;
  mitre?: { technique: string; name: string };
  animated?: boolean;
  eventCount?: number;
}

export interface InvestigationGraphProps {
  nodes?: InvestigationEntity[];
  edges?: InvestigationRelationship[];
  selectedNode?: string | null;
  selectedEdge?: string | null;
  onNodeSelect?: (node: InvestigationEntity | null) => void;
  onEdgeSelect?: (edge: InvestigationRelationship | null) => void;
}

interface EntityNodeData extends Record<string, unknown> {
  entity: InvestigationEntity;
  selected: boolean;
  connected: boolean;
  dimmed: boolean;
}

type FlowNode = Node<EntityNodeData, "investigation-entity">;
type FlowEdge = Edge<{ relationship: InvestigationRelationship }>;

const entityIcons: Record<EntityType, LucideIcon> = {
  EVENT: Activity,
  HOST: Server,
  USER: User,
  PROCESS: Terminal,
  "INTERNAL IP": Globe,
  "EXTERNAL IP": Globe,
  DOMAIN: Globe,
  FILE: File,
  "MEMORY ARTIFACT": Database,
  ALERT: TriangleAlert,
  INCIDENT: ShieldAlert,
};

const DEFAULT_NODES: InvestigationEntity[] = [
  { id: "svc-backup", name: "SVC-BACKUP", type: "USER", risk: "HIGH", position: { x: 420, y: 25 } },
  { id: "internal-ip", name: "10.20.14.88", type: "INTERNAL IP", risk: "MEDIUM", position: { x: 30, y: 230 } },
  { id: "win-dc01", name: "WIN-DC01", type: "HOST", risk: "CRITICAL", position: { x: 420, y: 210 } },
  { id: "powershell", name: "powershell.exe", type: "PROCESS", risk: "HIGH", position: { x: 820, y: 185 } },
  { id: "rundll32", name: "rundll32.exe", type: "PROCESS", risk: "HIGH", position: { x: 820, y: 360 } },
  { id: "external-ip", name: "194.26.29.112", type: "EXTERNAL IP", risk: "CRITICAL", position: { x: 1120, y: 360 } },
  { id: "lsass-dump", name: "lsass.dmp", type: "MEMORY ARTIFACT", risk: "CRITICAL", position: { x: 420, y: 390 } },
  { id: "srv-payroll-02", name: "SRV-PAYROLL-02", type: "HOST", risk: "HIGH", position: { x: 420, y: 555 } },
];

const DEFAULT_EDGES: InvestigationRelationship[] = [
  { id: "user-host", source: "svc-backup", target: "win-dc01", relationship: "Privilege Escalation", risk: "SUSPICIOUS" },
  { id: "ip-host", source: "internal-ip", target: "win-dc01", relationship: "Network Connection", risk: "NORMAL" },
  { id: "host-powershell", source: "win-dc01", target: "powershell", relationship: "Process Spawn", risk: "SUSPICIOUS", animated: true, mitre: { technique: "T1059.001", name: "PowerShell" } },
  { id: "host-lsass", source: "win-dc01", target: "lsass-dump", relationship: "Credential Access", risk: "CRITICAL", animated: true, mitre: { technique: "T1003", name: "OS Credential Dumping" } },
  { id: "lsass-payroll", source: "lsass-dump", target: "srv-payroll-02", relationship: "Lateral Movement", risk: "SUSPICIOUS" },
  { id: "powershell-rundll32", source: "powershell", target: "rundll32", relationship: "Process Spawn", risk: "SUSPICIOUS", animated: true },
  { id: "rundll32-c2", source: "rundll32", target: "external-ip", relationship: "C2 Communication", risk: "CRITICAL", animated: true },
];

const riskColor: Record<RelationshipRisk, string> = {
  NORMAL: "#9aa1a8",
  SUSPICIOUS: "#d49e5d",
  CRITICAL: "#c95a63",
};

function EntityNodeView({ data }: NodeProps<FlowNode>) {
  const Icon = entityIcons[data.entity.type];
  return <div className={`forensic-node forensic-risk-${data.entity.risk.toLowerCase()}${data.selected ? " is-selected" : ""}${data.connected ? " is-connected" : ""}${data.dimmed ? " is-dimmed" : ""}`}>
    <Handle type="target" position={Position.Top} id="target-top" className="forensic-handle" />
    <Handle type="source" position={Position.Top} id="source-top" className="forensic-handle" />
    <Handle type="target" position={Position.Bottom} id="target-bottom" className="forensic-handle" />
    <Handle type="source" position={Position.Bottom} id="source-bottom" className="forensic-handle" />
    <Handle type="target" position={Position.Left} id="target-left" className="forensic-handle" />
    <Handle type="source" position={Position.Left} id="source-left" className="forensic-handle" />
    <Handle type="target" position={Position.Right} id="target-right" className="forensic-handle" />
    <Handle type="source" position={Position.Right} id="source-right" className="forensic-handle" />
    <div className="forensic-node-heading">
      <span className="forensic-node-icon"><Icon size={14} strokeWidth={1.8} /></span>
      <strong title={data.entity.name}>{data.entity.name}</strong>
    </div>
    <div className="forensic-node-meta">
      <span>{data.entity.type}{data.entity.eventCount ? ` · ${data.entity.eventCount} logs` : ""}</span>
      <span className={`forensic-risk-label risk-${data.entity.risk.toLowerCase()}`}><i />{data.entity.risk}</span>
    </div>
  </div>;
}

const nodeTypes = { "investigation-entity": EntityNodeView };

function RelationshipEdgeView({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, style }: EdgeProps<FlowEdge>) {
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const relationship = data?.relationship;
  return <>
    <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
    {relationship && <EdgeLabelRenderer>
      <div className="forensic-edge-label nodrag nopan" style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}>
        <span>{relationship.relationship}{relationship.eventCount ? ` · ${relationship.eventCount} logs` : ""}</span>
        {relationship.mitre && <small>{relationship.mitre.technique} · {relationship.mitre.name}</small>}
      </div>
    </EdgeLabelRenderer>}
  </>;
}

const edgeTypes = { forensicRelationship: RelationshipEdgeView };

const asFlowNodes = (entities: InvestigationEntity[]): FlowNode[] => entities.map((entity, index) => ({
  id: entity.id,
  type: "investigation-entity",
  position: entity.position || { x: 120 + (index % 4) * 250, y: 120 + Math.floor(index / 4) * 180 },
  data: { entity, selected: false, connected: false, dimmed: false },
}));

const asFlowEdges = (relationships: InvestigationRelationship[], entities: InvestigationEntity[]): FlowEdge[] => relationships.map((relationship) => {
  const source = entities.find((entity) => entity.id === relationship.source)?.position || { x: 0, y: 0 };
  const target = entities.find((entity) => entity.id === relationship.target)?.position || { x: 0, y: 0 };
  const deltaX = target.x - source.x;
  const deltaY = target.y - source.y;
  const horizontal = Math.abs(deltaX) >= Math.abs(deltaY);
  const sourceHandle = horizontal ? (deltaX >= 0 ? "source-right" : "source-left") : (deltaY >= 0 ? "source-bottom" : "source-top");
  const targetHandle = horizontal ? (deltaX >= 0 ? "target-left" : "target-right") : (deltaY >= 0 ? "target-top" : "target-bottom");
  return {
    id: relationship.id,
    source: relationship.source,
    target: relationship.target,
    sourceHandle,
    targetHandle,
    type: "forensicRelationship",
    animated: relationship.animated,
    markerEnd: { type: MarkerType.ArrowClosed, color: riskColor[relationship.risk || "NORMAL"] },
    style: { stroke: riskColor[relationship.risk || "NORMAL"], strokeWidth: relationship.risk === "CRITICAL" ? 2 : 1.4 },
    data: { relationship },
  };
});

function GraphControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const fit = () => fitView({ padding: 0.16, duration: 350 });
  return <div className="forensic-controls" aria-label="Graph controls">
    <button type="button" onClick={() => zoomIn({ duration: 180 })} aria-label="Zoom in" title="Zoom in"><ZoomIn size={15} /></button>
    <button type="button" onClick={() => zoomOut({ duration: 180 })} aria-label="Zoom out" title="Zoom out"><ZoomOut size={15} /></button>
    <button type="button" onClick={fit} aria-label="Reset view" title="Reset view"><RotateCcw size={14} /></button>
    <button type="button" onClick={fit} aria-label="Fit view" title="Fit view"><Maximize size={14} /><span>Fit View</span></button>
  </div>;
}

function InvestigationGraphCanvas({
  nodes = DEFAULT_NODES,
  edges = DEFAULT_EDGES,
  selectedNode,
  selectedEdge,
  onNodeSelect,
  onEdgeSelect,
}: InvestigationGraphProps) {
  const flowNodes = useMemo(() => asFlowNodes(nodes), [nodes]);
  const flowEdges = useMemo(() => asFlowEdges(edges, nodes), [edges, nodes]);
  const [renderedNodes, setRenderedNodes, onNodesChange] = useNodesState(flowNodes);
  const [renderedEdges, setRenderedEdges, onEdgesChange] = useEdgesState(flowEdges);
  const [localNode, setLocalNode] = useState<string | null>(null);
  const [localEdge, setLocalEdge] = useState<string | null>(null);
  const activeNode = selectedNode === undefined ? localNode : selectedNode;
  const activeEdge = selectedEdge === undefined ? localEdge : selectedEdge;

  useEffect(() => setRenderedNodes(flowNodes), [flowNodes, setRenderedNodes]);
  useEffect(() => setRenderedEdges(flowEdges), [flowEdges, setRenderedEdges]);

  useEffect(() => {
    const selectedRelationship = edges.find((edge) => edge.id === activeEdge);
    const relatedNodeIds = new Set<string>();
    const relatedEdgeIds = new Set<string>();

    if (activeNode) {
      relatedNodeIds.add(activeNode);
      edges.forEach((edge) => {
        if (edge.source === activeNode || edge.target === activeNode) {
          relatedEdgeIds.add(edge.id);
          relatedNodeIds.add(edge.source);
          relatedNodeIds.add(edge.target);
        }
      });
    } else if (selectedRelationship) {
      relatedNodeIds.add(selectedRelationship.source);
      relatedNodeIds.add(selectedRelationship.target);
      relatedEdgeIds.add(selectedRelationship.id);
    }

    setRenderedNodes((current) => current.map((node) => ({
      ...node,
      data: {
        ...node.data,
        selected: node.id === activeNode,
        connected: node.id !== activeNode && relatedNodeIds.has(node.id),
        dimmed: relatedNodeIds.size > 0 && !relatedNodeIds.has(node.id),
      },
    })));
    setRenderedEdges((current) => current.map((edge) => {
      const relationship = edge.data?.relationship;
      const relationshipRisk = relationship?.risk || "NORMAL";
      const selected = edge.id === activeEdge || (activeNode !== null && relatedEdgeIds.has(edge.id));
      const dimmed = relatedEdgeIds.size > 0 && !relatedEdgeIds.has(edge.id);
      const color = selected ? "#00b8d4" : riskColor[relationshipRisk];
      return {
        ...edge,
        animated: relationship?.animated && !dimmed,
        className: `${selected ? "is-highlighted" : ""}${dimmed ? " is-dimmed" : ""}`,
        style: { stroke: color, strokeWidth: selected || relationshipRisk === "CRITICAL" ? 2 : 1.4 },
        markerEnd: { type: MarkerType.ArrowClosed, color },
      };
    }));
  }, [activeEdge, activeNode, edges, setRenderedEdges, setRenderedNodes]);

  const selectNode = (_: React.MouseEvent, node: FlowNode) => {
    setLocalNode(node.id);
    setLocalEdge(null);
    onNodeSelect?.(nodes.find((entity) => entity.id === node.id) || null);
    onEdgeSelect?.(null);
  };

  const selectEdge = (_: React.MouseEvent, edge: FlowEdge) => {
    setLocalEdge(edge.id);
    setLocalNode(null);
    onEdgeSelect?.(edges.find((relationship) => relationship.id === edge.id) || null);
    onNodeSelect?.(null);
  };

  const clearSelection = () => {
    setLocalNode(null);
    setLocalEdge(null);
    onNodeSelect?.(null);
    onEdgeSelect?.(null);
  };

  return <div className="investigation-graph" aria-label="Forensic entity relationship graph">
    <div className="forensic-graph-caption"><span className="forensic-live-dot" />FORENSIC ENTITY TOPOLOGY</div>
    <GraphControls />
    <ReactFlow
      nodes={renderedNodes}
      edges={renderedEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={selectNode}
      onEdgeClick={selectEdge}
      onPaneClick={clearSelection}
      fitView
      fitViewOptions={{ padding: 0.16 }}
      minZoom={0.3}
      maxZoom={1.8}
      proOptions={{ hideAttribution: true }}
      nodesDraggable
      nodesConnectable={false}
      elementsSelectable
      panOnDrag
      zoomOnDoubleClick={false}
    >
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(80, 80, 80, 0.18)" />
    </ReactFlow>
    <div className="forensic-legend" aria-label="Node taxonomy">
      <span className="forensic-legend-title">Node Taxonomy</span>
      <span><Server size={12} />Host Asset</span>
      <span><User size={12} />User Principal</span>
      <span><Terminal size={12} />Spawned Process</span>
      <span><Globe size={12} />External C2</span>
      <span><File size={12} />File Artifact</span>
      <span><Database size={12} />Memory Artifact</span>
    </div>
  </div>;
}

export const InvestigationGraph = (props: InvestigationGraphProps) => (
  <ReactFlowProvider>
    <InvestigationGraphCanvas {...props} />
  </ReactFlowProvider>
);