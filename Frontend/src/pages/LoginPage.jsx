import { useEffect, useState } from "react";
import { useSoc } from "../context/SocContext";
import { ArrowLeft, ArrowRight } from "lucide-react";
import logo from "../assets/images/DEJEN SOC Ethiopian Cyber Shield.png";

const matrixColumnCount = 48;
const telemetryWords = ["AUTH_OK", "TRACE", "BOUNDARY", "IOC_SCAN", "SESSION", "THREAT_OK", "INGEST", "C2_BLOCKED", "MFA_PASS", "HASH_MATCH", "ALERT_CLEARED", "SSH_DENIED", "FLEET_OK", "RULE_SYNC", "BEACON_DROP", "PORT_SCAN", "TOKEN_ROTATE", "MEMORY_GUARD", "DNS_BLOCK", "PROCESS_START"];
const telemetryLevels = ["INFO", "WARN", "NOTICE", "DENY", "PASS", "CRITICAL"];
const randomTelemetryLine = () => {
  const ip = `${10 + Math.floor(Math.random() * 224)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 254) + 1}`;
  const binary = Math.floor(Math.random() * 4294967295).toString(2).padStart(32, "0");
  const event = telemetryWords[Math.floor(Math.random() * telemetryWords.length)];
  const level = telemetryLevels[Math.floor(Math.random() * telemetryLevels.length)];
  const token = Math.floor(Math.random() * 65535).toString(16).toUpperCase().padStart(4, "0");
  const timestamp = `${String(Math.floor(Math.random() * 24)).padStart(2, "0")}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`;
  return `${binary.slice(0, 6)} ${ip} ${level} ${event} 0x${token} ${timestamp} ${binary.slice(6, 16)}`;
};
const randomMatrixTiming = () => {
  const duration = 9 + Math.random() * 14;
  return { duration: `${duration.toFixed(2)}s`, delay: `${(-Math.random() * duration).toFixed(2)}s` };
};

export const LoginPage = () => {
  const { login, error, navigate } = useSoc();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [telemetryColumns, setTelemetryColumns] = useState(() => Array.from({ length: matrixColumnCount }, randomTelemetryLine));
  const [matrixTimings, setMatrixTimings] = useState(() => Array.from({ length: matrixColumnCount }, randomMatrixTiming));
  const hasAuthError = Boolean(error);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setTelemetryColumns((current) => {
        const next = [...current];
        next[Math.floor(Math.random() * matrixColumnCount)] = randomTelemetryLine();
        return next;
      });
      setMatrixTimings((current) => {
        const next = [...current];
        next[Math.floor(Math.random() * matrixColumnCount)] = randomMatrixTiming();
        return next;
      });
    }, 220);
    return () => window.clearInterval(interval);
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    const success = await login(username, password);
    setLoading(false);
    if (success) navigate("/dashboard");
  };

  return (
    <main className={`login-screen relative min-h-screen w-full bg-[#eef1f3] text-[#111315] flex items-center justify-center p-4 ${hasAuthError ? "auth-error" : ""}`}>
      <div className="login-matrix" aria-hidden="true">
        {telemetryColumns.map((column, index) => <span key={index} style={{ "--matrix-left": `${(index / matrixColumnCount) * 100}%`, "--matrix-width": `${100 / matrixColumnCount}%`, "--matrix-duration": matrixTimings[index].duration, "--matrix-delay": matrixTimings[index].delay }}>{column}</span>)}
      </div>
      <div className="login-card relative z-10 w-full max-w-sm bg-white p-8 pt-3 shadow-xl border border-neutral-200 rounded-2xl">
        <div className="flex flex-col items-center text-center mb-8">
          <img src={logo} alt="DEJEN security shield" className="w-64 h-64 max-w-full object-contain object-center mb-1" />
          <h1 className="text-xl font-bold">DEJEN Security Operations</h1>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="username" className="block text-xs font-medium mb-1">Username</label>
            <input id="username" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} className="w-full px-3 py-2 text-sm rounded-lg bg-neutral-50 border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-teal-600" />
          </div>
          <div>
            <label htmlFor="password" className="block text-xs font-medium mb-1">Password</label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full px-3 py-2 text-sm rounded-lg bg-neutral-50 border border-neutral-200 focus:outline-none focus:ring-2 focus:ring-teal-600" />
          </div>
          {error && <p role="alert" className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</p>}
          <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-[#292b2e] text-white text-sm font-semibold hover:bg-[#373a3d] disabled:opacity-60 flex items-center justify-center gap-2">
            <span>{loading ? "Signing in..." : "Sign in"}</span>
            {!loading && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
        <button type="button" onClick={() => navigate("/")} className="mt-4 w-full py-2 text-xs font-medium text-[#555a60] hover:text-[#111315] transition-colors flex items-center justify-center gap-1.5">
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to overview
        </button>
      </div>
    </main>
  );
};
