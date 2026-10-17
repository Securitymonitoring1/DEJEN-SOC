import type { ApiEvent } from "../services/api";

export type HuntLanguage = "DEJEN Query";
export type HuntSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface HuntQuery {
  id: string;
  name: string;
  query: string;
  language: HuntLanguage;
  createdAt: string;
}

export interface HuntPreset {
  id: string;
  name: string;
  description: string;
  query: string;
  technique?: string;
}

export interface MITRETechnique {
  id: string;
  name: string;
  tactic: string;
}

export interface HuntResult {
  id: string;
  eventId: string;
  timestamp: string;
  severity: HuntSeverity;
  eventType: string;
  host?: string;
  user?: string;
  sourceIp?: string;
  destinationIp?: string;
  process?: string;
  parentProcess?: string;
  commandLine?: string;
  mitreTechnique?: MITRETechnique;
  message: string;
  rawEvent: ApiEvent;
}

export interface SecurityEvent extends ApiEvent {}

export interface HuntStatistics {
  eventsScanned: number;
  results: number;
  hosts: number;
  users: number;
  externalIps: number;
  executionMs: number;
}

export interface QueryExecution {
  results: HuntResult[];
  statistics: HuntStatistics;
  executedAt: string;
}

export interface QueryValidationError {
  line: number;
  message: string;
}