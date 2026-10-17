import { useState } from "react";
import { huntingApi, type ApiEvent } from "../services/api";
import type {
  HuntPreset,
  HuntResult,
  HuntSeverity,
  HuntStatistics,
  QueryExecution,
  QueryValidationError,
} from "../types/threatHunting";

export const HUNT_PRESETS: HuntPreset[] = [
  { id: "cobalt", name: "Cobalt Strike Named Pipe Beaconing", description: "Search process and network telemetry for beacon indicators.", query: 'message CONTAINS "beacon" OR message CONTAINS "cobalt strike"', technique: "T1071" },
  { id: "pth", name: "Pass-the-Hash via WMI", description: "Find remote management and authentication activity.", query: 'event_type CONTAINS "authentication" AND message CONTAINS "wmi"', technique: "T1021" },
  { id: "lolbas", name: "LOLBAS Process Execution", description: "Look for signed utility execution described in event messages.", query: 'message CONTAINS "rundll32" OR message CONTAINS "regsvr32"', technique: "T1218" },
  { id: "dns", name: "DNS Tunneling", description: "Inspect events describing unusual DNS traffic.", query: 'message CONTAINS "dns" AND severity != "LOW"', technique: "T1071.004" },
  { id: "encoded", name: "Encoded PowerShell", description: "Hunt encoded PowerShell activity.", query: 'process.name = "powershell.exe" AND process.command_line CONTAINS "encoded"', technique: "T1059.001" },
  { id: "powershell", name: "Suspicious PowerShell", description: "Find PowerShell activity with elevated severity.", query: 'process.name = "powershell.exe" AND severity = "CRITICAL"', technique: "T1059.001" },
  { id: "credential", name: "Credential Dumping", description: "Search for LSASS and credential access references.", query: 'message CONTAINS "credential" OR message CONTAINS "lsass"', technique: "T1003" },
  { id: "lateral", name: "Lateral Movement", description: "Search remote access and cross-host activity.", query: 'message CONTAINS "remote" OR message CONTAINS "lateral movement"', technique: "T1021" },
  { id: "auth", name: "Abnormal Authentication", description: "Review failed or unusual authentication events.", query: 'event_type CONTAINS "authentication" OR message CONTAINS "login"', technique: "T1110" },
  { id: "outbound", name: "Unusual Outbound Connection", description: "Find higher-severity network connection events.", query: 'event_type CONTAINS "network" AND severity != "LOW"', technique: "T1071" },
];

const FIELD_ALIASES: Record<string, string> = {
  "event.category": "event.category",
  "event.type": "event.type",
  event_type: "event.type",
  "process.name": "process.name",
  "process.command_line": "process.command_line",
  "user.name": "user.name",
  username: "user.name",
  host: "host",
  severity: "severity",
  message: "message",
  timestamp: "timestamp",
  "source.ip": "source.ip",
  source_ip: "source.ip",
  "destination.ip": "destination.ip",
  destination_ip: "destination.ip",
  agent_id: "agent_id",
};

function inferProcess(message: string): string | undefined {
  const match = message.match(/\b(powershell(?:\.exe)?|cmd(?:\.exe)?|rundll32(?:\.exe)?|regsvr32(?:\.exe)|wmic(?:\.exe))\b/i);
  if (!match) return undefined;
  const process = match[1].toLowerCase();
  return process.endsWith(".exe") ? process : `${process}.exe`;
}

function eventCategory(eventType: string): string {
  if (/process/i.test(eventType)) return "process";
  if (/auth|login|ssh/i.test(eventType)) return "authentication";
  if (/network|connection|dns/i.test(eventType)) return "network";
  return "security";
}

function techniqueFor(message: string) {
  if (/powershell|encoded command/i.test(message)) return { id: "T1059.001", name: "PowerShell", tactic: "Execution" };
  if (/credential|lsass|password dump/i.test(message)) return { id: "T1003", name: "OS Credential Dumping", tactic: "Credential Access" };
  if (/wmi|remote|ssh/i.test(message)) return { id: "T1021", name: "Remote Services", tactic: "Lateral Movement" };
  if (/dns|network connection|external destination/i.test(message)) return { id: "T1071", name: "Application Layer Protocol", tactic: "Command and Control" };
  return undefined;
}

function fieldValue(event: ApiEvent, field: string): string | undefined {
  const process = inferProcess(event.message);
  const values: Record<string, string | null | undefined> = {
    "event.category": eventCategory(event.event_type),
    "event.type": event.event_type,
    "process.name": process,
    "process.command_line": process ? event.message : undefined,
    "user.name": event.username,
    host: event.host,
    severity: event.severity,
    message: event.message,
    timestamp: event.timestamp,
    "source.ip": event.source_ip,
    "destination.ip": undefined,
    agent_id: event.agent_id,
  };
  return values[field]?.toString();
}

export function toHuntResult(event: ApiEvent): HuntResult {
  const severity = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(event.severity) ? event.severity as HuntSeverity : "LOW";
  const process = inferProcess(event.message);
  return {
    id: event.event_id,
    eventId: event.event_id,
    timestamp: event.timestamp,
    severity,
    eventType: event.event_type,
    host: event.host || undefined,
    user: event.username || undefined,
    sourceIp: event.source_ip || undefined,
    process,
    commandLine: process ? event.message : undefined,
    mitreTechnique: techniqueFor(event.message),
    message: event.message,
    rawEvent: event,
  };
}

