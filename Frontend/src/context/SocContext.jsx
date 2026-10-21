import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { agentsApi, authApi, alertsApi, dashboardApi, eventsApi, incidentsApi, getAuthToken, setAuthToken } from "../services/api";

/** @type {import('react').Context<any>} */
const SocContext = createContext(null);
const REPORTS_REFRESH_INTERVAL_MS = 2000;

function getInitialTheme() {
  if (typeof window === "undefined") return "light";

  const saved = localStorage.getItem("dejen.theme");
  const manualChoice = localStorage.getItem("dejen.theme.manual");

  if (saved === "light" || saved === "dark") return saved;
  if (manualChoice === "light") return "light";
  if (manualChoice === "dark") return "dark";

  return "light";
}

function getInitialAudioSettings() {
  if (typeof window === "undefined") return { muted: false, volume: 0.5 };
  try {
    const saved = localStorage.getItem("dejen.settings");
    if (!saved) return { muted: false, volume: 0.5 };
    const parsed = JSON.parse(saved);
    return {
      muted: Boolean(parsed.audioMuted),
      volume: typeof parsed.audioVolume === "number" ? parsed.audioVolume : 0.5,
    };
  } catch {
    return { muted: false, volume: 0.5 };
  }
}

function getInitialDetectionInterval() {
  if (typeof window === "undefined") return 5;
  const saved = Number(localStorage.getItem("dejen.detectionIntervalSeconds"));
  if (!Number.isInteger(saved) || saved < 1 || saved > 30) return 5;
  return saved;
}

function getInitialDetectionEnabled() {
  if (typeof window === "undefined") return true;
  const saved = localStorage.getItem("dejen.detectionEnabled");
  return saved === null ? true : saved === "true";
}

function parseRoute(path) {
  const clean = path.split("?")[0];
  const searchParams = new URLSearchParams(path.split("?")[1] || "");
  const query = searchParams.get("query") || "";
  const entity = searchParams.get("entity") || "";
  const entityType = searchParams.get("type") || "";
  const context = {
    host: searchParams.get("host") || "",
    user: searchParams.get("user") || "",
    process: searchParams.get("process") || "",
    ip: searchParams.get("ip") || "",
  };
  const alertMatch = clean.match(/^\/alerts\/([^/]+)$/);
  if (alertMatch) return { path: "/alerts/:id", params: { id: alertMatch[1], query, ...context } };
  const huntMatch = clean.match(/^\/hunting\/([^/]+)$/);
  if (huntMatch) return { path: "/hunting/:id", params: { id: huntMatch[1], query, ...context } };
  const incidentMatch = clean.match(/^\/incidents\/([^/]+)$/);
  if (incidentMatch) return { path: "/incidents/:id", params: { id: incidentMatch[1], query, ...context } };
  return { path: clean || "/", params: { query, entity, entityType, ...context } };
}

