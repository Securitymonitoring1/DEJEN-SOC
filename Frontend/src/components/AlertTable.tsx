import { Ban, Cable, LoaderCircle, Power, ShieldOff, WifiOff } from "lucide-react";
import { SeverityBadge } from "./SeverityBadge";

interface AlertRecord {
  id: string;
  title: string;
  rule: string;
  host: string;
  agentId: string;
  sourceIp: string;
  severity: string;
  riskScore: number;
  status: string;
  timestamp: string;
}

interface AlertTableProps {
  alerts: AlertRecord[];
  canManage: boolean;
  onOpen: (alert: AlertRecord) => void;
  onStatusChange: (alert: AlertRecord, status: string) => void;
  onResponseAction: (alert: AlertRecord, action: "BLOCK_ENDPOINT_IP" | "UNBLOCK_ENDPOINT_IP" | "ISOLATE_ENDPOINT" | "UNISOLATE_ENDPOINT" | "DISCONNECT_AGENT") => void;
  onConfirmResponseAction: (alert: AlertRecord, action: "BLOCK_ENDPOINT_IP" | "UNBLOCK_ENDPOINT_IP" | "ISOLATE_ENDPOINT" | "UNISOLATE_ENDPOINT" | "DISCONNECT_AGENT") => void;
  onCancelResponseAction: () => void;
  onConnectAgent: (alert: AlertRecord) => void;
  canConnectAgent: boolean;
  reconnectTokens: Record<string, { busy: boolean; token?: string; expiresAt?: string; message?: string }>;
  pendingResponseAction: { alertId: string; actionType: "BLOCK_ENDPOINT_IP" | "UNBLOCK_ENDPOINT_IP" | "ISOLATE_ENDPOINT" | "UNISOLATE_ENDPOINT" | "DISCONNECT_AGENT"; details: string } | null;
  responseActions: Record<string, { busy: boolean; message: string; actions: { action_type: string; status: string; result?: string | null }[] }>;
}

const statuses = ["OPEN", "INVESTIGATING", "RESOLVED"];
const hasActiveAction = (actions: { action_type: string; status: string }[] | undefined, actionType: string) =>
  actions?.some((action) => action.action_type === actionType && ["PENDING", "RUNNING"].includes(action.status)) || false;

