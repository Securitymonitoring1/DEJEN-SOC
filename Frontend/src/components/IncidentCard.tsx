interface IncidentRecord {
  id: string;
  title: string;
  severity: string;
  status: string;
  assignedAnalyst: string;
}

interface IncidentCardProps {
  incident: IncidentRecord;
  onOpen: (incident: IncidentRecord) => void;
}

export const IncidentCard = ({ incident, onOpen }: IncidentCardProps) => (
  <button className="soc-incident-tile" onClick={() => onOpen(incident)}>
    <span className="soc-incident-code">{incident.id.slice(0, 8)}</span>
    <strong>{incident.title}</strong>
    <span>{incident.severity} <i>·</i> {incident.status}</span>
    <small>Assigned to {incident.assignedAnalyst}</small>
  </button>
);