function readTokenUser(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    if (payload.exp && payload.exp * 1000 <= Date.now()) return null;
    return {
      id: payload.sub,
      username: payload.username,
      name: payload.username,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

function normalizeAlert(alert, events, agentsById = {}) {
  const event = events.find((item) => item.event_id === alert.event_id);
  const agent = event?.agent_id ? agentsById[event.agent_id] : null;
  return {
    id: alert.alert_id,
    alertId: alert.alert_id,
    eventId: alert.event_id,
    rule: alert.rule_name,
    ruleId: alert.rule_name,
    title: alert.title,
    description: alert.description,
    summary: alert.description,
    severity: alert.severity,
    riskScore: alert.risk_score,
    status: alert.status,
    timestamp: alert.created_at,
    host: event?.host || "Unknown host",
    agentId: event?.agent_id || "",
    deviceIp: agent?.ip_address || "Not recorded (local or unavailable)",
    sourceIp: event?.source_ip || "Unknown IP",
    user: event?.username || "Unknown user",
    eventType: event?.event_type || "Unknown event",
  };
}

function normalizeIncident(incident, alerts) {
  const alert = alerts.find((item) => item.alertId === incident.alert_id);
  return {
    id: incident.incident_id,
    alertId: incident.alert_id,
    title: incident.title,
    summary: incident.description,
    description: incident.description,
    severity: incident.severity,
    status: incident.status,
    assignedAnalyst: incident.assigned_to || "Unassigned",
    assignedTo: incident.assigned_to,
    createdAt: incident.created_at,
    reportingStartedAt: incident.created_at,
    updatedAt: incident.updated_at,
    affectedAssets: alert && alert.host !== "Unknown host" ? [alert.host] : [],
    alertIds: [incident.alert_id],
  };
}

export const SocProvider = ({ children }) => {
  const [initialRoute] = useState(() => parseRoute(`${window.location.pathname}${window.location.search}`));
  const [currentRoute, setCurrentRoute] = useState(initialRoute.path);
  const [routeParams, setRouteParams] = useState(initialRoute.params);
  const [currentUser, setCurrentUser] = useState(() => readTokenUser(getAuthToken() || ""));
  const [theme, setThemeState] = useState(getInitialTheme);
  const [audioMuted, setAudioMutedState] = useState(() => getInitialAudioSettings().muted);
  const [audioVolume, setAudioVolumeState] = useState(() => getInitialAudioSettings().volume);
  const [detectionEnabled, setDetectionEnabledState] = useState(getInitialDetectionEnabled);
  const [detectionIntervalSeconds, setDetectionIntervalSecondsState] = useState(getInitialDetectionInterval);
  const [agents, setAgents] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [error, setError] = useState("");

  const navigate = (to) => {
    window.history.pushState({}, "", to);
    const route = parseRoute(to);
    setCurrentRoute(route.path);
    setRouteParams(route.params);
    window.scrollTo(0, 0);
  };

  const refreshData = useCallback(async () => {
    if (!getAuthToken()) return;
    setLoading(true);
    setError("");
    try {
      const [apiEvents, apiAlerts, apiIncidents, apiSummary, apiAgents] = await Promise.all([
        eventsApi.getAll(),
        alertsApi.getAll(),
        incidentsApi.getAll(),
        dashboardApi.getSummary(),
        agentsApi.getAll(),
      ]);
      const agentsById = Object.fromEntries(apiAgents.map((agent) => [agent.id, agent]));
      const normalizedAlerts = apiAlerts.map((alert) => normalizeAlert(alert, apiEvents, agentsById));
      setEvents(apiEvents);
      setAgents(apiAgents);
      setAlerts(normalizedAlerts);
      setIncidents(apiIncidents.map((incident) => normalizeIncident(incident, normalizedAlerts)));
      setSummary(apiSummary);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load data from the backend.");
    } finally {
      setLoading(false);
      setInitialDataLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", theme === "dark");
      localStorage.setItem("dejen.theme", theme);
      localStorage.setItem("dejen.theme.manual", theme);
    }
  }, [theme]);

  useEffect(() => {
    const settings = { audioMuted, audioVolume };
    if (typeof window !== "undefined") {
      localStorage.setItem("dejen.settings", JSON.stringify(settings));
      localStorage.setItem("dejen.detectionIntervalSeconds", String(detectionIntervalSeconds));
      localStorage.setItem("dejen.detectionEnabled", String(detectionEnabled));
    }
  }, [audioMuted, audioVolume, detectionEnabled, detectionIntervalSeconds]);

  useEffect(() => {
    const onPopState = () => {
      const route = parseRoute(`${window.location.pathname}${window.location.search}`);
      setCurrentRoute(route.path);
      setRouteParams(route.params);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (currentUser) refreshData();
  }, [currentUser]);

  useEffect(() => {
    const isReportsRoute = currentRoute.startsWith("/reports");
    const isEventsRoute = currentRoute === "/event-viewer";
    if (!currentUser || (!detectionEnabled && !isReportsRoute && !isEventsRoute)) return undefined;
    const interval = isReportsRoute || isEventsRoute ? REPORTS_REFRESH_INTERVAL_MS : detectionIntervalSeconds * 1000;
    const intervalId = window.setInterval(refreshData, interval);
    return () => window.clearInterval(intervalId);
  }, [currentUser, currentRoute, detectionEnabled, detectionIntervalSeconds, refreshData]);

  const setTheme = (nextTheme) => setThemeState(nextTheme === "light" ? "light" : "dark");
  const toggleTheme = () => setThemeState((current) => current === "dark" ? "light" : "dark");
  const setAudioMuted = (muted) => setAudioMutedState(Boolean(muted));
  const setAudioVolume = (volume) => setAudioVolumeState(Math.max(0, Math.min(1, Number(volume) || 0)));
  const setDetectionEnabled = () => setDetectionEnabledState((current) => !current);
  const setDetectionIntervalSeconds = (seconds) => setDetectionIntervalSecondsState(Math.max(1, Math.min(30, Number(seconds) || 1)));
  const simulateTriggerEvent = async () => {
    await refreshData();
    return true;
  };
  const resetLayout = () => {
    navigate("/dashboard");
    setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 20);
  };

  const login = async (username, password) => {
    try {
      const result = await authApi.login(username, password);
      const user = readTokenUser(result.access_token);
      if (!user) throw new Error("The backend returned an invalid access token.");
      setInitialDataLoaded(false);
      setCurrentUser(user);
      setError("");
      return true;
    } catch (loginError) {
      setAuthToken(null);
      setError(loginError instanceof Error ? loginError.message : "Login failed.");
      return false;
    }
  };

  const logout = () => {
    authApi.logout();
    setCurrentUser(null);
    setInitialDataLoaded(false);
    setAlerts([]);
    setIncidents([]);
    setAgents([]);
    setEvents([]);
    setSummary(null);
    navigate("/login");
  };

  useEffect(() => {
    const handleUnauthorized = () => {
      authApi.logout();
      setCurrentUser(null);
      setInitialDataLoaded(false);
      setAlerts([]);
      setIncidents([]);
      setAgents([]);
      setEvents([]);
      setSummary(null);
      setError("Your session is no longer valid. Please sign in again.");
      window.history.replaceState({}, "", "/login");
      setCurrentRoute("/login");
      setRouteParams(parseRoute("/login").params);
    };
    window.addEventListener("dejen:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("dejen:unauthorized", handleUnauthorized);
  }, []);

  const updateAlertStatus = async (id, status) => {
    const updated = await alertsApi.updateStatus(id, status);
    setAlerts((items) => items.map((item) => item.id === id ? { ...item, status: updated.status } : item));
  };

  const updateIncidentStatus = async (id, status) => {
    const updated = await incidentsApi.updateStatus(id, status);
    setIncidents((items) => items.map((item) => item.id === id ? normalizeIncident(updated, alerts) : item));
  };

  const assignIncident = async (id, assignedTo) => {
    const updated = await incidentsApi.assign(id, assignedTo || null);
    setIncidents((items) => items.map((item) => item.id === id ? normalizeIncident(updated, alerts) : item));
  };

  const createIncident = async (data) => {
    const created = await incidentsApi.create(data);
    const incident = normalizeIncident(created, alerts);
    setIncidents((items) => [incident, ...items]);
    return incident;
  };

  const createEvent = async (data) => {
    await eventsApi.create(data);
    await refreshData();
  };

  const deleteEvent = async (id, password) => {
    const result = await eventsApi.deleteOne(id, password);
    await refreshData();
    return result.deleted_events;
  };

  const deleteAllEvents = async (password) => {
    const result = await eventsApi.deleteAll(password);
    await refreshData();
    return result.deleted_events;
  };

  const isAuthenticated = Boolean(currentUser && getAuthToken());

  return (
    <SocContext.Provider value={{
      currentUser,
      isAuthenticated,
      initialDataLoading: Boolean(currentUser && !initialDataLoaded),
      login,
      logout,
      currentRoute,
      routeParams,
      navigate,
      alerts,
      agents,
      incidents,
      events,
      summary,
      loading,
      error,
      refreshData,
      updateAlertStatus,
      updateIncidentStatus,
      assignIncident,
      createIncident,
      createEvent,
      deleteEvent,
      deleteAllEvents,
      theme,
      setTheme,
      toggleTheme,
      audioMuted,
      setAudioMuted,
      audioVolume,
      setAudioVolume,
      detectionEnabled,
      setDetectionEnabled,
      detectionIntervalSeconds,
      setDetectionIntervalSeconds,
      simulateTriggerEvent,
      resetLayout,
    }}>
      {children}
    </SocContext.Provider>
  );
};

/** @returns {any} */
export const useSoc = () => {
  const context = useContext(SocContext);
  if (!context) throw new Error("useSoc must be used within a SocProvider");
  return context;
};
