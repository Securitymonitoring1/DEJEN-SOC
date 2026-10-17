import { Activity, Crosshair, FileText, Flame, LayoutDashboard, Moon, Settings, ShieldAlert, Sun, Waypoints } from "lucide-react";

const links = [
  { label: "Overview", path: "/dashboard", icon: LayoutDashboard },
  { label: "Alerts", path: "/alerts", icon: ShieldAlert },
  { label: "Events", path: "/event-viewer", icon: Activity },
  { label: "Threat Hunting", path: "/hunting", icon: Crosshair },
  { label: "Incidents", path: "/incidents", icon: Flame },
  { label: "Agents", path: "/agent-management", icon: Waypoints },
  { label: "Reports", path: "/reports", icon: FileText },
];

interface SidebarProps {
  currentRoute: string;
  alertCount: number;
  theme: "light" | "dark";
  onNavigate: (path: string) => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
}

export const Sidebar = ({ currentRoute, alertCount, theme, onNavigate, onToggleTheme, onOpenSettings }: SidebarProps) => (
  <aside className="soc-rail" aria-label="Primary navigation">
    {links.map(({ label, path, icon: Icon }) => {
      const active = currentRoute === path || currentRoute.startsWith(`${path}/`);
      const badge = path === "/alerts" ? alertCount : 0;
      return <button key={path} onClick={() => onNavigate(path)} className={`soc-rail-button ${active ? "is-active" : ""}`} title={label} aria-label={label}>
        <Icon size={17} />
        {badge > 0 && <span className="soc-rail-badge">{badge > 9 ? "9+" : badge}</span>}
      </button>;
    })}
    <span className="soc-rail-rule" />
    <button onClick={onToggleTheme} className="soc-rail-button" title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-label="Toggle theme">
      {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
    </button>
    <button onClick={onOpenSettings} className="soc-rail-button" title="Settings" aria-label="Open settings">
      <Settings size={17} />
    </button>
  </aside>
);