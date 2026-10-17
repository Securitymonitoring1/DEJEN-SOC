import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Download, Eye, FileSpreadsheet, FileText, Search, X } from "lucide-react";
import { GlassWorkspace } from "../components/layout/GlassWorkspace";
import { PdfDocumentPreview } from "../components/PdfDocumentPreview";
import { useSoc } from "../context/SocContext";
import { createReportCsv, createReportPdf, triggerBrowserDownload } from "../utils/fileDownloader";

const formatDate = (value) => new Date(value).toLocaleString();
const reportDay = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
};
const REPORT_HISTORY_KEY = "dejen.reportHistory";
const REPORT_HISTORY_LIMIT = 25;

const readReportHistory = () => {
  try {
    const history = JSON.parse(localStorage.getItem(REPORT_HISTORY_KEY) || "[]");
    return Array.isArray(history) ? history : [];
  } catch {
    return [];
  }
};

const parseCsvRows = (content) => {
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '"') {
      if (insideQuotes && content[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (character === "," && !insideQuotes) {
      row.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !insideQuotes) {
      if (character === "\r" && content[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (field || row.length) {
    row.push(field);
    if (row.some((value) => value !== "")) rows.push(row);
  }
  return rows;
};

export const ReportsPage = () => {
  const { summary, alerts, incidents, events, loading, currentRoute, navigate, routeParams } = useSoc();
  const isArchivePage = currentRoute === "/reports/archive";
  const createdAt = new Date().toISOString();
  const [exporting, setExporting] = useState("");
  const [exportError, setExportError] = useState("");
  const [preview, setPreview] = useState(null);
  const [reportHistory, setReportHistory] = useState(readReportHistory);
  const [archiveSearch, setArchiveSearch] = useState(() => routeParams.query || "");
  const reportAuthor = "DEJEN SOC live data";
  useEffect(() => {
    if (isArchivePage) {
      setArchiveSearch(routeParams.query || "");
    }
  }, [isArchivePage, routeParams.query]);
  const reports = [
    {
      id: "SOC-SUMMARY",
      title: "Operations summary",
      type: "DAILY_SECURITY",
      classification: "INTERNAL_SOC",
      createdAt,
      author: reportAuthor,
      status: "DRAFT",
      summary: "Snapshot of dashboard totals currently returned by the backend.",
      findings: summary ? Object.entries(summary).map(([label, value]) => {
        const readableLabels = {
          total_events: "Events received",
          total_alerts: "Detections",
          open_alerts: "Open alerts",
          critical_alerts: "Critical alerts",
          total_incidents: "Total incidents",
          open_incidents: "Open incidents",
          investigating_incidents: "Incidents under investigation",
          resolved_incidents: "Resolved incidents",
        };
        return `${readableLabels[label] || label.replaceAll("_", " ")}: ${value}`;
      }) : ["Dashboard summary is not available yet."],
      iocs: [],
      remediationSteps: [],
      recordCount: Object.keys(summary || {}).length,
      description: "Counts for events, alerts, and incidents.",
    },
    {
      id: "SOC-ALERTS",
      title: "Alert register",
      type: "ALERT_REPORT",
      classification: "INTERNAL_SOC",
      createdAt,
      author: reportAuthor,
      status: "DRAFT",
      summary: `${alerts.length} alert record${alerts.length === 1 ? "" : "s"} returned by the backend at export time.`,
      findings: alerts.map((alert) => {
        const timestamp = new Date(alert.timestamp);
        const detectedAt = Number.isNaN(timestamp.getTime()) ? alert.timestamp : timestamp.toLocaleString();
        return [
          `${alert.severity} | ${alert.title}`,
          `Status: ${alert.status}  Rule: ${alert.rule}`,
          `Detected: ${detectedAt}`,
          `Host: ${alert.host}  Source IP: ${alert.sourceIp}`,
          `Description: ${alert.description}`,
        ].join("\n");
      }),
      iocs: [...new Set(alerts.map((alert) => alert.sourceIp).filter((value) => value && value !== "Unknown IP"))],
      remediationSteps: [],
      recordCount: alerts.length,
      description: "Detection titles, severity, status, and source details.",
    },
    {
      id: "SOC-INCIDENTS",
      title: "Incident register",
      type: "INCIDENT_REPORT",
      classification: "INTERNAL_SOC",
      createdAt,
      author: reportAuthor,
      status: "DRAFT",
      summary: `${incidents.length} incident record${incidents.length === 1 ? "" : "s"} returned by the backend at export time.`,
      findings: incidents.map((incident) => {
        const timestamp = new Date(incident.createdAt);
        const createdAt = Number.isNaN(timestamp.getTime()) ? incident.createdAt : timestamp.toLocaleString();
        return [
          `${incident.severity} | ${incident.title}`,
          `Status: ${incident.status}  Assigned to: ${incident.assignedAnalyst}`,
          `Created: ${createdAt}`,
          `Related alert: ${incident.alertId}`,
          `Details: ${incident.description}`,
        ].join("\n");
      }),
      iocs: [],
      remediationSteps: [],
      recordCount: incidents.length,
      description: "Incident status, assignment, severity, and descriptions.",
    },
    {
      id: "SOC-EVENTS",
      title: "Event telemetry",
      type: "THREAT_REPORT",
      classification: "INTERNAL_SOC",
      createdAt,
      author: reportAuthor,
      status: "DRAFT",
      summary: `${events.length} event record${events.length === 1 ? "" : "s"} returned by the backend at export time.`,
      findings: events.map((event) => {
        const timestamp = new Date(event.timestamp);
        const occurredAt = Number.isNaN(timestamp.getTime())
          ? event.timestamp
          : `${timestamp.toISOString().replace("T", " ").slice(0, 19)} UTC`;
        return [
          `${event.severity} | ${event.host} | ${event.event_type}`,
          `Time: ${occurredAt}  Agent: ${event.agent_id}`,
          `User: ${event.username || "-"}  Source IP: ${event.source_ip || "-"}`,
          `Activity: ${event.message}`,
        ].join("\n");
      }),
      iocs: [...new Set(events.map((event) => event.source_ip).filter(Boolean))],
      remediationSteps: [],
      recordCount: events.length,
      description: "Ingested event messages, hosts, agents, and source addresses.",
    },
  ];

  const reportById = Object.fromEntries(reports.map((report) => [report.id, report]));
  const sourceDates = [...new Set([
    ...events.map((event) => reportDay(event.timestamp)),
    ...alerts.map((alert) => reportDay(alert.timestamp)),
    ...incidents.map((incident) => reportDay(incident.createdAt)),
  ].filter(Boolean))].sort().reverse();
  const datedReports = sourceDates.flatMap((date) => {
    const dayEvents = events.filter((event) => reportDay(event.timestamp) === date);
    const dayAlerts = alerts.filter((alert) => reportDay(alert.timestamp) === date);
    const dayIncidents = incidents.filter((incident) => reportDay(incident.createdAt) === date);
    const dailyRuns = [{
      ...reportById["SOC-SUMMARY"],
      id: `SOC-SUMMARY-${date}`,
      sourceReportId: "SOC-SUMMARY",
      title: `Operations summary · ${date}`,
      createdAt: `${date}T12:00:00.000Z`,
      summary: `Security activity recorded on ${date}.`,
      findings: [
        `Events received: ${dayEvents.length}`,
        `Detections: ${dayAlerts.length}`,
        `Critical alerts: ${dayAlerts.filter((alert) => alert.severity === "CRITICAL").length}`,
        `Incidents opened: ${dayIncidents.length}`,
      ],
      recordCount: dayEvents.length + dayAlerts.length + dayIncidents.length,
      description: `Daily activity snapshot for ${date}.`,
    }];

    if (dayAlerts.length) {
      dailyRuns.push({
        ...reportById["SOC-ALERTS"],
        id: `SOC-ALERTS-${date}`,
        sourceReportId: "SOC-ALERTS",
        title: `Alert register · ${date}`,
        createdAt: `${date}T12:00:00.000Z`,
        summary: `${dayAlerts.length} alert records created on ${date}.`,
        findings: dayAlerts.map((alert) => [
          `${alert.severity} | ${alert.title}`,
          `Status: ${alert.status}  Rule: ${alert.rule}`,
          `Detected: ${formatDate(alert.timestamp)}`,
          `Host: ${alert.host}  Source IP: ${alert.sourceIp}`,
          `Description: ${alert.description}`,
        ].join("\n")),
        iocs: [...new Set(dayAlerts.map((alert) => alert.sourceIp).filter((value) => value && value !== "Unknown IP"))],
        recordCount: dayAlerts.length,
      });
    }

    if (dayIncidents.length) {
      dailyRuns.push({
        ...reportById["SOC-INCIDENTS"],
        id: `SOC-INCIDENTS-${date}`,
        sourceReportId: "SOC-INCIDENTS",
        title: `Incident register · ${date}`,
        createdAt: `${date}T12:00:00.000Z`,
        summary: `${dayIncidents.length} incident records opened on ${date}.`,
        findings: dayIncidents.map((incident) => [
          `${incident.severity} | ${incident.title}`,
          `Status: ${incident.status}  Assigned to: ${incident.assignedAnalyst}`,
          `Created: ${formatDate(incident.createdAt)}`,
          `Related alert: ${incident.alertId}`,
          `Details: ${incident.description}`,
        ].join("\n")),
        recordCount: dayIncidents.length,
      });
    }

    if (dayEvents.length) {
      dailyRuns.push({
        ...reportById["SOC-EVENTS"],
        id: `SOC-EVENTS-${date}`,
        sourceReportId: "SOC-EVENTS",
        title: `Event telemetry · ${date}`,
        createdAt: `${date}T12:00:00.000Z`,
        summary: `${dayEvents.length} event records received on ${date}.`,
        findings: dayEvents.map((event) => [
          `${event.severity} | ${event.host} | ${event.event_type}`,
          `Time: ${formatDate(event.timestamp)}  Agent: ${event.agent_id}`,
          `User: ${event.username || "-"}  Source IP: ${event.source_ip || "-"}`,
          `Activity: ${event.message}`,
        ].join("\n")),
        iocs: [...new Set(dayEvents.map((event) => event.source_ip).filter(Boolean))],
        recordCount: dayEvents.length,
      });
    }
    return dailyRuns;
  });

  const searchTerms = archiveSearch.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const reportMatchesSearch = (report) => {
    if (!searchTerms.length) return true;
    const searchableText = [
      report.title,
      report.sourceReportId,
      report.type,
      report.createdAt,
      formatDate(report.createdAt),
      report.summary,
      report.description,
      ...(report.findings || []),
      ...(report.iocs || []),
    ].join(" ").toLocaleLowerCase();
    return searchTerms.every((term) => searchableText.includes(term));
  };
  const filteredDatedReports = datedReports.filter(reportMatchesSearch);
  const filteredHistory = reportHistory.filter((entry) => reportMatchesSearch({
    ...entry.report,
    title: entry.title,
    sourceReportId: entry.reportId,
    createdAt: entry.createdAt,
  }));

  useEffect(() => {
    localStorage.setItem(REPORT_HISTORY_KEY, JSON.stringify(reportHistory));
  }, [reportHistory]);

  useEffect(() => {
    if (!preview) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setPreview(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      if (preview.url) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const recordReportHistory = (report, format, action) => {
    setReportHistory((history) => [{
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      reportId: report.sourceReportId || report.id,
      title: report.title,
      format,
      action,
      createdAt: new Date().toISOString(),
      report,
    }, ...history].slice(0, REPORT_HISTORY_LIMIT));
  };

  const previewReport = async (report, format, recordHistory = true) => {
    setExporting(`${report.id}-${format}-PREVIEW`);
    setExportError("");
    try {
      const blob = format === "PDF" ? await createReportPdf(report) : createReportCsv(report);
      const url = format === "PDF" ? URL.createObjectURL(blob) : null;
      const content = format === "CSV" ? await blob.text() : "";
      setPreview({ report, format, blob, url, rows: format === "CSV" ? parseCsvRows(content) : [] });
      if (recordHistory) recordReportHistory(report, format, "Previewed");
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Could not create PDF preview.");
    } finally {
      setExporting("");
    }
  };

  const downloadPreview = () => {
    if (!preview) return;
    triggerBrowserDownload(preview.blob, `DEJEN-Report-${preview.report.id}.${preview.format.toLowerCase()}`);
    recordReportHistory(preview.report, preview.format, "Downloaded");
  };

  const browseReportHistory = (report) => {
    navigate(`/reports/archive?query=${encodeURIComponent(report.title)}`);
  };

  const downloadDatedReport = async (report, format) => {
    const exportId = `${report.id}-${format}-DOWNLOAD`;
    setExporting(exportId);
    setExportError("");
    try {
      const blob = format === "PDF" ? await createReportPdf(report) : createReportCsv(report);
      const suffix = new Date(report.createdAt).toISOString().replaceAll(/[: ]/g, "-");
      triggerBrowserDownload(blob, `DEJEN-${report.id}-${suffix}.${format.toLowerCase()}`);
      recordReportHistory(report, format, "Downloaded");
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Could not download the dated report.");
    } finally {
      setExporting("");
    }
  };

  const downloadHistoryEntry = async (entry) => {
    setExporting(`${entry.id}-DOWNLOAD`);
    setExportError("");
    try {
      const blob = entry.format === "PDF"
        ? await createReportPdf(entry.report)
        : createReportCsv(entry.report);
      const timestamp = new Date(entry.createdAt).toISOString().replaceAll(":", "-");
      triggerBrowserDownload(blob, `DEJEN-${entry.reportId}-${timestamp}.${entry.format.toLowerCase()}`);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Could not download the saved report.");
    } finally {
      setExporting("");
    }
  };

  return <GlassWorkspace>
    <div className="soc-report-view">
      <div className="soc-view-head">
        <div>
          <span className="soc-eyebrow">SECURITY CENTER / REPORTS</span>
          <h1>{isArchivePage ? "Report archive" : "Report exports"}</h1>
          <p>{isArchivePage ? "Browse and download daily reports by type and date." : "Download snapshots generated from current backend records."}</p>
        </div>
        <div className="soc-head-actions">
          <span className="soc-live-label"><i />{loading ? "Syncing records" : "Source data connected"}</span>
          {isArchivePage
            ? <button onClick={() => navigate("/reports")} className="soc-secondary-button"><ArrowLeft size={14} /> Reports overview</button>
            : <button onClick={() => navigate("/reports/archive")} className="soc-secondary-button"><ArrowRight size={14} /> Browse archive</button>}
        </div>
      </div>

      <div className="soc-report-note"><FileText size={15} /><span>Exports reflect the latest loaded data and are not stored as backend report records.</span></div>
      {exportError && <p role="alert" className="soc-form-error">{exportError}</p>}

      {!isArchivePage && <section className="soc-report-grid" aria-label="Available report exports">
        {reports.map((report) => <article className="soc-glass-panel soc-report-card" key={report.id}>
          <div className="soc-report-card-top">
            <span className="soc-report-icon"><FileText size={17} /></span>
            <span className="soc-report-count">{report.recordCount} {report.id === "SOC-SUMMARY" ? "metrics" : "records"}</span>
          </div>
          <span className="soc-eyebrow">{report.type.replaceAll("_", " ")}</span>
          <h2><button type="button" className="soc-report-title" onClick={() => browseReportHistory(report)} aria-label={`Browse ${report.title} reports by date`}>{report.title}</button></h2>
          <p>{report.description}</p>
          <div className="soc-report-meta"><span>Generated {formatDate(report.createdAt)}</span><span>{report.classification}</span></div>
          <div className="soc-report-actions">
            <button onClick={() => browseReportHistory(report)} className="soc-primary-button" title={`Browse dated ${report.title} reports and download PDF`}><FileText size={14} />PDF reports</button>
            <button onClick={() => browseReportHistory(report)} className="soc-secondary-button" title={`Browse dated ${report.title} reports and download CSV`}><FileSpreadsheet size={14} />CSV reports</button>
          </div>
        </article>)}
      </section>}
      {isArchivePage && <section className="soc-glass-panel soc-report-history p-4 sm:p-5" aria-labelledby="report-archive-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-3">
          <div><span className="soc-eyebrow">DATE ARCHIVE</span><h2 id="report-archive-heading" className="mt-1 text-sm font-bold text-[#283532]">Reports by date</h2><p className="mt-1 text-[11px] text-[#697974]">Daily reports derived from records currently loaded from the backend.</p></div>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="report-archive-search">Search reports by date, severity, status, name, or IP address</label>
            <div className="relative min-w-[220px] flex-1 sm:w-80 sm:flex-none">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#697974]" />
              <input id="report-archive-search" type="search" value={archiveSearch} onChange={(event) => setArchiveSearch(event.target.value)} placeholder="Date, severity, status, name, or IP address" className="min-h-8 w-full rounded-md border border-black/15 bg-white py-1 pl-8 pr-2.5 text-xs text-[#283532]" />
            </div>
            {archiveSearch && <button onClick={() => setArchiveSearch("")} className="soc-panel-link" title="Clear report search"><X size={13} />Clear</button>}
          </div>
        </div>
        {filteredDatedReports.length ? <div className="space-y-4">
          {reports.map((category) => {
            const categoryReports = filteredDatedReports.filter((report) => report.sourceReportId === category.id);
            if (!categoryReports.length) return null;
            return <div key={category.id}>
              <div className="mb-1 flex items-center justify-between gap-2"><h3 className="text-xs font-bold text-[#283532]">{category.title}</h3><span className="text-[10px] text-[#697974]">{categoryReports.length} {categoryReports.length === 1 ? "date" : "dates"}</span></div>
              <div className="divide-y divide-black/5 border-t border-black/5">
                {categoryReports.map((report) => <article key={report.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0"><strong className="block truncate text-xs text-[#283532]">{report.title.replace(`${category.title} · `, "")}</strong><span className="mt-1 block text-[10px] text-[#697974]">{report.recordCount} {report.sourceReportId === "SOC-SUMMARY" ? "activity records" : "records"} · {report.description}</span></div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => previewReport(report, "PDF")} disabled={Boolean(exporting)} className="soc-secondary-button" title={`Preview ${report.title} before downloading`}><Eye size={13} />Preview</button>
                    <button onClick={() => downloadDatedReport(report, "PDF")} disabled={Boolean(exporting)} className="soc-secondary-button" title={`Download ${report.title} as PDF`}><FileText size={13} />PDF</button>
                    <button onClick={() => downloadDatedReport(report, "CSV")} disabled={Boolean(exporting)} className="soc-primary-button" title={`Download ${report.title} as CSV`}><Download size={13} />CSV</button>
                  </div>
                </article>)}
              </div>
            </div>;
          })}
        </div> : <p className="py-5 text-center text-xs text-[#697974]">{archiveSearch ? "No reports match this search. Try a date, severity, status, name, or IP address." : "No dated reports are available in the loaded backend records."}</p>}
      </section>}

      {isArchivePage && <section className="soc-glass-panel soc-report-history p-4 sm:p-5" aria-labelledby="report-history-heading">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-black/10 pb-3">
          <div><span className="soc-eyebrow">LOCAL ACTIVITY</span><h2 id="report-history-heading" className="mt-1 text-sm font-bold text-[#283532]">Recent previews and downloads</h2><p className="mt-1 text-[11px] text-[#697974]">Activity saved in this browser, up to the latest {REPORT_HISTORY_LIMIT} actions.</p></div>
          {reportHistory.length > 0 && <button onClick={() => setReportHistory([])} className="soc-secondary-button" title="Clear report history">Clear history</button>}
        </div>
        {filteredHistory.length ? <div className="divide-y divide-black/5">
          {filteredHistory.map((entry) => <article key={entry.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0"><strong className="block truncate text-xs text-[#283532]">{entry.title}</strong><span className="mt-1 block text-[10px] text-[#697974]">{entry.format} · {entry.action} · {formatDate(entry.createdAt)}</span></div>
            <div className="flex items-center gap-2">
              <button onClick={() => previewReport(entry.report, entry.format, false)} disabled={Boolean(exporting)} className="soc-secondary-button" title={`Open ${entry.title} ${entry.format} snapshot`}><Eye size={13} />Open</button>
              <button onClick={() => downloadHistoryEntry(entry)} disabled={Boolean(exporting)} className="soc-primary-button" title={`Download ${entry.title} ${entry.format} snapshot`}><Download size={13} />{exporting === `${entry.id}-DOWNLOAD` ? "Preparing..." : "Download"}</button>
            </div>
          </article>)}
        </div> : <p className="py-5 text-center text-xs text-[#697974]">{reportHistory.length ? "No saved reports match these filters." : "No saved report runs yet. Preview a report to save a snapshot here."}</p>}
      </section>}
      <div className="soc-report-refresh"><Download size={13} /><span>Reports sync Events, Alerts, Incidents, and dashboard totals every 2 seconds. Exports and saved previews are snapshots.</span></div>
    </div>
    {preview && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6" onClick={() => setPreview(null)}>
      <section role="dialog" aria-modal="true" aria-labelledby="report-preview-title" className="flex h-[min(92vh,960px)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-black/15 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-black/10 px-4 py-3 sm:px-5">
          <div className="min-w-0"><span className="soc-eyebrow">{preview.format} PREVIEW</span><h2 id="report-preview-title" className="truncate text-sm font-bold text-[#283532]">{preview.report.title}</h2></div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={downloadPreview} className="soc-primary-button" title={`Download this ${preview.format}`}><Download size={14} />Download {preview.format}</button>
            <button onClick={() => setPreview(null)} className="soc-icon-button" aria-label={`Close ${preview.format} preview`} title="Close preview"><X size={16} /></button>
          </div>
        </header>
        {preview.format === "PDF" ? <PdfDocumentPreview file={preview.blob} title={preview.report.title} /> : <div aria-label={`${preview.report.title} CSV contents`} className="min-h-0 flex-1 overflow-auto bg-[#f7f9fa] p-4 sm:p-6">
          <table className="mx-auto w-full max-w-5xl border-separate border-spacing-0 overflow-hidden rounded-lg border border-[#dce2e5] bg-white text-left text-xs shadow-sm">
            <thead className="sticky top-0 z-10 bg-[#edf2f3] text-[10px] uppercase tracking-wider text-[#58666e]"><tr><th className="w-[30%] border-b border-[#dce2e5] px-4 py-3">Field</th><th className="border-b border-[#dce2e5] px-4 py-3">Value</th></tr></thead>
            <tbody className="divide-y divide-[#edf0f2]">
              {preview.rows.map((row, index) => row.length === 1 ? <tr key={`${row[0]}-${index}`}><th colSpan={2} className="border-b border-[#e6ebed] bg-[#f4f7f8] px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-[#35454d]">{row[0]}</th></tr> : <tr key={`${row[0]}-${index}`} className="align-top hover:bg-[#f8fafb]"><th scope="row" className="border-b border-[#edf0f2] px-4 py-2.5 font-semibold text-[#53616a]">{row[0]}</th><td className="whitespace-pre-wrap break-words border-b border-[#edf0f2] px-4 py-2.5 leading-5 text-[#26343b]">{row.slice(1).join(", ")}</td></tr>)}
            </tbody>
          </table>
        </div>}
      </section>
    </div>}
  </GlassWorkspace>;
};
