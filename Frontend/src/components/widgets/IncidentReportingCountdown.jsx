import { useEffect, useState } from "react";

const REPORTING_WINDOW_MS = 48 * 60 * 60 * 1000;

const formatRemaining = (milliseconds) => {
  const totalSeconds = Math.floor(Math.max(0, milliseconds) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
};

export const IncidentReportingCountdown = ({ createdAt, compact = false }) => {
  const [now, setNow] = useState(Date.now());
  const createdAtMs = new Date(createdAt).getTime();

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  if (!Number.isFinite(createdAtMs)) return <span>Unavailable</span>;

  const remainingMs = createdAtMs + REPORTING_WINDOW_MS - now;
  const status = remainingMs <= 0 ? "Overdue" : remainingMs <= 12 * 60 * 60 * 1000 ? "Urgent" : remainingMs <= 24 * 60 * 60 * 1000 ? "Due soon" : "On track";
  const statusClass = remainingMs <= 0 ? "text-red-700" : remainingMs <= 12 * 60 * 60 * 1000 ? "text-orange-700" : remainingMs <= 24 * 60 * 60 * 1000 ? "text-amber-700" : "text-[#287b70]";

  return <span className={compact ? "whitespace-nowrap" : "block"}>
    <span className={`font-semibold ${statusClass}`}>{formatRemaining(remainingMs)}</span>
    <span className={compact ? "ml-2 text-[10px] text-[#62686d]" : `mt-1 block text-[10px] font-medium ${statusClass}`}>{status}</span>
  </span>;
};