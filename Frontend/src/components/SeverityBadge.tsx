interface SeverityBadgeProps {
  severity: string;
}

export const SeverityBadge = ({ severity }: SeverityBadgeProps) => (
  <span className={`inline-flex items-center rounded px-2 py-1 text-[11px] font-semibold sev-${severity.toLowerCase()}`}>
    {severity}
  </span>
);