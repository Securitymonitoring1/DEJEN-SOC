import { useEffect, useMemo, useState } from "react";
import { GlassWorkspace } from "../components/layout/GlassWorkspace";
import { AlertTable } from "../components/AlertTable";
import { useSoc } from "../context/SocContext";
import { agentsApi, alertsApi } from "../services/api";

const ALERT_STATUSES = ["OPEN", "INVESTIGATING", "RESOLVED"];

export const AlertsPage = () => {
  const { alerts, updateAlertStatus, navigate, currentUser, routeParams } = useSoc();
  const canManage = ["ADMIN", "ANALYST"].includes(currentUser?.role);
  const [query, setQuery] = useState(routeParams.query || "");
  const [severity, setSeverity] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [actionError, setActionError] = useState("");
  const [responseActions, setResponseActions] = useState({});
  const [pendingResponseAction, setPendingResponseAction] = useState(null);
  const [reconnectTokens, setReconnectTokens] = useState({});

  useEffect(() => {
    setQuery(routeParams.query || "");
  }, [routeParams.query]);

  const filteredAlerts = useMemo(() => alerts.filter((alert) => {
    const matchesQuery = !query || [alert.id, alert.eventId, alert.title, alert.rule, alert.host, alert.sourceIp, alert.user].some((value) => value?.toLowerCase().includes(query.toLowerCase()));
    return matchesQuery && (severity === "ALL" || alert.severity === severity) && (status === "ALL" || alert.status === status);
  }), [alerts, query, severity, status]);

  const changeStatus = async (alert, status) => {
    setActionError("");
    try {
      await updateAlertStatus(alert.id, status);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not update alert status.");
    }
  };

  const promptResponseAction = (alert, actionType) => {
    const details = {
      BLOCK_ENDPOINT_IP: `Block ${alert.host}'s registered endpoint IP locally on that endpoint only. The platform and other endpoints are not targeted. This will interrupt that endpoint's network traffic.`,
      UNBLOCK_ENDPOINT_IP: `Remove Dejen-managed firewall block rules for ${alert.host}'s own IP only. The command may remain queued until the endpoint can check in.`,
      ISOLATE_ENDPOINT: `Disable all network adapters on ${alert.host}. Network access must be restored locally.`,
      UNISOLATE_ENDPOINT: `Re-enable only the adapters Dejen disabled on ${alert.host}. If it is offline, restore network connectivity locally so the queued action can run.`,
      DISCONNECT_AGENT: `Stop the Dejen agent on ${alert.host}, disable its automatic startup, and revoke its platform key. Re-enrollment is required to reconnect.`,
    };
    setPendingResponseAction({ alertId: alert.id, actionType, details: details[actionType] });
  };

  const connectAgent = async (alert) => {
    setReconnectTokens((current) => ({
      ...current,
      [alert.id]: { busy: true, message: "" },
    }));
    try {
      const token = await agentsApi.createReconnectToken(alert.agentId);
      setReconnectTokens((current) => ({
        ...current,
        [alert.id]: { busy: false, token: token.token, expiresAt: token.expires_at },
      }));
    } catch (error) {
      setReconnectTokens((current) => ({
        ...current,
        [alert.id]: {
          busy: false,
          message: error instanceof Error ? error.message : "Could not create a reconnect token.",
        },
      }));
    }
  };

  const requestResponseAction = async (alert, actionType) => {
    setPendingResponseAction(null);
    setActionError("");
    setResponseActions((current) => ({
      ...current,
      [alert.id]: { ...current[alert.id], busy: true, message: "Submitting action…" },
    }));
    try {
      const actions = await alertsApi.requestResponseAction(alert.id, actionType);
      setResponseActions((current) => ({
        ...current,
        [alert.id]: {
          busy: false,
          actions,
          message: `${actions.length} endpoint action${actions.length === 1 ? "" : "s"} queued.`,
        },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not queue response action.";
      setResponseActions((current) => ({
        ...current,
        [alert.id]: { ...current[alert.id], busy: false, message },
      }));
    }
  };

  const actionPollKey = Object.entries(responseActions)
    .filter(([, state]) => state.actions?.some((action) => ["PENDING", "RUNNING"].includes(action.status)))
    .map(([alertId]) => alertId)
    .join(",");

  useEffect(() => {
    if (!actionPollKey) return undefined;
    let active = true;
    const pollActions = async () => {
      const alertIds = actionPollKey.split(",");
      const results = await Promise.allSettled(alertIds.map((alertId) => alertsApi.getResponseActions(alertId)));
      if (!active) return;
      setResponseActions((current) => {
        const next = { ...current };
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            next[alertIds[index]] = { ...next[alertIds[index]], actions: result.value };
          }
        });
        return next;
      });
    };
    const interval = window.setInterval(pollActions, 2000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [actionPollKey]);

  return <GlassWorkspace>
    <div className="space-y-5">
      <div className="border-b border-black/10 pb-3">
        <h1 className="text-xl font-bold">Alerts</h1>
        <p className="mt-1 text-sm text-[#62686d]">Alerts recorded by backend detection rules</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-black/10 bg-white p-3">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search title, host, IP, or user" className="min-w-52 flex-1 rounded-md border border-black/15 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-700" />
        <select value={severity} onChange={(event) => setSeverity(event.target.value)} className="rounded-md border border-black/15 bg-white px-3 py-2 text-xs">
          {["ALL", "CRITICAL", "HIGH", "MEDIUM", "LOW"].map((item) => <option key={item} value={item}>{item === "ALL" ? "All severities" : item}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-md border border-black/15 bg-white px-3 py-2 text-xs">
          {["ALL", ...ALERT_STATUSES].map((item) => <option key={item} value={item}>{item === "ALL" ? "All statuses" : item}</option>)}
        </select>
        <span className="text-xs text-[#62686d]">{filteredAlerts.length} records</span>
      </div>
      {actionError && <p role="alert" className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">{actionError}</p>}
      <AlertTable alerts={filteredAlerts} canManage={canManage} canConnectAgent={currentUser?.role === "ADMIN"} onOpen={(alert) => navigate(`/alerts/${alert.id}`)} onStatusChange={changeStatus} onResponseAction={promptResponseAction} onConfirmResponseAction={requestResponseAction} onCancelResponseAction={() => setPendingResponseAction(null)} onConnectAgent={connectAgent} reconnectTokens={reconnectTokens} pendingResponseAction={pendingResponseAction} responseActions={responseActions} />
    </div>
  </GlassWorkspace>;
};
