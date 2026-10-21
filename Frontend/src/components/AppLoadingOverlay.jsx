import { useEffect, useRef, useState } from "react";
import logo from "../assets/images/DEJEN SOC Ethiopian Cyber Shield1.png";
import wordmark from "../assets/images/DEJEN SOC Ethiopian Cyber Shield2.png";

const MIN_VISIBLE_MS = 1800;

export const AppLoadingOverlay = ({ visible }) => {
  const [isVisible, setIsVisible] = useState(visible);
  const visibleSince = useRef(visible ? Date.now() : null);

  useEffect(() => {
    if (visible) {
      visibleSince.current = Date.now();
      setIsVisible(true);
      return undefined;
    }
    if (!isVisible) return undefined;

    const elapsed = visibleSince.current ? Date.now() - visibleSince.current : MIN_VISIBLE_MS;
    const timeoutId = window.setTimeout(() => {
      visibleSince.current = null;
      setIsVisible(false);
    }, Math.max(0, MIN_VISIBLE_MS - elapsed));
    return () => window.clearTimeout(timeoutId);
  }, [visible, isVisible]);

  if (!isVisible) return null;

  return <div className="dejen-loading-overlay" role="status" aria-live="polite" aria-busy="true">
    <div className="dejen-loading-content">
      <div className="dejen-loading-mark-wrap">
        <span className="dejen-loading-ring" aria-hidden="true" />
        <img className="dejen-loading-mark" src={logo} alt="" />
      </div>
      <img className="dejen-loading-wordmark" src={wordmark} alt="DEJEN" />
      <p className="dejen-loading-label">Preparing your security workspace</p>
      <div className="dejen-loading-track" aria-hidden="true"><span /></div>
    </div>
  </div>;
};