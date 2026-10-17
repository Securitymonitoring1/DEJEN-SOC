import { jsPDF } from 'jspdf';
import dejenShield from '../assets/images/DEJEN SOC Ethiopian Cyber Shield1.png';
import dejenWordmark from '../assets/images/DEJEN SOC Ethiopian Cyber Shield2.png';
import { SecurityReport } from '../types/soc';

type PdfSecurityReport = SecurityReport & {
  idLabel?: string;
  subtitle?: string;
  timestampLabel?: string;
  standard?: string;
  authorLine?: string;
  summaryHeading?: string;
  findingsHeading?: string;
  iocsHeading?: string;
  remediationHeading?: string;
};

/**
 * Triggers a browser download of any Blob data
 */
export function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 150);
}

/**
 * Downloads a Security Report as a formatted, professional PDF dossier
 */
export async function createReportPdf(report: PdfSecurityReport): Promise<Blob> {
  const [shieldResponse, wordmarkResponse] = await Promise.all([
    fetch(dejenShield),
    fetch(dejenWordmark),
  ]);
  if (!shieldResponse.ok || !wordmarkResponse.ok) {
    throw new Error('Could not load DEJEN report branding.');
  }
  const [shieldBytes, wordmarkBytes] = await Promise.all([
    shieldResponse.arrayBuffer().then((bytes) => new Uint8Array(bytes)),
    wordmarkResponse.arrayBuffer().then((bytes) => new Uint8Array(bytes)),
  ]);

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
    compress: true
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;
  const contentBottomMax = pageHeight - margin - 35;
  let y = margin;

  const classification = report.classification || 'INTERNAL_SOC';
  const iocs = report.iocs || [];
  const remediationSteps = report.remediationSteps || [];

  const addHeader = (isContinued: boolean = false) => {
    const bannerHeight = 40;
    doc.setFillColor(30, 42, 47);
    doc.roundedRect(margin, y, contentWidth, bannerHeight, 3, 3, 'F');
    const centerY = y + bannerHeight / 2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(255, 255, 255);
    doc.addImage(shieldBytes, 'PNG', margin + 4, y + 6, 26, 28);
    doc.addImage(wordmarkBytes, 'PNG', margin + 34, y + 11, 70, 18);
    doc.setFontSize(8);
    doc.text('ENTERPRISE SOC', margin + 108, centerY, { baseline: 'middle' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(126, 214, 203);
    const headerTitle = report.type === 'INCIDENT_REPORT'
      ? (isContinued ? 'INCIDENT REPORT / CONTINUED' : 'INCIDENT REPORT')
      : (isContinued ? 'SECURITY REPORT / CONTINUED' : 'SECURITY REPORT');
    doc.text(headerTitle, margin + contentWidth / 2, centerY, { align: 'center', baseline: 'middle' });

    const badgeText = classification === 'RESTRICTED' ? classification : `[ ${classification} ]`;
    doc.setTextColor(255, 255, 255);
    doc.setFont('courier', 'bold');
    doc.setFontSize(8.5);
    doc.text(badgeText, margin + contentWidth - 12, centerY, { align: 'right', baseline: 'middle' });

    y += bannerHeight + 12;
    if (report.subtitle) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(75, 80, 85);
      const subtitleLines = doc.splitTextToSize(report.subtitle, contentWidth);
      doc.text(subtitleLines, margin, y);
      y += subtitleLines.length * 13 + 10;
    }
  };

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > contentBottomMax) {
      doc.addPage('a4', 'portrait');
      y = margin;
      addHeader(true);
    }
  };

  addHeader(false);

  // Metadata Bar
  const metaHeight = 52;
  doc.setFillColor(246, 248, 250);
  doc.roundedRect(margin, y, contentWidth, metaHeight, 3, 3, 'F');
  doc.setDrawColor(220, 225, 230);
  doc.roundedRect(margin, y, contentWidth, metaHeight, 3, 3, 'S');

  const metaCols = [
    { label: report.idLabel || 'REPORT ID:', val: report.id, isCode: true },
    { label: 'CLASSIFICATION:', val: classification, isCode: false },
    { label: 'COMPILED BY:', val: report.author, isCode: false },
    ...(!report.timestampLabel ? [{ label: 'TIMESTAMP (UTC):', val: new Date(report.createdAt).toISOString().replace('T', ' ').slice(0, 16) + 'Z', isCode: true }] : [])
  ];

  const colW = contentWidth / metaCols.length;
  metaCols.forEach((col, idx) => {
    const colX = margin + colW * idx + 10;
    const innerW = colW - 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(95, 100, 108);
    doc.text(col.label, colX, y + 14);

    if (col.isCode) {
      doc.setFont('courier', 'bold');
      doc.setFontSize(8.5);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
    }
    doc.setTextColor(17, 19, 21);
    const valLines = doc.splitTextToSize(col.val, innerW);
    doc.text(valLines[0] || col.val, colX, y + 31);
  });

  y += metaHeight + 18;

  if (report.timestampLabel) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(95, 100, 108);
    doc.text('TIMESTAMP:', margin, y);
    doc.setFont('courier', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(55, 60, 65);
    doc.text(report.timestampLabel, margin + 58, y);
    y += 18;
  }

  if (report.standard) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(95, 100, 108);
    doc.text('STANDARD:', margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(55, 60, 65);
    doc.text(report.standard, margin + 55, y);
    y += 18;
  }

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.setTextColor(17, 19, 21);
  const titleLines = doc.splitTextToSize(report.title, contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 24 + 8;

  if (report.authorLine) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const authorLines = doc.splitTextToSize(report.authorLine, contentWidth);
    checkPageBreak(authorLines.length * 12 + 8);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(95, 100, 108);
    doc.text(authorLines, margin, y);
    y += authorLines.length * 12 + 10;
  }

  // Summary
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const summaryLines = doc.splitTextToSize(report.summary, contentWidth - 24);
  const summaryBoxH = summaryLines.length * 14.5 + 24;
  checkPageBreak(summaryBoxH + 36);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(41, 43, 46);
  doc.text(report.summaryHeading || '01. EXECUTIVE SUMMARY', margin, y);
  y += 16;

  doc.setFillColor(252, 253, 255);
  doc.roundedRect(margin, y, contentWidth, summaryBoxH, 3, 3, 'F');
  doc.setDrawColor(220, 228, 228);
  doc.roundedRect(margin, y, contentWidth, summaryBoxH, 3, 3, 'S');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(55, 60, 65);
  doc.text(summaryLines, margin + 12, y + 18);
  y += summaryBoxH + 20;

  // Findings
  if (report.findings && report.findings.length > 0) {
    const firstFindingLines = doc.splitTextToSize(report.findings[0], contentWidth - 34);
    checkPageBreak(34 + firstFindingLines.length * 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(41, 43, 46);
    doc.text(report.findingsHeading || '02. OPERATIONAL FINDINGS', margin, y);
    y += 17;

    report.findings.forEach(f => {
      const fLines = doc.splitTextToSize(f, contentWidth - 34);
      const fH = fLines.length * 14 + 8;
      checkPageBreak(fH + 2);

      doc.setFont('courier', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0, 140, 170);
      doc.text('•', margin + 4, y);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(55, 60, 65);
      doc.text(fLines, margin + 18, y);
      y += fH;
    });
    y += 14;
  }

  // IOCs
  if (iocs.length > 0) {
    if (report.type === 'INCIDENT_REPORT') {
      doc.addPage('a4', 'portrait');
      y = margin;
      addHeader(true);
    } else {
      checkPageBreak(40);
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(41, 43, 46);
    doc.text(report.iocsHeading || '03. INDICATORS OF COMPROMISE (IOCs)', margin, y);
    y += 17;

    iocs.forEach(ioc => {
      doc.setFont('courier', 'normal');
      doc.setFontSize(9);
      const iocLines = doc.splitTextToSize(ioc, contentWidth - 28);
      const iocH = iocLines.length * 13 + 10;
      checkPageBreak(iocH + 4);

      doc.setFont('courier', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(25, 30, 35);
      doc.text(iocLines, margin + 8, y);
      y += iocH;
    });
    y += 14;
  }

  if (remediationSteps.length > 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    const remediationHeight = remediationSteps.reduce((height, step) => {
      const lines = doc.splitTextToSize(step, contentWidth - 34);
      return height + lines.length * 14 + 8;
    }, 31);
    const signOffLines = report.signOff
      ? doc.splitTextToSize(report.signOff.signedBy, contentWidth - 24).length
        + doc.splitTextToSize(report.signOff.role, contentWidth - 24).length
        + (report.signOff.verifiedSignature ? doc.splitTextToSize(`Verification: ${report.signOff.verifiedSignature}`, contentWidth - 24).length : 0)
      : 0;
    const signOffHeight = report.signOff ? 30 + signOffLines * 13 + 8 : 0;
    checkPageBreak(remediationHeight + signOffHeight);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(41, 43, 46);
    doc.text(report.remediationHeading || '04. REMEDIATION & HARDENING ACTIONS', margin, y);
    y += 17;

    remediationSteps.forEach((step) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      const stepLines = doc.splitTextToSize(step, contentWidth - 34);
      const stepHeight = stepLines.length * 14 + 8;
      checkPageBreak(stepHeight + 2);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(55, 60, 65);
      doc.text('-', margin + 4, y);
      doc.text(stepLines, margin + 18, y);
      y += stepHeight;
    });
    y += 14;
  }

  if (report.signOff) {
    const signerLines = doc.splitTextToSize(report.signOff.signedBy, contentWidth - 24);
    const roleLines = doc.splitTextToSize(report.signOff.role, contentWidth - 24);
    const signatureLines = report.signOff.verifiedSignature
      ? doc.splitTextToSize(`Verification: ${report.signOff.verifiedSignature}`, contentWidth - 24)
      : [];
    const signOffHeight = 30 + (signerLines.length + roleLines.length + signatureLines.length) * 13;
    checkPageBreak(signOffHeight + 8);
    doc.setFillColor(246, 248, 250);
    doc.roundedRect(margin, y, contentWidth, signOffHeight, 4, 4, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(41, 43, 46);
    doc.text('REPORT SIGN-OFF', margin + 14, y + 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(55, 60, 65);
    let signOffY = y + 35;
    doc.text(signerLines, margin + 12, signOffY);
    signOffY += signerLines.length * 13;
    doc.text(roleLines, margin + 12, signOffY);
    signOffY += roleLines.length * 13;
    if (signatureLines.length) doc.text(signatureLines, margin + 12, signOffY);
    y += signOffHeight + 8;
  }

  // Footer
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setDrawColor(215, 220, 225);
    doc.setLineWidth(0.5);
    doc.line(margin, pageHeight - 30, margin + contentWidth, pageHeight - 30);

    const footerY = pageHeight - 18;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(130, 135, 140);
    doc.text(`DEJEN SOC Platform  |  Doc ID: ${report.id}`, margin, footerY, { baseline: 'middle' });
    doc.text(`Page ${i} of ${totalPages}`, margin + contentWidth, footerY, { align: 'right', baseline: 'middle' });
  }

  return doc.output('blob');
}

export async function downloadReportPdf(report: PdfSecurityReport) {
  const blob = await createReportPdf(report);
  triggerBrowserDownload(blob, `DEJEN-Report-${report.id}.pdf`);
}

/**
 * Downloads a Security Report as CSV
 */
export function createReportCsv(report: SecurityReport): Blob {
  const classification = report.classification || 'INTERNAL_SOC';
  const iocs = report.iocs || [];
  const remediationSteps = report.remediationSteps || [];
  const csvField = (value: string | number | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;

  const rows = [
    ['Report ID', report.id],
    ['Publisher', 'DEJEN SOC'],
    ['Title', report.title],
    ['Type', report.type],
    ['Classification', classification],
    ['Created At', report.createdAt],
    ['Author', report.author],
    ['Status', report.status],
    ['Summary', report.summary],
    [''],
    ['Findings'],
    ...report.findings.map((f, i) => [`Finding ${i + 1}`, f]),
    [''],
    ['Indicators of Compromise (IOCs)'],
    ...iocs.map(ioc => ['IOC', ioc]),
    [''],
    ['Remediation Steps'],
    ...remediationSteps.map((step: string) => ['Action', step]),
    ...(report.signOff ? [
      [''],
      ['Signed By', report.signOff.signedBy],
      ['Signer Role', report.signOff.role],
      ...(report.signOff.verifiedSignature ? [['Signature Verification', report.signOff.verifiedSignature]] : []),
    ] : [])
  ];

  const csvContent = rows.map((row) => row.length === 1 && row[0] === '' ? '' : row.map(csvField).join(',')).join('\r\n');
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
}

