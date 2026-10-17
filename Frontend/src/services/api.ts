import type { HuntQuery } from "../types/threatHunting";

export interface ApiAlert {
  alert_id: string;
  created_at: string;
  event_id: string;
  rule_name: string;
  title: string;
  description: string;
  severity: string;
  risk_score: number;
  status: string;
}

export interface ApiEvent {
  event_id: string;
  timestamp: string;
  agent_id: string;
  host: string;
  event_type: string;
  username: string | null;
  source_ip: string | null;
  message: string;
  severity: string;
}

export interface ApiIncident {
  incident_id: string;
  alert_id: string;
  title: string;
  description: string;
  severity: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface DashboardSummary {
  total_events: number;
  total_alerts: number;
  open_alerts: number;
  critical_alerts: number;
  total_incidents: number;
  open_incidents: number;
  investigating_incidents: number;
  resolved_incidents: number;
  total_endpoints: number;
  active_endpoints: number;
}

export interface ManagedAgent {
  id: string;
  name: string;
  os_type: "windows" | "linux" | "macos";
  host: string | null;
  ip_address: string | null;
  status: "Active" | "Disconnected" | "Never connected";
  last_seen: string | null;
  version: string | null;
  created_at: string;
}

export interface EnrollmentToken {
  token: string;
  agent_name: string;
  os: "windows" | "linux" | "macos";
  expires_at: string;
}

export interface EndpointAction {
  action_id: string;
  alert_id: string;
  agent_id: string;
  action_type: "BLOCK_ENDPOINT_IP" | "UNBLOCK_ENDPOINT_IP" | "ISOLATE_ENDPOINT" | "UNISOLATE_ENDPOINT" | "DISCONNECT_AGENT";
  target_ip: string | null;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED";
  requested_by: string;
  result: string | null;
  created_at: string;
  updated_at: string;
}

const API_BASE = import.meta.env.VITE_API_URL || "";

export function getAuthToken(): string | null {
  return localStorage.getItem("dejen.token");
}

export function setAuthToken(token: string | null): void {
  if (token) localStorage.setItem("dejen.token", token);
  else localStorage.removeItem("dejen.token");
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  const token = getAuthToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401 && token && endpoint !== "/auth/login") {
      const shouldNotify = getAuthToken() === token;
      setAuthToken(null);
      if (shouldNotify) window.dispatchEvent(new Event("dejen:unauthorized"));
      throw new Error("Your session is no longer valid. Please sign in again.");
    }
    let message = body || `Request failed with status ${response.status}`;
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed.detail === "string") message = parsed.detail;
    } catch {
      // Keep the response text when it is not JSON.
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const authApi = {
  async login(username: string, password: string): Promise<{ access_token: string; token_type: string }> {
    const result = await apiRequest<{ access_token: string; token_type: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setAuthToken(result.access_token);
    return result;
  },
  logout(): void {
    setAuthToken(null);
  },
};

export const dashboardApi = {
  getSummary: () => apiRequest<DashboardSummary>("/dashboard/summary"),
};

export const agentsApi = {
  getAll: () => apiRequest<ManagedAgent[]>("/agents"),
  createReconnectToken: (agentId: string) => apiRequest<EnrollmentToken>(`/agents/${agentId}/reconnect-token`, { method: "POST" }),
  createEnrollmentToken: (data: { name: string; os: "windows" | "linux" | "macos"; expires_in_minutes: number }) =>
    apiRequest<EnrollmentToken>("/agents/tokens", { method: "POST", body: JSON.stringify(data) }),
  remove: (id: string) => apiRequest<void>(`/agents/${id}`, { method: "DELETE" }),
  installerUrl: (os: "windows" | "linux" | "macos") => `${API_BASE}/agents/installers/${os}`,
};

export const eventsApi = {
  getAll: () => apiRequest<ApiEvent[]>("/events"),
  getById: (id: string) => apiRequest<ApiEvent>(`/events/${id}`),
  create: (event: Omit<ApiEvent, "event_id" | "timestamp">) => apiRequest<ApiEvent>("/events", {
    method: "POST",
    body: JSON.stringify(event),
  }),
};

const SAVED_HUNTS_KEY = "dejen.hunting.saved";

export const huntingApi = {
  searchTelemetry: () => eventsApi.getAll(),
  getSavedQueries(): HuntQuery[] {
    try {
      return JSON.parse(localStorage.getItem(SAVED_HUNTS_KEY) || "[]") as HuntQuery[];
    } catch {
      return [];
    }
  },
  saveQuery(query: HuntQuery): HuntQuery[] {
    const saved = [query, ...this.getSavedQueries().filter((item) => item.id !== query.id)];
    localStorage.setItem(SAVED_HUNTS_KEY, JSON.stringify(saved));
    return saved;
  },
};

export const alertsApi = {
  getAll: () => apiRequest<ApiAlert[]>("/alerts"),
  getById: (id: string) => apiRequest<ApiAlert>(`/alerts/${id}`),
  create: (data: Omit<ApiAlert, "alert_id" | "created_at" | "status">) => apiRequest<ApiAlert>("/alerts", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  updateStatus: (id: string, status: string) => apiRequest<ApiAlert>(`/alerts/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  }),
  requestResponseAction: (id: string, action_type: EndpointAction["action_type"]) =>
    apiRequest<EndpointAction[]>(`/alerts/${id}/response-actions`, {
      method: "POST",
      body: JSON.stringify({ action_type }),
    }),
  getResponseActions: (id: string) => apiRequest<EndpointAction[]>(`/alerts/${id}/response-actions`),
};

export interface IncidentCreateInput {
  alert_id: string;
  title: string;
  description: string;
  severity: string;
  assigned_to?: string | null;
}

export interface InvestigationNote {
  note_id: string;
  incident_id: string;
  user_id: number;
  username: string;
  role: string;
  content: string;
  created_at: string;
}

export interface IncidentAction {
  action_id: string;
  incident_id: string;
  user_id: number;
  username: string;
  role: string;
  action_type: string;
  description: string;
  created_at: string;
}

export const incidentsApi = {
  getAll: () => apiRequest<ApiIncident[]>("/incidents"),
  getById: (id: string) => apiRequest<ApiIncident>(`/incidents/${id}`),
  create: (data: IncidentCreateInput) => apiRequest<ApiIncident>("/incidents", {
    method: "POST",
    body: JSON.stringify(data),
  }),
  updateStatus: (id: string, status: string) => apiRequest<ApiIncident>(`/incidents/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  }),
  assign: (id: string, assigned_to: string | null) => apiRequest<ApiIncident>(`/incidents/${id}/assign`, {
    method: "PATCH",
    body: JSON.stringify({ assigned_to }),
  }),
  getNotes: (id: string) => apiRequest<InvestigationNote[]>(`/incidents/${id}/notes`),
  addNote: (id: string, content: string) => apiRequest<InvestigationNote>(`/incidents/${id}/notes`, {
    method: "POST",
    body: JSON.stringify({ content }),
  }),
  getActions: (id: string) => apiRequest<IncidentAction[]>(`/incidents/${id}/actions`),
};
