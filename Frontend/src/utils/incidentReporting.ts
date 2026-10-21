export const INCIDENT_REPORTING_WINDOW_MS = 48 * 60 * 60 * 1000;

export const getIncidentReportingDeadline = (startedAt: string) => {
  const timestamp = /(?:z|[+-]\d{2}:?\d{2})$/i.test(startedAt)
    ? startedAt
    : `${startedAt}Z`;
  const startedAtMs = new Date(timestamp).getTime();
  return Number.isFinite(startedAtMs)
    ? new Date(startedAtMs + INCIDENT_REPORTING_WINDOW_MS)
    : null;
};