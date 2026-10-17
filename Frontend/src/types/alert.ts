export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';

export type AlertStatus = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';

export interface Alert {
  id: string;
  rule: string;
  title?: string;
  ruleId?: string;
  sourceIp: string;
  destinationIp?: string;
  host: string;
  severity: SeverityLevel;
  status: AlertStatus;
  timestamp: string;
  mitreTechnique?: string;
  mitreTactic?: string;
  user?: string;
  summary?: string;
  acknowledged?: boolean;
  process?: string;
  hash?: string;
}

export type SecurityAlert = Alert;