function validateAndMatch(query: string, event: ApiEvent): boolean {
  const matches = [...query.matchAll(/([\w.]+)\s*(CONTAINS|!=|=|:)\s*("[^"]*"|'[^']*'|[^\s]+)/gi)];
  if (!matches.length) throw { line: 1, message: "Unsupported syntax. Use field = value, !=, CONTAINS, or field:value." } satisfies QueryValidationError;

  const conditions = matches.map((match, index) => {
    const valueIndex = match.index ?? 0;
    const previousEnd = index === 0 ? 0 : (matches[index - 1].index ?? 0) + matches[index - 1][0].length;
    const connector = query.slice(previousEnd, valueIndex).trim().toUpperCase();
    if (index === 0 && connector) {
      throw { line: 1, message: `Expected a field before ${connector}.` } satisfies QueryValidationError;
    }
    if (connector && connector !== "AND" && connector !== "OR") {
      const line = query.slice(0, valueIndex).split("\n").length;
      throw { line, message: "Expected AND or OR between conditions." } satisfies QueryValidationError;
    }
    const field = FIELD_ALIASES[match[1].toLowerCase()];
    if (!field) {
      const line = query.slice(0, valueIndex).split("\n").length;
      throw { line, message: `Unknown field "${match[1]}".` } satisfies QueryValidationError;
    }
    const rawValue = match[3].replace(/^("|')|("|')$/g, "");
    const actual = fieldValue(event, field)?.toLowerCase();
    const expected = rawValue.toLowerCase();
    const operator = match[2].toUpperCase();
    const matchesValue = operator === "CONTAINS" ? actual?.includes(expected) === true : operator === "!=" ? actual !== undefined && actual !== expected : actual === expected;
    return { connector, matches: matchesValue };
  });

  const trailing = query.slice((matches[matches.length - 1].index ?? 0) + matches[matches.length - 1][0].length).trim();
  if (trailing && trailing !== "AND" && trailing !== "OR") {
    throw { line: query.split("\n").length, message: "Could not parse the final condition." } satisfies QueryValidationError;
  }
  if (trailing) throw { line: query.split("\n").length, message: `Expected a condition after ${trailing}.` } satisfies QueryValidationError;

  const groups: boolean[][] = [[]];
  conditions.forEach(({ connector, matches: matched }, index) => {
    if (index && connector === "OR") groups.push([]);
    groups[groups.length - 1].push(matched);
  });
  return groups.some((group) => group.every(Boolean));
}

const emptyStatistics: HuntStatistics = { eventsScanned: 0, results: 0, hosts: 0, users: 0, externalIps: 0, executionMs: 0 };

export function useThreatHunting() {
  const [results, setResults] = useState<HuntResult[]>([]);
  const [statistics, setStatistics] = useState<HuntStatistics>(emptyStatistics);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<QueryValidationError | null>(null);
  const [execution, setExecution] = useState<QueryExecution | null>(null);

  const runQuery = async (query: string, from?: string, to?: string) => {
    setError(null);
    if (!query.trim()) {
      setError({ line: 1, message: "Enter a query or select a hunting preset." });
      return;
    }
    setIsRunning(true);
    const started = performance.now();
    try {
      validateAndMatch(query, {
        event_id: "",
        timestamp: new Date().toISOString(),
        agent_id: "",
        host: "",
        event_type: "",
        username: null,
        source_ip: null,
        message: "",
        severity: "LOW",
      });
      const telemetry = await huntingApi.searchTelemetry();
      const fromTime = from ? new Date(from).getTime() : 0;
      const toTime = to ? new Date(to).getTime() : Number.POSITIVE_INFINITY;
      const scopedEvents = telemetry.filter((event) => {
        const timestamp = new Date(event.timestamp).getTime();
        return timestamp >= fromTime && timestamp <= toTime;
      });
      const matched = scopedEvents.filter((event) => validateAndMatch(query, event));
      const rows = matched.map(toHuntResult);
      const elapsed = Math.round(performance.now() - started);
      const nextStatistics: HuntStatistics = {
        eventsScanned: scopedEvents.length,
        results: rows.length,
        hosts: new Set(rows.map((row) => row.host).filter(Boolean)).size,
        users: new Set(rows.map((row) => row.user).filter(Boolean)).size,
        externalIps: new Set(rows.map((row) => row.sourceIp).filter((ip) => ip && !/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.)/.test(ip))).size,
        executionMs: elapsed,
      };
      setResults(rows);
      setStatistics(nextStatistics);
      setExecution({ results: rows, statistics: nextStatistics, executedAt: new Date().toISOString() });
    } catch (requestError) {
      if (typeof requestError === "object" && requestError !== null && "line" in requestError && "message" in requestError) {
        setError(requestError as QueryValidationError);
      } else {
        setError({ line: 0, message: requestError instanceof Error ? requestError.message : "Query execution failed." });
      }
      setResults([]);
      setStatistics(emptyStatistics);
      setExecution(null);
    } finally {
      setIsRunning(false);
    }
  };

  const clearResults = () => {
    setResults([]);
    setStatistics(emptyStatistics);
    setError(null);
    setExecution(null);
  };

  return { results, statistics, isRunning, error, execution, runQuery, clearResults };
}