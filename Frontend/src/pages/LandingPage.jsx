import React, { useState, useEffect } from "react";
import { useSoc } from "../context/SocContext";
import { DejenLogo } from "../components/common/DejenLogo";
import dejenWordmark from "../assets/images/DEJEN SOC Ethiopian Cyber Shield2.png";
import pastedPreview from "../assets/images/Pasted_Image.png";
import {
  ShieldAlert,
  Activity,
  CheckCircle2,
  Clock,
  ArrowRight,
  Terminal,
  Globe,
  Server,
  Flame,
  GitFork,
  Crosshair,
  Play,
  X,
} from "lucide-react";
export const LandingPage = () => {
  const { navigate, summary, events } = useSoc();
  const eventSourceRows = events.slice(0, 3).map((event) => ({
    source: event.source_ip || event.host || "Unknown source",
    detail: `${event.severity} · ${event.event_type}`,
  }));
  const dashboardMetrics = {
    events: summary?.total_events ?? "-",
    detections: summary?.total_alerts ?? "-",
    openAlerts: summary?.open_alerts ?? "-",
    openIncidents: summary?.open_incidents ?? "-",
  };
  const observedAgents = new Set(events.map((event) => event.agent_id).filter(Boolean)).size;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("hero");
  const [scrolled, setScrolled] = useState(false);
  const [queryRunning, setQueryRunning] = useState(false);
  const [querySuccess, setQuerySuccess] = useState(false);
  const [selectedMitre, setSelectedMitre] = useState(null);
  const [selectedNode, setSelectedNode] = useState({
    name: "example-process",
    type: "Process",
    status: "Example",
    details: "Illustrative process entity; not a backend record."
  });
  useEffect(() => {
    document.title = "DEJEN | Operations Overview";
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
      const sections = ["platform", "security", "compliance", "threat-hunting", "reports"];
      const scrollPosition = window.scrollY + 200;
      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section);
            break;
          }
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
        setSelectedMitre(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const handleRunQuery = () => {
    setQueryRunning(true);
    setQuerySuccess(false);
    setTimeout(() => {
      setQueryRunning(false);
      setQuerySuccess(true);
    }, 800);
  };
  const scrollTo = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };
  return <div className="landing-overview relative min-h-screen w-full bg-[#EEF1F3] text-[#111315] font-['Inter'] selection:bg-[#8CC4CC]/40 selection:text-[#111315] overflow-x-hidden">
      {
    /* 3. BACKGROUND VIDEO LAYER */
  }
      <div className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <video
    className="bg-video absolute inset-0 w-full h-full object-cover pointer-events-none scale-105 opacity-60"
    autoPlay
    muted
    loop
    playsInline
  >
          <source
    src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
    type="video/mp4"
  />
        </video>
        {
    /* Soft translucent atmospheric overlay ensuring legibility & light glass depth */
  }
        <div className="absolute inset-0 bg-gradient-to-b from-[#EEF1F3]/75 via-[#EEF1F3]/85 to-[#EEF1F3] pointer-events-none" />
      </div>

      {
    /* 5. FLOATING GLASS HEADER */
  }
      <header
    className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-5xl transition-all duration-300 ${scrolled ? "py-1.5" : "py-2"}`}
  >
        <div
    className={`w-full px-4 sm:px-6 py-2.5 rounded-full flex items-center justify-between transition-all duration-300 ${scrolled ? "bg-white/85 shadow-lg border border-white/80 backdrop-blur-md" : "glass-header-nav"}`}
  >
          {
    /* 6. DEJEN LOGO & BRAND */
  }
          <div
    onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
    className="flex items-center gap-3 cursor-pointer group select-none"
  >
            <DejenLogo size="sm" variant="circular-white" />
            <div className="flex flex-col">
              <img src={dejenWordmark} alt="DEJEN" className="h-6 w-28 object-cover object-[50%_62%]" />
              <span className="text-[9px] tracking-wider text-[#555A60] font-mono-tech uppercase">
                Operations Overview
              </span>
            </div>
          </div>

          {
    /* Desktop Navigation Links */
  }
          <nav className="landing-reference-nav hidden md:flex items-center gap-1 text-xs font-medium" aria-label="Overview sections">
            {[
              { id: "platform", label: "Platform" },
              { id: "security", label: "Security" },
              { id: "threat-hunting", label: "Threat Hunting" },
              { id: "compliance", label: "Compliance" },
              { id: "reports", label: "Reports" }
            ].map((item) => <button
              key={item.id}
              onClick={() => scrollTo(item.id)}
              className={`landing-section-link ${activeSection === item.id ? "is-active" : ""}`}
            >
              {item.label}
            </button>)}
          </nav>

          {
    /* Right Controls: Launch */
  }
          <div className="hidden md:flex items-center gap-2">
            <button
    onClick={() => navigate("/login")}
    className="px-4 py-1.5 text-xs font-semibold rounded-full bg-[#292B2E] text-white hover:bg-black transition-all duration-200 shadow-xs hover:-translate-y-0.5 cursor-pointer flex items-center gap-1.5"
  >
              <span>Launch DEJEN</span>
              <ArrowRight className="w-3 h-3 text-[#00E5FF]" />
            </button>
          </div>

          {
    /* 7. MOBILE HEADER TOGGLE */
  }
          <div className="md:hidden">
            <button
    onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
    className="w-10 h-10 rounded-full bg-white/80 border border-white flex items-center justify-center text-[#111315] shadow-xs cursor-pointer"
    aria-label="Toggle Navigation"
  >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <span className="text-base font-bold">☰</span>}
            </button>
          </div>
        </div>
      </header>

      {
    /* 7. MOBILE FULLSCREEN OVERLAY MENU */
  }
      {mobileMenuOpen && <div
    className="fixed inset-0 z-50 bg-black/40 backdrop-blur-md flex flex-col justify-end p-4 md:hidden animate-in fade-in duration-200"
    onClick={() => setMobileMenuOpen(false)}
  >
          <div
    className="w-full bg-white/95 backdrop-blur-xl text-[#111315] rounded-[32px] p-6 space-y-4 shadow-2xl border border-white"
    onClick={(e) => e.stopPropagation()}
  >
            <div className="flex items-center justify-between pb-3 border-b border-black/10">
              <div className="flex items-center gap-2.5">
                <DejenLogo size="sm" variant="circular-white" />
                <span className="font-bold text-sm tracking-tight">DEJEN Security Operations</span>
              </div>
              <button
    onClick={() => setMobileMenuOpen(false)}
    className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-sm font-semibold"
  >
                ✕
              </button>
            </div>

            <div className="space-y-1 font-medium text-sm py-2">
              {[
    { id: "platform", label: "Platform" },
    { id: "security", label: "Security" },
    { id: "threat-hunting", label: "Threat Hunting" },
    { id: "compliance", label: "Compliance" },
    { id: "reports", label: "Reports" }
  ].map((link) => <button
    key={link.id}
    onClick={() => scrollTo(link.id)}
    className="block w-full text-left py-2.5 px-3 rounded-xl hover:bg-black/5 text-[#555A60] hover:text-[#111315] transition-colors"
  >
                  {link.label}
                </button>)}
            </div>

            <div className="pt-3 border-t border-black/10 flex flex-col gap-2">
              <button
    onClick={() => {
      setMobileMenuOpen(false);
      navigate("/login");
    }}
    className="w-full py-3 rounded-full bg-[#292B2E] text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm"
  >
                <span>Launch DEJEN</span>
                <ArrowRight className="w-3.5 h-3.5 text-[#00E5FF]" />
              </button>
              <button
    onClick={() => {
      setMobileMenuOpen(false);
      navigate("/login");
    }}
    className="w-full py-2.5 rounded-full bg-neutral-100 text-[#555A60] text-xs font-medium"
  >
                Sign In to Console
              </button>
            </div>
          </div>
        </div>}

      {
    /* 8. HERO / PUBLIC SECURITY OVERVIEW */
  }
      <section className="relative z-10 pt-28 sm:pt-36 pb-16 px-4 sm:px-6 max-w-6xl mx-auto flex flex-col items-center text-center">
        {
    /* 12. TRUST / SECURITY STATUS ROW */
  }
        <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/70 border border-white/90 shadow-xs mb-6 backdrop-blur-md animate-reveal">
          <span className="w-2 h-2 rounded-full bg-[#00E5FF] animate-pulse shadow-[0_0_8px_#00E5FF]" />
          <span className="text-xs font-mono-tech font-medium text-[#111315] uppercase tracking-wider">
            SECURITY CENTER / OVERVIEW
          </span>
          <span className="hidden sm:inline-block text-[#858A90] font-mono-tech text-xs">·</span>
          <span className="hidden sm:inline-block text-xs font-mono-tech text-[#555A60]">
            Detection, investigation, response, and exports in one security operations workspace.
          </span>
        </div>

        {
    /* 9. HERO HEADLINE */
  }
        <h1 className="font-semibold text-[clamp(32px,5.5vw,68px)] leading-[1.05] tracking-[-0.035em] text-[#111315] max-w-4xl mb-5 text-balance animate-headline-fade">
          Operations overview
        </h1>

        {
    /* 10. HERO DESCRIPTION */
  }
        <p className="max-w-[560px] text-sm sm:text-base text-[#555A60] leading-relaxed mb-8 text-balance animate-reveal">
          Review backend events, investigate detections, manage incidents, and export operational snapshots.
        </p>

        {
    /* 11. HERO CTA BUTTONS */
  }
        <div className="flex flex-wrap items-center justify-center gap-3 mb-14 animate-reveal">
          <button
    onClick={() => navigate("/login")}
    className="px-7 py-3 rounded-full bg-[#292B2E] hover:bg-black text-white text-xs sm:text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 shadow-md flex items-center gap-2 cursor-pointer"
  >
            <span>Launch DEJEN</span>
            <ArrowRight className="w-4 h-4 text-[#00E5FF]" />
          </button>
          <button
    onClick={() => scrollTo("platform")}
    className="px-6 py-3 rounded-full bg-white/60 hover:bg-white/90 border border-white/80 text-[#111315] text-xs sm:text-sm font-medium transition-all duration-200 hover:-translate-y-0.5 backdrop-blur-md shadow-xs cursor-pointer"
  >
            Explore Security Operations
          </button>
        </div>

        <div className="landing-browser-preview" aria-label="DEJEN operations workspace preview">
          <div className="landing-browser-chrome">
            <div className="landing-window-dots"><i /><i /><i /></div>
            <span className="landing-browser-address">dejen.ai / operations</span>
            <span className="landing-browser-user">ADMIN</span>
          </div>
          <div className="landing-browser-body landing-pasted-preview">
            <img src={pastedPreview} alt="DEJEN operations workspace preview" />
          </div>
        </div>

        {
    /* 13. HERO OPERATIONS SUMMARY */
  }
        <div className="w-full max-w-4xl text-left">
          {
    /* Left Column: Live Security Operations Metrics Card */
  }
          <div className="glass-panel-primary p-6 sm:p-7 flex flex-col justify-between shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between pb-4 border-b border-black/5 mb-5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] animate-pulse" />
                <h3 className="text-xs font-bold text-[#111315] tracking-tight uppercase font-mono-tech">
                  Operations Summary
                </h3>
              </div>
              <span className="text-[10px] text-[#555A60] font-mono-tech bg-white/70 px-2 py-0.5 rounded-full border border-black/5">
                DASHBOARD TOTALS
              </span>
            </div>

            {
    /* Metrics 4-Grid */
  }
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="p-3.5 rounded-2xl bg-white/50 border border-white/80">
                <div className="text-2xl sm:text-3xl font-bold font-mono-tech text-[#111315] tracking-tight">
                  {dashboardMetrics.events}
                </div>
                <div className="text-xs text-[#555A60] font-medium mt-0.5">Events received</div>
                <div className="text-[10px] text-[#529E85] font-mono-tech mt-1 flex items-center gap-1">
                  Backend total
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/50 border border-white/80">
                <div className="text-2xl sm:text-3xl font-bold font-mono-tech text-[#111315] tracking-tight">
                  {dashboardMetrics.detections}
                </div>
                <div className="text-xs text-[#555A60] font-medium mt-0.5">Detections</div>
                <div className="text-[10px] text-[#555A60] font-mono-tech mt-1">Backend total</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/50 border border-white/80">
                <div className="text-2xl sm:text-3xl font-bold font-mono-tech text-[#C95A63] tracking-tight">
                  {dashboardMetrics.openAlerts}
                </div>
                <div className="text-xs text-[#555A60] font-medium mt-0.5">Open alerts</div>
                <div className="text-[10px] text-[#C95A63] font-mono-tech mt-1">Backend total</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/50 border border-white/80">
                <div className="text-2xl sm:text-3xl font-bold font-mono-tech text-[#111315] tracking-tight">
                  {dashboardMetrics.openIncidents}
                </div>
                <div className="text-xs text-[#555A60] font-medium mt-0.5">Open incidents</div>
                <div className="text-[10px] text-[#529E85] font-mono-tech mt-1">Backend total</div>
              </div>
            </div>

            {
    /* Small Animated Security Activity Chart */
  }
            <div className="pt-4 border-t border-black/5">
              <div className="flex items-center justify-between text-[11px] mb-2 font-mono-tech text-[#555A60]">
                <span>Event activity</span>
                <span className="text-[#111315] font-semibold">Last 60 minutes</span>
              </div>
              <div className="h-14 w-full flex items-end gap-1.5 pt-2">
                {[45, 62, 54, 78, 92, 65, 84, 98, 72, 88, 76, 94, 82, 100, 89, 74, 91, 85].map((val, i) => <div key={i} className="flex-1 bg-black/5 rounded-t-sm h-full flex items-end overflow-hidden">
                    <div
    className={`w-full rounded-t-sm transition-all duration-500 ${val > 90 ? "bg-[#00E5FF]" : val > 75 ? "bg-[#8CC4CC]" : "bg-[#292B2E]/25"}`}
    style={{ height: `${val}%` }}
  />
                  </div>)}
              </div>
            </div>
          </div>

        </div>
      </section>

      {
    /* 15. LIVE THREAT TICKER */
  }
      <div className="w-full py-2.5 bg-[#292B2E] text-white overflow-hidden relative z-20 border-y border-white/10 select-none">
        <div className="flex items-center gap-8 whitespace-nowrap animate-ticker text-xs font-mono-tech">
          <span>● {dashboardMetrics.events} EVENTS RECEIVED</span>
          <span className="text-white/40">/</span>
          <span>{dashboardMetrics.detections} DETECTIONS</span>
          <span className="text-white/40">/</span>
          <span className="text-[#00E5FF]">{dashboardMetrics.openAlerts} OPEN ALERTS</span>
          <span className="text-white/40">/</span>
          <span className="text-[#529E85]">{dashboardMetrics.openIncidents} OPEN INCIDENTS</span>
          <span className="text-white/40">/</span>
          <span>EVENTS · ALERTS · INCIDENTS</span>
          <span className="text-white/40">/</span>
          <span>THREAT HUNTING · MITRE ATT&amp;CK</span>
          <span className="text-white/40">/</span>
          <span>INCIDENT DEADLINE REMINDERS</span>
          <span className="text-white/40">/</span>
          <span>48-HOUR APPLICATION REMINDER</span>
        </div>
      </div>

      {
    /* 16. PLATFORM OVERVIEW (Unified Security Operations) */
  }
      <section id="platform" className="relative z-10 py-24 px-4 sm:px-6 max-w-6xl mx-auto scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <div className="text-xs font-mono-tech uppercase tracking-wider text-[#6FA7B2] font-semibold mb-2">
            Integrated Cyber Defense Architecture
          </div>
          <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-[#111315] mb-4">
            Security Operations, Unified.
          </h2>
          <p className="text-sm sm:text-base text-[#555A60] leading-relaxed">
            DEJEN brings detection, investigation, response and security intelligence into one operational workspace.
          </p>
        </div>

        {
    /* 17, 18, 19, 20. FOUR FLOATING GLASS MODULES */
  }
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {
    /* Module 01: Real-Time Detection */
  }
          <div className="glass-panel-primary p-7 flex flex-col justify-between hover:shadow-xl transition-all duration-300">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-[#292B2E] text-[#00E5FF] flex items-center justify-center mb-5 shadow-xs">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-[#111315] mb-2 tracking-tight">
                Real-Time Detection
              </h3>
              <p className="text-xs sm:text-sm text-[#555A60] leading-relaxed mb-6">
                Monitor security events and identify suspicious behavior as activity enters the environment.
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/60 border border-white/90">
              <div className="flex items-center justify-between text-xs font-mono-tech mb-3">
                <span className="text-[#555A60]">Telemetry Feed</span>
                <span className="text-[#529E85] font-semibold">Dashboard totals</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-xl bg-white/70">
                  <div className="text-base font-bold font-mono-tech text-[#111315]">{dashboardMetrics.events}</div>
                  <div className="text-[10px] text-[#555A60]">Events received</div>
                </div>
                <div className="p-2 rounded-xl bg-white/70">
                  <div className="text-base font-bold font-mono-tech text-[#111315]">{dashboardMetrics.detections}</div>
                  <div className="text-[10px] text-[#555A60]">Detections</div>
                </div>
                <div className="p-2 rounded-xl bg-white/70">
                  <div className="text-base font-bold font-mono-tech text-[#C95A63]">{dashboardMetrics.openAlerts}</div>
                  <div className="text-[10px] text-[#C95A63]">Open alerts</div>
                </div>
              </div>
            </div>
          </div>

          {
    /* Module 02: Incident Response */
  }
          <div className="glass-panel-primary p-7 flex flex-col justify-between hover:shadow-xl transition-all duration-300">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-[#292B2E] text-[#529E85] flex items-center justify-center mb-5 shadow-xs">
                <Flame className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-[#111315] mb-2 tracking-tight">
                Incident Response
              </h3>
              <p className="text-xs sm:text-sm text-[#555A60] leading-relaxed mb-6">
                Move from alert to containment, eradication and recovery through a structured incident response workflow.
              </p>
            </div>

            {
    /* Workflow Visual */
  }
            <div className="p-4 rounded-2xl bg-white/60 border border-white/90 flex items-center justify-between gap-1 text-[11px] font-mono-tech">
              {["Identification", "Containment", "Eradication", "Recovery"].map((stage, idx) => <React.Fragment key={stage}>
                  <div className="flex-1 py-1.5 px-1 bg-white rounded-lg text-center border border-black/5 text-[#111315] font-medium truncate">
                    {stage}
                  </div>
                  {idx < 3 && <span className="text-[#858A90] font-bold text-xs">→</span>}
                </React.Fragment>)}
            </div>
          </div>

          {
    /* Module 03: Threat Investigation */
  }
          <div className="glass-panel-primary p-7 flex flex-col justify-between hover:shadow-xl transition-all duration-300">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-[#292B2E] text-[#00E5FF] flex items-center justify-center mb-5 shadow-xs">
                <GitFork className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-[#111315] mb-2 tracking-tight">
                Threat Investigation
              </h3>
              <p className="text-xs sm:text-sm text-[#555A60] leading-relaxed mb-6">
                Inspect host, user, process, and source-IP fields carried by a selected hunt event. Entity relationships are not inferred.
              </p>
            </div>

            {
    /* Graph Node Visual */
  }
            <div className="p-4 rounded-2xl bg-white/60 border border-white/90 text-xs font-mono-tech space-y-1.5">
              <div className="mb-2 text-[9px] font-bold uppercase tracking-wider text-[#697974]">Illustrative example, not event evidence</div>
              <div className="flex items-center gap-2 text-[#111315] font-semibold">
                <Server className="w-3.5 h-3.5 text-[#6FA7B2]" />
                <span>Host: example-host</span>
              </div>
              <div className="pl-4 border-l border-black/10 ml-1.5 space-y-1 text-[#555A60]">
                <div className="flex items-center gap-2">
                  <span>├── User: example.user</span>
                </div>
                <div className="flex items-center gap-2 text-[#C95A63]">
                  <span>├── Process: example-process</span>
                </div>
                <div className="flex items-center gap-2 text-[#D49E5D]">
                  <span>└── External IP: 203.0.113.10</span>
                </div>
              </div>
            </div>
          </div>

          {
    /* Module 04: Threat Hunting */
  }
          <div className="glass-panel-primary p-7 flex flex-col justify-between hover:shadow-xl transition-all duration-300">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-[#292B2E] text-[#D49E5D] flex items-center justify-center mb-5 shadow-xs">
                <Crosshair className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-semibold text-[#111315] mb-2 tracking-tight">
                Threat Hunting
              </h3>
              <p className="text-xs sm:text-sm text-[#555A60] leading-relaxed mb-6">
                Search security telemetry using structured queries, detection rules and MITRE ATT&CK techniques.
              </p>
            </div>

            {
    /* Flow Visual */
  }
            <div className="p-4 rounded-2xl bg-white/60 border border-white/90 flex items-center justify-between gap-1 text-[11px] font-mono-tech">
              {["Query", "Events", "Detection", "MITRE"].map((step, idx) => <React.Fragment key={step}>
                  <div className="flex-1 py-1.5 px-1 bg-white rounded-lg text-center border border-black/5 text-[#111315] font-medium truncate">
                    {step}
                  </div>
                  {idx < 3 && <span className="text-[#858A90] font-bold text-xs">→</span>}
                </React.Fragment>)}
            </div>
          </div>
        </div>
      </section>

      {
    /* 21. 48-HOUR INCIDENT SLA SECTION */
  }
      <section id="compliance" className="relative z-10 py-20 px-4 sm:px-6 max-w-6xl mx-auto scroll-mt-20">
        <div className="glass-panel-primary p-8 sm:p-12 shadow-2xl relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {
    /* Left Content */
  }
            <div className="lg:col-span-6 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 border border-white text-xs font-mono-tech text-[#555A60]">
                <Clock className="w-3.5 h-3.5 text-[#00E5FF]" />
                INCIDENT REPORTING WINDOW
              </div>
              <h2 className="text-2xl sm:text-4xl font-semibold text-[#111315] tracking-tight">
                Respond Within the Window.
              </h2>
              <p className="text-sm sm:text-base text-[#555A60] leading-relaxed">
                The Operations Overview dashboard tracks the 48-hour incident reporting window and highlights open incidents due within 12 hours or overdue.
              </p>

              {
    /* State Pills */
  }
              <div className="pt-2">
                <div className="text-xs text-[#858A90] font-mono-tech mb-2">Application reminder thresholds:</div>
                <div className="flex flex-wrap gap-2">
                  {[
    { label: "More than 24h", color: "text-teal-700 bg-teal-50 border-teal-200" },
    { label: "12h to 24h", color: "text-amber-700 bg-amber-50 border-amber-200" },
    { label: "Due within 12h", color: "text-red-700 bg-red-50 border-red-200" },
    { label: "Overdue", color: "text-neutral-700 bg-neutral-100 border-neutral-200" }
  ].map((threshold) => <span
    key={threshold.label}
    className={`text-xs px-3 py-1 rounded-full border font-mono-tech ${threshold.color}`}
  >
                      {threshold.label}
                    </span>)}
                </div>
                <p className="mt-2 text-[10px] leading-4 text-[#697974]">This 48-hour deadline is an application reminder based on incident creation time, not a regulatory compliance assessment.</p>
              </div>
            </div>

            {
    /* Right Main SLA Countdown Visualization */
  }
            <div className="lg:col-span-6 flex flex-col items-center justify-center p-6 sm:p-8 rounded-3xl bg-white/60 border border-white/90 shadow-sm text-center">
              <div className="text-xs font-mono-tech text-[#858A90] uppercase tracking-wider mb-2">
                48-Hour Incident Reporting Window
              </div>
              <div className="text-xs font-mono-tech text-[#555A60] mb-4">
                Application deadline reminder
              </div>

              {
    /* Circular Progress Ring with Countdown */
  }
              <div className="relative w-48 h-48 sm:w-56 sm:h-56 rounded-full flex flex-col items-center justify-center p-4 bg-white/80 border-4 border-[#00E5FF]/40 shadow-inner">
                <div className="text-3xl sm:text-4xl font-bold font-mono-tech text-[#111315] tracking-tight">48h</div>
                <div className="mt-2 text-xs font-mono-tech px-2.5 py-0.5 rounded-full bg-[#529E85]/10 text-[#529E85] font-semibold border border-[#529E85]/20">FROM INCIDENT CREATION</div>
              </div>

              <div className="mt-5 text-xs text-[#555A60] font-mono-tech">
                Open incident deadlines are shown on the Operations Overview dashboard.
              </div>
            </div>
          </div>
        </div>
      </section>

      {
    /* 22. THREAT DETECTION SECTION */
  }
      <section id="security" className="relative z-10 py-20 px-4 sm:px-6 max-w-6xl mx-auto scroll-mt-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {
    /* Left Text */
  }
          <div className="lg:col-span-5 space-y-4">
            <div className="text-xs font-mono-tech text-[#6FA7B2] uppercase tracking-wider font-semibold">
              Autonomous Behavioral Sensor Grid
            </div>
            <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-[#111315]">
              Threat Detection
            </h2>
            <p className="text-sm sm:text-base text-[#555A60] leading-relaxed">
              Detect complex lateral movements, privilege escalations, and command-and-control beacons across hybrid infrastructure before attackers achieve persistence.
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-white/60 border border-white/90">
                <div className="text-xl font-bold font-mono-tech text-[#111315]">{dashboardMetrics.detections}</div>
                <div className="text-xs text-[#555A60]">Detections</div>
              </div>
              <div className="p-3.5 rounded-2xl bg-white/60 border border-white/90">
                <div className="text-xl font-bold font-mono-tech text-[#529E85]">{dashboardMetrics.openAlerts}</div>
                <div className="text-xs text-[#555A60]">Open alerts</div>
              </div>
            </div>
          </div>

          {
    /* Right Asymmetrical Telemetry Vis */
  }
          <div className="lg:col-span-7 glass-panel-primary p-6 sm:p-7 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-black/5 mb-5">
              <div className="text-xs font-bold font-mono-tech text-[#111315] uppercase">
                Dashboard Event Summary
              </div>
              <div className="text-[11px] text-[#529E85] font-mono-tech flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> {dashboardMetrics.events} events received
              </div>
            </div>

            {
    /* Coverage Progress Bar */
  }
            <div className="mb-6">
              <div className="flex items-center justify-between text-xs font-mono-tech text-[#555A60] mb-1.5">
                <span>Current detection total</span>
                <span className="font-bold text-[#111315]">{dashboardMetrics.detections}</span>
              </div>
              <div className="w-full h-2 rounded-full bg-black/5 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-[#6FA7B2] to-[#00E5FF] w-3/4" />
              </div>
            </div>

            {
    /* Time series chart */
  }
            <div className="space-y-2">
              <div className="text-[11px] font-mono-tech text-[#858A90]">Illustrative event activity</div>
              <div className="h-24 w-full flex items-end gap-1 pt-2">
                {[20, 25, 30, 22, 18, 45, 60, 38, 28, 70, 85, 40, 32, 25, 30, 42, 65, 80, 50, 35, 28, 24].map((v, i) => <div key={i} className="flex-1 bg-black/5 rounded-t-sm h-full flex items-end overflow-hidden">
                    <div
    className={`w-full rounded-t-sm ${v > 70 ? "bg-[#C95A63]" : v > 40 ? "bg-[#D49E5D]" : "bg-[#00E5FF]"}`}
    style={{ height: `${v}%` }}
  />
                  </div>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      {
    /* 23. INVESTIGATION SECTION */
  }
      <section id="investigation" className="relative z-10 py-20 px-4 sm:px-6 max-w-6xl mx-auto scroll-mt-20">
        <div className="glass-panel-primary p-8 sm:p-10 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-black/5 mb-8 gap-4">
            <div>
              <div className="text-xs font-mono-tech text-[#6FA7B2] uppercase tracking-wider font-semibold">
                Forensic Graph Studio
              </div>
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-[#111315] mt-1">
                See the Attack Path.
              </h2>
            </div>
            <button
    onClick={() => navigate("/investigation")}
    className="px-5 py-2 rounded-full bg-[#292B2E] hover:bg-black text-white text-xs font-semibold flex items-center gap-2 self-start cursor-pointer shadow-xs"
  >
              <span>Explore Investigation</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#00E5FF]" />
            </button>
          </div>

          <p className="mb-3 text-[10px] text-[#697974]">Illustrative attack-path example only. The current investigation view displays event fields and does not verify relationships or entity risk.</p>

          {
    /* Interactive Graph Node Strip */
  }
          <div className="relative p-6 rounded-2xl bg-white/50 border border-white/80 overflow-x-auto mb-6">
            <div className="min-w-[620px] flex items-center justify-between relative">
              {[
    { name: "example.user", type: "User", status: "Example", details: "Illustrative user entity; not a backend record." },
    { name: "example-host", type: "Host", status: "Example", details: "Illustrative host entity; not a backend record." },
    { name: "example-process", type: "Process", status: "Example", details: "Illustrative process entity; not a backend record." },
    { name: "203.0.113.10", type: "Example IP", status: "Example", details: "Documentation-only address reserved for examples." },
    { name: "Example network indicator", type: "Network indicator", status: "Example", details: "Illustrative relationship target; not a backend record." }
  ].map((node, i, arr) => <React.Fragment key={node.name}>
                  <div
    onClick={() => setSelectedNode(node)}
    className={`flex flex-col items-center text-center p-3 rounded-2xl cursor-pointer transition-all ${selectedNode?.name === node.name ? "bg-white shadow-md ring-2 ring-[#00E5FF] scale-105" : "bg-white/80 hover:bg-white hover:scale-102 border border-black/5"}`}
  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center mb-1.5 ${node.status === "Malicious" ? "bg-[#C95A63]/15 text-[#C95A63]" : node.status === "Suspicious" ? "bg-[#D49E5D]/15 text-[#D49E5D]" : "bg-[#529E85]/15 text-[#529E85]"}`}>
                      {i === 0 && <span className="text-xs font-bold font-mono-tech">USR</span>}
                      {i === 1 && <Server className="w-4 h-4" />}
                      {i === 2 && <Terminal className="w-4 h-4" />}
                      {i === 3 && <Globe className="w-4 h-4" />}
                      {i === 4 && <ShieldAlert className="w-4 h-4" />}
                    </div>
                    <span className="text-xs font-semibold text-[#111315] font-mono-tech truncate max-w-[100px]">
                      {node.name}
                    </span>
                    <span className="text-[10px] text-[#858A90] font-mono-tech">{node.status}</span>
                  </div>

                  {i < arr.length - 1 && <div className="flex-1 flex items-center justify-center px-2">
                      <div className={`h-[2px] w-full ${i >= 2 ? "bg-[#C95A63]" : "bg-[#00E5FF]"}`} />
                    </div>}
                </React.Fragment>)}
            </div>
          </div>

          {
    /* Node Forensic Details Card */
  }
          {selectedNode && <div className="p-4 rounded-2xl bg-white/70 border border-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono-tech">
              <div>
                <span className="text-[#858A90]">Active Inspector: </span>
                <span className="font-bold text-[#111315]">{selectedNode.name}</span>
                <span className="text-[#858A90]"> ({selectedNode.type}) — </span>
                <span className="text-[#555A60]">{selectedNode.details}</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold ${selectedNode.status === "Malicious" ? "bg-red-50 text-red-700 border-red-200" : selectedNode.status === "Suspicious" ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-teal-50 text-teal-700 border-teal-200"}`}>
                {selectedNode.status}
              </span>
            </div>}
        </div>
      </section>

      {
    /* 24. THREAT HUNTING SECTION */
  }
      <section id="threat-hunting" className="relative z-10 py-20 px-4 sm:px-6 max-w-6xl mx-auto scroll-mt-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-5 space-y-4">
            <div className="text-xs font-mono-tech text-[#6FA7B2] uppercase tracking-wider font-semibold">
              Proactive Adversary Interception
            </div>
            <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-[#111315]">
              Threat Hunting
            </h2>
            <p className="text-sm sm:text-base text-[#555A60] leading-relaxed">
              Formulate hypotheses and execute cross-fleet queries to reveal stealthy adversary activity before automated signatures trip.
            </p>
            <div className="text-xs font-mono-tech text-[#555A60] space-y-1">
              <div>• Structured query language on real-time event pipeline</div>
              <div>• Instant MITRE ATT&CK correlation</div>
              <div>• MITRE ATT&CK technique references</div>
            </div>
          </div>

          {
    /* Embedded Dark Glass Query Editor */
  }
          <div className="lg:col-span-7 glass-panel-dark p-6 sm:p-7 text-white shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#00E5FF]" />
                <span className="text-xs font-mono-tech font-semibold">Threat Hunting Console</span>
              </div>
              <span className="text-[10px] font-mono-tech text-neutral-400">DEJEN Query</span>
            </div>

            {
    /* Query Code Block */
  }
            <div className="p-4 rounded-xl bg-black/60 border border-white/10 font-mono-tech text-xs text-[#00E5FF] leading-relaxed mb-4 select-all">
              <span className="text-neutral-400"># Example query for matching process events</span>
              <br />
              <span className="text-pink-400">severity</span> = <span className="text-emerald-300">"HIGH"</span>
              <br />
              <span className="text-yellow-400">AND</span> <span className="text-pink-400">message</span> <span className="text-yellow-400">CONTAINS</span> <span className="text-emerald-300">"powershell"</span>
            </div>

            {
    /* Result Preview Strip */
  }
            <div className="p-3 rounded-xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs font-mono-tech mb-4">
              <div className="flex items-center gap-4 text-neutral-300">
                <span>Example matches</span>
                <span className="text-neutral-600">·</span>
                <span>Hosts</span>
                <span className="text-neutral-600">·</span>
                <span>Users</span>
                <span className="text-neutral-600">·</span>
                <span className="text-[#00E5FF]">MITRE ATT&amp;CK references</span>
              </div>
            </div>

            {
    /* Run Button */
  }
            <button
    onClick={handleRunQuery}
    disabled={queryRunning}
    className="w-full py-2.5 rounded-xl bg-[#00E5FF] hover:bg-[#8CC4CC] text-[#111315] font-semibold text-xs font-mono-tech transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
  >
              {queryRunning ? <span>Executing cross-fleet sweep...</span> : <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Threat Hunt</span>
                </>}
            </button>

            {querySuccess && <div className="mt-3 text-[11px] font-mono-tech text-emerald-400 text-center animate-in fade-in">
                ✓ Example query preview complete. Results are illustrative, not live dashboard data.
              </div>}
          </div>
        </div>
      </section>

      {
    /* 25. MITRE ATT&CK SECTION */
  }
      <section className="relative z-10 py-20 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-xs font-mono-tech text-[#6FA7B2] uppercase tracking-wider font-semibold mb-2">
            Adversary Behavioral Mapping
          </div>
          <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-[#111315] mb-3">
            Map Activity to MITRE ATT&CK.
          </h2>
          <p className="text-sm text-[#555A60]">
            Use MITRE ATT&amp;CK technique references to investigate and contextualize security activity.
          </p>
        </div>

        {
    /* MITRE Matrix Grid */
  }
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
    { id: "T1078", name: "Valid Accounts", tactic: "TA0001", intensity: "Reference", description: "Adversaries may use legitimate credentials to gain access.", mitigation: "Enforce MFA and monitor unusual account use." },
    { id: "T1059", name: "Command and Scripting Interpreter", tactic: "TA0002", intensity: "Reference", description: "Adversaries may abuse command and script interpreters.", mitigation: "Restrict script execution and enable relevant logging." },
    { id: "T1053", name: "Scheduled Task/Job", tactic: "TA0003", intensity: "Reference", description: "Adversaries may abuse task scheduling to maintain execution.", mitigation: "Audit scheduled task and job creation." },
    { id: "T1068", name: "Exploitation for Privilege Escalation", tactic: "TA0004", intensity: "Reference", description: "Adversaries may exploit software vulnerabilities to elevate privileges.", mitigation: "Apply security updates and restrict elevated privileges." },
    { id: "T1003", name: "OS Credential Dumping", tactic: "TA0006", intensity: "Reference", description: "Adversaries may attempt to obtain credentials from operating systems.", mitigation: "Enable credential protection and monitor access to credential stores." },
    { id: "T1082", name: "System Information Discovery", tactic: "TA0007", intensity: "Reference", description: "Adversaries may enumerate system configuration and details.", mitigation: "Monitor unexpected system discovery activity." },
    { id: "T1021", name: "Remote Services", tactic: "TA0008", intensity: "Reference", description: "Adversaries may use remote services to move between systems.", mitigation: "Segment networks and restrict remote service access." },
    { id: "T1071", name: "Application Layer Protocol", tactic: "TA0011", intensity: "Reference", description: "Adversaries may use application-layer protocols for command and control.", mitigation: "Monitor network traffic and apply DNS/web controls." },
    { id: "T1486", name: "Data Encrypted for Impact", tactic: "TA0040", intensity: "Reference", description: "Adversaries may encrypt data to disrupt availability.", mitigation: "Maintain tested backups and monitor bulk file changes." }
  ].map((tech) => <div
    key={tech.id}
    onClick={() => setSelectedMitre(tech)}
    className="glass-panel-primary p-4 rounded-2xl flex flex-col justify-between hover:shadow-lg transition-all duration-200 cursor-pointer border border-white/80"
  >
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono-tech mb-1.5">
                  <span className="text-[#858A90]">{tech.id}</span>
                  <span className="rounded-full bg-[#edf1f3] px-1.5 py-0.5 font-bold text-[#53616a]">
                    {tech.intensity}
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-[#111315] leading-tight mb-2">
                  {tech.name}
                </h4>
              </div>

              <div className="flex items-center justify-between text-[10px] font-mono-tech text-[#555A60] pt-2 border-t border-black/5">
                <span>{tech.tactic}</span>
                <span className="font-bold text-[#111315]">ATT&amp;CK</span>
              </div>
            </div>)}
        </div>

        {
    /* MITRE Info Modal Drawer */
  }
        {selectedMitre && <div
    className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs flex items-center justify-center p-4"
    onClick={() => setSelectedMitre(null)}
  >
            <div
    className="w-full max-w-lg glass-modal p-6 shadow-2xl border border-neutral-200"
    onClick={(e) => e.stopPropagation()}
  >
              <div className="flex items-center justify-between pb-3 border-b border-black/10 mb-4">
                <div>
                  <span className="text-[10px] font-mono-tech text-[#858A90] uppercase">
                    MITRE Technique Detail
                  </span>
                  <h3 className="text-base font-bold text-[#111315]">
                    {selectedMitre.id}: {selectedMitre.name}
                  </h3>
                </div>
                <button
    onClick={() => setSelectedMitre(null)}
    className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center text-xs font-bold"
  >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="font-semibold text-[#111315]">Description:</span>
                  <p className="text-[#555A60] mt-0.5 leading-relaxed">{selectedMitre.description}</p>
                </div>
                <div>
                  <span className="font-semibold text-[#111315]">Automated Mitigation:</span>
                  <p className="text-[#529E85] mt-0.5 leading-relaxed">{selectedMitre.mitigation}</p>
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-black/10 flex justify-end">
                <button
    onClick={() => setSelectedMitre(null)}
    className="px-4 py-1.5 rounded-xl bg-[#292B2E] text-white text-xs font-semibold"
  >
                  Done
                </button>
              </div>
            </div>
          </div>}
      </section>

      {
    /* 26 & 27. THREAT GEOGRAPHY & CIRCULAR SECURITY ANALYTICS */
  }
      <section className="relative z-10 py-20 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {
    /* 26. Event Source Context */
  }
          <div className="lg:col-span-6 glass-panel-primary p-7 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-black/5 mb-4">
              <div>
                <div className="text-[10px] font-mono-tech text-[#858A90] uppercase">Backend Event Data</div>
                <h3 className="text-base font-semibold text-[#111315]">Observed Event Sources</h3>
              </div>
              <span className="text-xs font-mono-tech px-2 py-0.5 rounded-full bg-white text-[#111315] border border-black/5">
                {events.length} events
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-white/40 border border-white/80 space-y-2 text-xs font-mono-tech text-[#555A60]">
              {eventSourceRows.map((row, index) => <div key={`${row.source}-${index}`} className="flex items-center justify-between gap-3"><span className="truncate">{row.source}</span><span className="shrink-0 text-[#697974]">{row.detail}</span></div>)}
              {!eventSourceRows.length && <p>No event source data is available until backend records are loaded.</p>}
            </div>
            <p className="mt-3 text-[10px] leading-4 text-[#697974]">Country, ASN, geolocation, and blocked-request counts are not provided by the current event API.</p>
          </div>

          {
    /* 27. Security Analytics Circular Metrics */
  }
          <div className="lg:col-span-6 glass-panel-primary p-7 shadow-xl flex flex-col justify-between">
            <div className="flex items-center justify-between pb-3 border-b border-black/5 mb-4">
              <div>
                <div className="text-[10px] font-mono-tech text-[#858A90] uppercase">Backend Summary</div>
                <h3 className="text-base font-semibold text-[#111315]">Operational Counts</h3>
              </div>
              <span className="text-xs font-mono-tech text-[#555A60]">API data</span>
            </div>

            {
    /* 4 Circular Indicators */
  }
            <div className="grid grid-cols-2 gap-4">
              {[
    { label: "Events received", val: dashboardMetrics.events, sub: "Backend total" },
    { label: "Detections", val: dashboardMetrics.detections, sub: "Backend total" },
    { label: "Open alerts", val: dashboardMetrics.openAlerts, sub: "Backend total" },
    { label: "Open incidents", val: dashboardMetrics.openIncidents, sub: "Backend total" }
  ].map((stat) => <div key={stat.label} className="p-4 rounded-2xl bg-white/60 border border-white/80 flex flex-col items-center text-center">
                  <div className="w-14 h-14 rounded-full border-4 border-[#00E5FF]/40 flex items-center justify-center font-mono-tech font-bold text-sm text-[#111315] mb-2 shadow-xs">
                    {stat.val}
                  </div>
                  <div className="text-xs font-semibold text-[#111315]">{stat.label}</div>
                  <div className="text-[10px] text-[#858A90] font-mono-tech">{stat.sub}</div>
                </div>)}
            </div>
          </div>
        </div>
      </section>

      {
    /* 28. AGENT FLEET SECTION */
  }
      <section className="relative z-10 py-16 px-4 sm:px-6 max-w-6xl mx-auto">
        <div className="glass-panel-primary p-8 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-black/5 mb-6 gap-3">
            <div>
              <div className="text-xs font-mono-tech text-[#6FA7B2] uppercase tracking-wider font-semibold">
                Distributed Endpoint Mesh
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#111315]">
                One View of the Security Fleet.
              </h3>
            </div>
            <div className="text-xs font-mono-tech text-[#555A60]">{observedAgents} agents in event data</div>
          </div>

          <p className="text-xs leading-5 text-[#555A60]">Counted from distinct agent IDs on returned events. The event API does not include an agent inventory, operating system, heartbeat, or health status.</p>
        </div>
      </section>

      {
    /* 29. REPORTING SECTION */
  }
      <section id="reports" className="relative z-10 py-20 px-4 sm:px-6 max-w-6xl mx-auto scroll-mt-20">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <div className="text-xs font-mono-tech text-[#6FA7B2] uppercase tracking-wider font-semibold mb-2">
            Executive & Forensic Output
          </div>
          <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-[#111315] mb-3">
            Export Current Security Records.
          </h2>
          <p className="text-sm text-[#555A60]">
            Generate PDF or CSV snapshots of the summary, alerts, incidents, and event telemetry loaded from the DEJEN backend.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {[
    {
      title: "Operations summary",
      desc: "Dashboard totals for events, alerts, and incident status.",
      tag: "BACKEND SUMMARY"
    },
    {
      title: "Alert register",
      desc: "Detection title, severity, status, rule, and available source details.",
      tag: "ALERT RECORDS"
    },
    {
      title: "Incident register",
      desc: "Incident status, assignment, severity, related alert, and description.",
      tag: "INCIDENT RECORDS"
    },
    {
      title: "Event telemetry",
      desc: "Ingested event timestamps, hosts, agents, users, and source addresses.",
      tag: "EVENT RECORDS"
    }
  ].map((report) => <div key={report.title} className="glass-panel-primary p-5 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-mono-tech px-2 py-0.5 rounded-full bg-white text-[#555A60] border border-black/5 font-semibold">
                  {report.tag}
                </span>
                <h4 className="text-sm font-bold text-[#111315] mt-3 mb-2">
                  {report.title}
                </h4>
                <p className="text-xs text-[#555A60] leading-relaxed mb-6">
                  {report.desc}
                </p>
              </div>

              <div className="pt-3 border-t border-black/5 flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs font-mono-tech text-[#111315]">
                  <span>PDF · CSV</span>
                  <span className="text-[#555A60]">After sign-in</span>
                </div>
              </div>
            </div>)}
        </div>

        <div className="text-center">
          <button
    onClick={() => navigate("/login")}
    className="px-6 py-2.5 rounded-full bg-[#292B2E] hover:bg-black text-white text-xs font-semibold transition-all duration-200 shadow-xs cursor-pointer inline-flex items-center gap-2"
  >
            <span>Explore Reporting</span>
            <ArrowRight className="w-3.5 h-3.5 text-[#00E5FF]" />
          </button>
        </div>
      </section>

      {
    /* 40. FINAL CTA SECTION */
  }
      <section className="relative z-10 py-24 px-4 sm:px-6 max-w-4xl mx-auto text-center">
        <div className="glass-panel-primary p-10 sm:p-14 shadow-2xl relative overflow-hidden">
          <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-[#111315] mb-4">
            Ready to Operate From One Security Workspace?
          </h2>
          <p className="text-sm sm:text-base text-[#555A60] leading-relaxed max-w-xl mx-auto mb-8">
            Bring security events, alerts, incidents, investigation, threat hunting and reporting into DEJEN.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
    onClick={() => navigate("/login")}
    className="px-8 py-3 rounded-full bg-[#292B2E] hover:bg-black text-white text-xs sm:text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 shadow-md flex items-center gap-2 cursor-pointer"
  >
              <span>Launch DEJEN</span>
              <ArrowRight className="w-4 h-4 text-[#00E5FF]" />
            </button>
            <button
    onClick={() => scrollTo("platform")}
    className="px-6 py-3 rounded-full bg-white/70 hover:bg-white text-[#111315] text-xs sm:text-sm font-medium border border-white transition-all duration-200 hover:-translate-y-0.5 cursor-pointer shadow-xs"
  >
              Explore Platform
            </button>
          </div>
        </div>
      </section>

      {
    /* 41. MINIMAL ENTERPRISE FOOTER */
  }
      <footer className="relative z-10 py-12 px-4 sm:px-6 max-w-6xl mx-auto border-t border-black/5 text-xs text-[#555A60]">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <DejenLogo size="sm" variant="circular-white" />
            <div>
              <img src={dejenWordmark} alt="DEJEN" className="h-4 w-20 object-cover object-[50%_62%]" />
              <p className="text-[11px] text-[#858A90]">Security Operations Platform</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs">
            <button onClick={() => scrollTo("platform")} className="landing-footer-link hover:text-[#111315] transition-colors cursor-pointer">
              Platform
            </button>
            <button onClick={() => scrollTo("security")} className="landing-footer-link hover:text-[#111315] transition-colors cursor-pointer">
              Security
            </button>
            <button onClick={() => scrollTo("threat-hunting")} className="landing-footer-link hover:text-[#111315] transition-colors cursor-pointer">
              Threat Hunting
            </button>
            <button onClick={() => scrollTo("compliance")} className="landing-footer-link hover:text-[#111315] transition-colors cursor-pointer">
              Compliance
            </button>
            <button onClick={() => scrollTo("reports")} className="landing-footer-link hover:text-[#111315] transition-colors cursor-pointer">
              Reports
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button
    onClick={() => navigate("/login")}
    className="px-3.5 py-1.5 rounded-full bg-[#292B2E] text-white hover:bg-black font-semibold text-[11px] transition-colors cursor-pointer"
  >
              Launch DEJEN
            </button>
          </div>
        </div>

        <div className="mt-8 pt-4 border-t border-black/5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#858A90] font-mono-tech">
          <span>© 2026 DEJEN. All rights reserved. Enterprise Security Operations.</span>
          <span>48h SLA Assurance Active</span>
        </div>
      </footer>
    </div>;
};
