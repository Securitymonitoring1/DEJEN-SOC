import { SeverityLevel } from './alert';

export interface SecurityEvent {
  event_id: string;
  timestamp: string;
  agent_id: string;
  host: string;
  event_type: string;
  username: string;
  source_ip: string;
  message: string;
  severity: SeverityLevel;
}

export type Event = SecurityEvent;

export interface TimelineEvent {
  id: string;
  time: string;
  fullTimestamp: string;
  category: string;
  title: string;
  severity: SeverityLevel;
  host?: string;
  ip?: string;
  description: string;
}