export const AlertTable = ({ alerts, canManage, onOpen, onStatusChange, onResponseAction, onConfirmResponseAction, onCancelResponseAction, onConnectAgent, canConnectAgent, reconnectTokens, pendingResponseAction, responseActions }: AlertTableProps) => (
  <div className="overflow-x-auto rounded-md border border-black/10 bg-white">
    <table className="w-full min-w-[1100px] text-left text-xs">
      <thead className="bg-[#f5f6f6] text-[#62686d]"><tr><th className="px-4 py-3">Alert</th><th className="px-4 py-3">Rule</th><th className="px-4 py-3">Host</th><th className="px-4 py-3">Source IP</th><th className="px-4 py-3">Severity</th><th className="px-4 py-3">Risk</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">Response</th></tr></thead>
      <tbody className="divide-y divide-black/5">
        {alerts.map((alert) => <tr key={alert.id} onClick={() => onOpen(alert)} className="cursor-pointer hover:bg-[#f8f9f9]">
          <td className="px-4 py-3"><span className="block max-w-sm font-semibold">{alert.title}</span><span className="mt-1 block font-mono text-[10px] text-[#73797e]">{alert.id}</span></td>
          <td className="px-4 py-3">{alert.rule}</td>
          <td className="px-4 py-3">{alert.host}</td>
          <td className="px-4 py-3 font-mono text-[10px]">{alert.sourceIp === "Unknown IP" ? "Not recorded (local or unavailable)" : alert.sourceIp}</td>
          <td className="px-4 py-3"><SeverityBadge severity={alert.severity} /></td>
          <td className="px-4 py-3 tabular-nums">{alert.riskScore}</td>
          <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}><select aria-label={`Status for ${alert.title}`} value={alert.status} disabled={!canManage} onChange={(event) => onStatusChange(alert, event.target.value)} className="rounded border border-black/15 bg-white px-2 py-1 text-[11px] disabled:bg-[#f2f3f3]">{statuses.map((status) => <option key={status}>{status}</option>)}</select></td>
          <td className="whitespace-nowrap px-4 py-3">{new Date(alert.timestamp).toLocaleString()}</td>
          <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-1.5">
              <button type="button" disabled={!canManage || responseActions[alert.id]?.busy || hasActiveAction(responseActions[alert.id]?.actions, "BLOCK_ENDPOINT_IP") || !alert.agentId} onClick={() => onResponseAction(alert, "BLOCK_ENDPOINT_IP")} title="Block this endpoint's own IP locally; the platform and other endpoints are not targeted" aria-label={`Block endpoint IP for ${alert.title}`} className="inline-flex items-center gap-1 rounded border border-rose-300 px-2 py-1 text-[10px] font-semibold text-rose-800 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-40"><Ban size={12} />Block</button>
              <button type="button" disabled={!canManage || responseActions[alert.id]?.busy || hasActiveAction(responseActions[alert.id]?.actions, "UNBLOCK_ENDPOINT_IP") || !alert.agentId} onClick={() => onResponseAction(alert, "UNBLOCK_ENDPOINT_IP")} title="Remove Dejen-managed local firewall rules for this endpoint IP" aria-label={`Unblock endpoint IP for ${alert.title}`} className="inline-flex items-center gap-1 rounded border border-emerald-300 px-2 py-1 text-[10px] font-semibold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40"><ShieldOff size={12} />Unblock</button>
              <button type="button" disabled={!canManage || responseActions[alert.id]?.busy || hasActiveAction(responseActions[alert.id]?.actions, "ISOLATE_ENDPOINT") || !alert.agentId} onClick={() => onResponseAction(alert, "ISOLATE_ENDPOINT")} title="Disable network adapters on the alert endpoint" aria-label={`Isolate endpoint for ${alert.title}`} className="inline-flex items-center gap-1 rounded border border-amber-300 px-2 py-1 text-[10px] font-semibold text-amber-900 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40"><WifiOff size={12} />Isolate</button>
              <button type="button" disabled={!canManage || responseActions[alert.id]?.busy || hasActiveAction(responseActions[alert.id]?.actions, "UNISOLATE_ENDPOINT") || !alert.agentId} onClick={() => onResponseAction(alert, "UNISOLATE_ENDPOINT")} title="Restore interfaces previously disabled by Dejen" aria-label={`Unisolate endpoint for ${alert.title}`} className="inline-flex items-center gap-1 rounded border border-teal-300 px-2 py-1 text-[10px] font-semibold text-teal-900 hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-40"><Cable size={12} />Unisolate</button>
              <button type="button" disabled={!canManage || responseActions[alert.id]?.busy || hasActiveAction(responseActions[alert.id]?.actions, "DISCONNECT_AGENT") || !alert.agentId} onClick={() => onResponseAction(alert, "DISCONNECT_AGENT")} title="Stop the agent and disable its automatic startup" aria-label={`Disconnect agent for ${alert.title}`} className="inline-flex items-center gap-1 rounded border border-neutral-300 px-2 py-1 text-[10px] font-semibold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"><Power size={12} />Disconnect</button>
              <button type="button" disabled={!canConnectAgent || !alert.agentId || reconnectTokens[alert.id]?.busy} onClick={() => onConnectAgent(alert)} title="Create a one-time token to reconnect this endpoint locally" aria-label={`Connect endpoint for ${alert.title}`} className="inline-flex items-center gap-1 rounded border border-sky-300 px-2 py-1 text-[10px] font-semibold text-sky-900 hover:bg-sky-50 disabled:cursor-not-allowed disabled:opacity-40"><Cable size={12} />Connect</button>
            </div>
            {pendingResponseAction?.alertId === alert.id && <div role="group" aria-label={`Confirm ${pendingResponseAction.actionType.replaceAll("_", " ").toLowerCase()}`} className="mt-2 max-w-64 rounded border border-amber-300 bg-amber-50 p-2">
              <p className="text-[10px] leading-4 text-amber-950">{pendingResponseAction.details}</p>
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={() => onConfirmResponseAction(alert, pendingResponseAction.actionType)} className="rounded bg-[#292b2e] px-2 py-1 text-[10px] font-semibold text-white hover:bg-black">Confirm</button>
                <button type="button" onClick={onCancelResponseAction} className="rounded border border-black/15 bg-white px-2 py-1 text-[10px] font-semibold text-[#34434c] hover:bg-neutral-50">Cancel</button>
              </div>
            </div>}
            {responseActions[alert.id]?.busy && <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-[#697974]"><LoaderCircle size={11} className="animate-spin" />Sending</span>}
            {responseActions[alert.id]?.message && <span className="mt-1 block max-w-52 text-[10px] text-[#697974]">{responseActions[alert.id].message}</span>}
            {responseActions[alert.id]?.actions?.length > 0 && <span className="mt-1 block text-[10px] text-[#697974]">
              {responseActions[alert.id].actions.filter((action) => ["PENDING", "RUNNING"].includes(action.status)).length} pending · {responseActions[alert.id].actions.filter((action) => action.status === "SUCCEEDED").length} done · {responseActions[alert.id].actions.filter((action) => action.status === "FAILED").length} failed
            </span>}
            {responseActions[alert.id]?.actions?.find((action) => action.status === "FAILED")?.result && <span className="mt-1 block max-w-52 text-[10px] text-rose-700">{responseActions[alert.id].actions?.find((action) => action.status === "FAILED")?.result}</span>}
            {responseActions[alert.id]?.actions?.find((action) => action.status === "RUNNING")?.result && <span className="mt-1 block max-w-52 text-[10px] text-amber-800">{responseActions[alert.id].actions?.find((action) => action.status === "RUNNING")?.result}</span>}
            {reconnectTokens[alert.id]?.busy && <span className="mt-1 block text-[10px] text-[#697974]">Creating reconnect token…</span>}
            {reconnectTokens[alert.id]?.token && <div className="mt-2 max-w-64 rounded border border-sky-200 bg-sky-50 p-2 text-[10px] text-sky-950"><p>One-time token, expires {new Date(reconnectTokens[alert.id].expiresAt || "").toLocaleTimeString()}:</p><code className="mt-1 block break-all font-mono">{reconnectTokens[alert.id].token}</code><p className="mt-1">On the endpoint, run Agent Manager with this token, register and save, then re-enable its startup task.</p></div>}
            {reconnectTokens[alert.id]?.message && <span className="mt-1 block max-w-52 text-[10px] text-[#697974]">{reconnectTokens[alert.id].message}</span>}
          </td>
        </tr>)}
        {!alerts.length && <tr><td colSpan={9} className="px-4 py-10 text-center text-[#777d82]">No backend alerts match these filters.</td></tr>}
      </tbody>
    </table>
  </div>
);