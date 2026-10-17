import { SeverityLevel } from './alert';
export type { SeverityLevel };

export type IncidentStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';

export interface Incident {
  id: string;
  title: string;
  severity: SeverityLevel;
  assignedAnalyst: string;
  status: IncidentStatus;
  createdAt: string;
  updatedAt?: string;
  summary: string;
  affectedAssets: string[];
  alertIds: string[];
  slaDeadline?: string;
  slaRemainingMs?: number;
  slaState?: string;
  evidence?: Array<{
    id: string;
    type: string;
    name: string;
    hash: string;
    collectedAt: string;
    collectedBy: string;
    size: string;
    verified: boolean;
  }>;
  notes?: Array<{
    id: string;
    author: string;
    role?: string;
    timestamp: string;
    text: string;
  }>;
  mitreTactics?: string[];
}

export type SecurityIncident = Incident;
