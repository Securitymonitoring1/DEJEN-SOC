import { Bell, Clock3, RefreshCw, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { useSoc } from "../../context/SocContext";
import backdrop from "../../assets/images/glass_soc_bg_1790324320648.jpg";
import { Header } from "../Header";
import { Sidebar } from "../Sidebar";

export const GlassWorkspace = ({ children }) => {
  const {
    currentRoute,
    currentUser,
    navigate,
    logout,
    refreshData,
    loading,
    error,
    alerts,
    theme,
    toggleTheme,
    detectionEnabled,
    setDetectionEnabled,
    detectionIntervalSeconds,
    setDetectionIntervalSeconds,
    resetLayout,
  } = useSoc();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const openAlerts = alerts.filter((item) => item.status === "OPEN").length;

  useEffect(() => {
    if (!isSettingsOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setIsSettingsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSettingsOpen]);

  return (
    <div className="soc-scene" style={{ "--soc-backdrop": `url(${backdrop})` }}>
      <Sidebar currentRoute={currentRoute} alertCount={openAlerts} theme={theme} onNavigate={navigate} onToggleTheme={toggleTheme} onOpenSettings={() => setIsSettingsOpen(true)} />
      <div className="soc-console">
        <Header error={error} loading={loading} username={currentUser?.username} onNavigate={navigate} onRefresh={refreshData} onLogout={logout} />

        {isSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 p-4 pt-10 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}>
            <section role="dialog" aria-modal="true" aria-labelledby="platform-settings-title" className="glass-modal w-full max-w-md max-h-[min(85vh,680px)] overflow-y-auto rounded-xl border border-black/10 p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between pb-3 border-b border-black/10 mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#111315] flex items-center justify-center text-white"><Settings size={15} className="text-[#00E5FF]" /></div>
                  <div>
                    <h3 id="platform-settings-title" className="text-xs font-bold text-[#111315]">Platform Settings</h3>
                    <p className="text-[10px] text-neutral-500">Workspace preferences</p>
                  </div>
                </div>
                <button onClick={() => setIsSettingsOpen(false)} className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center" aria-label="Close settings">×</button>
              </div>

              <div className="mb-4 pb-4 border-b border-black/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-neutral-800 flex items-center gap-1.5">
                    <Clock3 className="w-3.5 h-3.5 text-teal-600" />
                    Event Detection Interval
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={detectionEnabled}
                    aria-label="Toggle event detection interval"
                    onClick={setDetectionEnabled}
                    className={`relative h-5 w-9 cursor-pointer rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 ${detectionEnabled ? "bg-teal-600" : "bg-neutral-300"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${detectionEnabled ? "translate-x-[18px]" : "translate-x-0"}`} />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] text-neutral-500 font-mono-tech w-8">Every</span>
                  <input
                    aria-label="Event detection interval in seconds"
                    type="range"
                    min="1"
                    max="30"
                    step="1"
                    value={detectionIntervalSeconds}
                    disabled={!detectionEnabled}
                    onChange={(event) => setDetectionIntervalSeconds(Number(event.target.value))}
                    className="w-full h-1 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[#111315] disabled:cursor-not-allowed disabled:opacity-40"
                  />
                  <span className="text-[10px] text-neutral-500 font-mono-tech w-8 text-right">{detectionIntervalSeconds}s</span>
                </div>
                <p className="mt-2 text-[9px] text-neutral-500">
                  {detectionEnabled ? `Refreshes event detection telemetry every ${detectionIntervalSeconds} second${detectionIntervalSeconds === 1 ? "" : "s"}.` : "Automatic event detection refresh is off."}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button onClick={() => { resetLayout(); setIsSettingsOpen(false); }} className="text-[11px] text-neutral-600 hover:text-black flex items-center gap-1.5 transition-colors cursor-pointer">
                  <RefreshCw className="w-3 h-3" />Reset layout
                </button>
                <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 rounded-xl bg-[#111315] text-white text-xs font-semibold hover:bg-black cursor-pointer">
                  Done
                </button>
              </div>
            </section>
          </div>
        )}

        <main className="soc-main">
          {error && <div role="alert" className="soc-error"><span>{error}</span><button onClick={refreshData}>Retry</button></div>}
          {children}
        </main>

      </div>
      <div className="soc-scene-caption"><Bell size={12} /> {openAlerts} open alerts <span>·</span> {currentUser?.role || "ANALYST"}</div>
    </div>
  );
};
