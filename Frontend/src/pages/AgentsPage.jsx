import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Download, Monitor, Plus, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { GlassWorkspace } from "../components/layout/GlassWorkspace";
import { agentsApi } from "../services/api";
import { useSoc } from "../context/SocContext";

const stamp = (value) => value ? new Date(value).toLocaleString() : "Never";
const osLabel = (value) => value === "macos" ? "macOS" : value;

function managerUrl() {
  const configured = import.meta.env.VITE_AGENT_MANAGER_URL;
  return (configured || `${window.location.protocol}//${window.location.hostname}:8000`).replace(/\/$/, "");
}

function makeInstallCommand(os, token, name) {
  const server = managerUrl();
  const psQuote = (value) => value.replaceAll("'", "''");
  const shQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`;
  if (os === "windows") {
    return `$ErrorActionPreference='Stop'; $url='${psQuote(server)}/agents/installers/windows'; $zip="$env:TEMP\\dejen-agent.zip"; Invoke-WebRequest $url -OutFile $zip; Expand-Archive -Force $zip "$env:ProgramData\\Dejen"; Set-Location "$env:ProgramData\\Dejen"; py -m dejen_agent.gui --enroll --server '${psQuote(server)}' --token '${psQuote(token)}' --name '${psQuote(name)}'; if ($LASTEXITCODE -ne 0) { throw 'Agent enrollment failed.' }; Set-ExecutionPolicy -Scope Process Bypass -Force; .\\packaging\\register_dejen_agent.ps1`;
  }
  if (os === "macos") {
    return `curl -fsSL ${shQuote(`${server}/agents/installers/macos`)} -o "$HOME/Downloads/dejen-agent-macos.zip" && mkdir -p "$HOME/Applications/DejenAgent" && unzip -oq "$HOME/Downloads/dejen-agent-macos.zip" -d "$HOME/Applications/DejenAgent" && cd "$HOME/Applications/DejenAgent" && python3 -m dejen_agent.gui --enroll --server ${shQuote(server)} --token ${shQuote(token)} --name ${shQuote(name)}`;
  }
  return `curl -fsSL ${shQuote(`${server}/agents/installers/linux`)} -o /tmp/dejen-agent.zip && sudo mkdir -p /opt/dejen-agent && sudo unzip -oq /tmp/dejen-agent.zip -d /opt/dejen-agent && cd /opt/dejen-agent && python3 -m dejen_agent.gui --enroll --server ${shQuote(server)} --token ${shQuote(token)} --name ${shQuote(name)}`;
}

export const AgentsPage = () => {
  const { currentUser } = useSoc();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [name, setName] = useState("");
  const [os, setOs] = useState("windows");
  const [expiry, setExpiry] = useState(15);
  const [enrollment, setEnrollment] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const isAdmin = currentUser?.role === "ADMIN";

  const refresh = useCallback(async () => {
    try {
      setAgents(await agentsApi.getAll());
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load agents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 2000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const issueToken = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      setEnrollment(await agentsApi.createEnrollmentToken({ name: name.trim(), os, expires_in_minutes: Number(expiry) }));
      await refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not create enrollment token.");
    } finally {
      setBusy(false);
    }
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setEnrollment(null);
    setName("");
    setError("");
  };

  const removeAgent = async (agent) => {
    if (!window.confirm(`Remove ${agent.name}? Its API key will stop working immediately.`)) return;
    try {
      await agentsApi.remove(agent.id);
      setAgents((current) => current.filter((item) => item.id !== agent.id));
      setNotice(`${agent.name} removed.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not remove agent.");
    }
  };

  const copy = async (text) => {
    await navigator.clipboard.writeText(text);
    setNotice("Copied to clipboard.");
  };

  const command = enrollment ? makeInstallCommand(enrollment.os, enrollment.token, enrollment.agent_name) : "";

  return <GlassWorkspace>
    <div className="soc-dashboard">
      <div className="soc-view-head flex-wrap">
        <div><span className="soc-eyebrow">FLEET MANAGEMENT</span><h1>Agents</h1><p>Enroll endpoints and monitor their connection health.</p></div>
        <div className="soc-head-actions">
          <button className="soc-panel-link" onClick={refresh} title="Refresh agent list"><RefreshCw size={14} /> Refresh</button>
          {isAdmin && <button className="inline-flex whitespace-nowrap items-center gap-2 rounded bg-[#10211f] px-2.5 py-2 text-xs font-semibold text-white hover:bg-[#1a3934] sm:px-3 sm:text-sm" onClick={() => setWizardOpen(true)}><Plus size={15} /> Connect agent</button>}
        </div>
      </div>

      {(error || notice) && <p role={error ? "alert" : "status"} className={`mb-4 rounded border px-3 py-2 text-sm ${error ? "border-red-300 bg-red-50 text-red-800" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>{error || notice}</p>}

      <section className="soc-glass-panel overflow-hidden">
        <div className="soc-panel-heading"><div><span className="soc-eyebrow">ENDPOINT INVENTORY</span><h2>Managed agents <span className="ml-2 text-sm font-normal text-neutral-500">{agents.length}</span></h2></div><ShieldCheck size={19} className="text-emerald-700" /></div>
        <div className="overflow-x-auto">
          {!agents.length ? loading ? <p className="px-4 py-12 text-center text-neutral-500">Loading agents…</p> : <div className="px-5 py-9 sm:px-8 sm:py-10">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-800"><Monitor size={20} /></div>
              <h3 className="text-lg font-semibold text-neutral-900">Connect your first endpoint</h3>
              <p className="mt-1 text-sm text-neutral-600">Create a one-time enrollment token, run the installer on the endpoint, and it will appear here when connected.</p>
              {isAdmin && <button className="mt-5 inline-flex items-center gap-2 rounded bg-[#10211f] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#1a3934]" onClick={() => setWizardOpen(true)}><Plus size={16} /> Connect an agent</button>}
              <ol className="mt-8 grid gap-4 border-t border-black/10 pt-5 text-left sm:grid-cols-3">
                <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700">1</span><span><strong className="block text-sm text-neutral-800">Choose endpoint</strong><span className="text-xs text-neutral-500">Name it and select its operating system.</span></span></li>
                <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700">2</span><span><strong className="block text-sm text-neutral-800">Run installer</strong><span className="text-xs text-neutral-500">Copy the generated command to that device.</span></span></li>
                <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-700">3</span><span><strong className="block text-sm text-neutral-800">Confirm connection</strong><span className="text-xs text-neutral-500">The endpoint shows here after its first check-in.</span></span></li>
              </ol>
            </div>
          </div> :
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-y border-black/10 bg-black/[.025] text-[11px] uppercase tracking-wide text-neutral-500"><tr><th className="px-4 py-3">Agent</th><th className="px-4 py-3">OS</th><th className="px-4 py-3">IP / Host</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last seen</th><th className="px-4 py-3">Version</th><th className="px-4 py-3"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody className="divide-y divide-black/5">
              {agents.map((agent) => <tr key={agent.id}>
                <td className="px-4 py-3 font-semibold text-neutral-900">{agent.name}</td>
                <td className="px-4 py-3"><span className="inline-flex items-center gap-2"><Monitor size={14} />{osLabel(agent.os_type)}</span></td>
                <td className="px-4 py-3 text-neutral-600">{agent.ip_address || "-"}<small className="block text-neutral-400">{agent.host || "-"}</small></td>
                <td className="px-4 py-3"><span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${agent.status === "Active" ? "text-emerald-700" : agent.status === "Disconnected" ? "text-rose-700" : "text-neutral-500"}`}><i className={`h-2 w-2 rounded-full ${agent.status === "Active" ? "bg-emerald-500" : agent.status === "Disconnected" ? "bg-rose-500" : "bg-neutral-400"}`} />{agent.status}</span></td>
                <td className="px-4 py-3 text-neutral-600">{stamp(agent.last_seen)}</td>
                <td className="px-4 py-3 font-mono-tech text-xs text-neutral-600">{agent.version || "-"}</td>
                <td className="px-4 py-3 text-right">{isAdmin && <button aria-label={`Remove ${agent.name}`} title="Remove agent and revoke its key" onClick={() => removeAgent(agent)} className="rounded p-2 text-neutral-500 hover:bg-red-50 hover:text-red-700"><Trash2 size={15} /></button>}</td>
              </tr>)}
            </tbody>
          </table>}
        </div>
      </section>
    </div>

    {wizardOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && closeWizard()}>
      <section role="dialog" aria-modal="true" aria-labelledby="agent-wizard-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-md border border-black/10 bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4"><div><span className="soc-eyebrow">AGENT ENROLLMENT</span><h2 id="agent-wizard-title" className="mt-1 text-xl font-bold text-neutral-900">Connect an agent</h2></div><button onClick={closeWizard} className="rounded p-2 text-neutral-600 hover:bg-neutral-100" aria-label="Close wizard">×</button></div>
        {!enrollment ? <form onSubmit={issueToken} className="space-y-4">
          <label className="block text-sm font-medium text-neutral-800">Agent name<input autoFocus required maxLength="100" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. win11-lab" className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2" /></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium text-neutral-800">Operating system<select value={os} onChange={(event) => setOs(event.target.value)} className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2"><option value="windows">Windows</option><option value="linux">Linux</option><option value="macos">macOS</option></select></label>
            <label className="block text-sm font-medium text-neutral-800">Token expires<select value={expiry} onChange={(event) => setExpiry(event.target.value)} className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2"><option value="15">15 minutes</option><option value="60">1 hour</option><option value="240">4 hours</option><option value="1440">24 hours</option></select></label></div>
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={closeWizard} className="rounded border border-neutral-300 px-3 py-2 text-sm">Cancel</button><button disabled={busy || !name.trim()} className="inline-flex items-center gap-2 rounded bg-[#10211f] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Plus size={15} />{busy ? "Generating…" : "Generate enrollment token"}</button></div>
        </form> : <div className="space-y-4">
          <p className="text-sm text-neutral-600">On <strong>{enrollment.agent_name}</strong>, run the command below to install and connect the {osLabel(enrollment.os)} agent. The one-time token expires {stamp(enrollment.expires_at)}.</p>
          <ol className="grid gap-2 rounded border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-neutral-700 sm:grid-cols-3"><li><strong>1.</strong> Copy the command</li><li><strong>2.</strong> Run it on the endpoint</li><li><strong>3.</strong> Wait for its first check-in</li></ol>
          <div className="flex gap-2"><code className="min-w-0 flex-1 break-all rounded bg-neutral-100 p-3 text-xs">{enrollment.token}</code><button title="Copy token" aria-label="Copy token" onClick={() => copy(enrollment.token)} className="rounded border border-neutral-300 p-3 hover:bg-neutral-50"><Copy size={16} /></button></div>
          <div><div className="mb-2 flex items-center justify-between"><label htmlFor="agent-command" className="text-sm font-semibold">Install and connect command</label><button title="Copy install command" aria-label="Copy install command" onClick={() => copy(command)} className="inline-flex items-center gap-2 rounded border border-neutral-300 px-3 py-2 text-sm font-semibold hover:bg-neutral-50"><Copy size={15} /> Copy command</button></div><textarea id="agent-command" readOnly rows="4" value={command} className="w-full resize-y rounded border border-neutral-300 bg-neutral-50 p-3 font-mono-tech text-xs" /></div>
          <a href={agentsApi.installerUrl(enrollment.os)} download={`dejen-agent-${enrollment.os}.zip`} className="inline-flex items-center gap-2 rounded border border-neutral-300 px-3 py-2 text-sm font-semibold text-neutral-800 hover:bg-neutral-50"><Download size={15} />Download {enrollment.os} agent bundle</a>
          <p className="text-xs text-amber-800">Treat the enrollment token as a secret. The resulting API key is saved locally by the agent and is never shown in the dashboard.</p>
          <div className="flex justify-end"><button onClick={closeWizard} className="inline-flex items-center gap-2 rounded bg-[#10211f] px-4 py-2 text-sm font-semibold text-white"><Check size={15} /> Done</button></div>
        </div>}
      </section>
    </div>}
  </GlassWorkspace>;
};