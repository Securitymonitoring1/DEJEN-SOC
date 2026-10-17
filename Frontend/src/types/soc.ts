export * from './alert';
export * from './event';
export * from './incident';

export type ReportType =
  | 'DAILY_SECURITY'
  | 'ALERT_REPORT'
  | 'INCIDENT_REPORT'
  | 'AGENT_REPORT'
  | 'THREAT_REPORT';

export interface SecurityReport {
  id: string;
  title: string;
  type: ReportType;
  classification?: string;
  createdAt: string;
  author: string;
  incidentRef?: string;
  status: 'FINAL' | 'DRAFT';
  summary: string;
  findings: string[];
  iocs?: string[];
  remediationSteps?: string[];
  signOff?: {
    signedBy: string;
    role: string;
    timestamp: string;
    verifiedSignature: string;
  };
}

