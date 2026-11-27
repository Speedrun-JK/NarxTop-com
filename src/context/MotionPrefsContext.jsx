import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { MotionConfig } from "framer-motion";
import { onStorage, safeGet, safeSet } from "../lib/storage";

const KEY = "narxtop_motion";
const VALID = ["system", "on", "off"];
const MotionPrefs = createContext(null);

function readMode() {
  const value = safeGet(KEY, "system");
  return VALID.includes(value) ? value : "system";
}

function lowPowerDevice() {
  if (typeof navigator === "undefined") return false;
  const cores = Number(navigator.hardwareConcurrency || 0);
  const memory = Number(navigator.deviceMemory || 0); // Chromium only; capped at 8, and 4 GB is a normal phone
  /* Only genuinely weak devices lose animations automatically. The old "<= 4 GB" / "phone with <= 4 cores" rule
     switched motion off on most ordinary phones (and on iPhones, where Safari under-reports cores). */
  return Boolean(navigator.connection?.saveData)
    || (memory > 0 && memory <= 2)
    || (memory > 0 && cores > 0 && cores <= 2);
}

export function MotionPrefsProvider({ children }) {
  const [mode, setModeState] = useState(readMode);
  const [systemReduced, setSystemReduced] = useState(() => typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches));
  const [systemLowPower, setSystemLowPower] = useState(lowPowerDevice);
  const setMode = useCallback((next) => {
    if (!VALID.includes(next)) return;
    setModeState(next);
    safeSet(KEY, next);
  }, []);
  useEffect(() => onStorage(KEY, () => {
    const next = safeGet(KEY, "system");
    setModeState(VALID.includes(next) ? next : "system");
  }), []);
  useEffect(() => {
    const update = () => setSystemLowPower(lowPowerDevice());
    const connection = navigator.connection;
    window.addEventListener("resize", update, { passive: true });
    connection?.addEventListener?.("change", update);
    return () => {
      window.removeEventListener("resize", update);
      connection?.removeEventListener?.("change", update);
    };
  }, []);
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media) return undefined;
    const update = () => setSystemReduced(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);
  const disabled = mode === "off" || (mode === "system" && (systemReduced || systemLowPower));
  useEffect(() => {
    document.documentElement.dataset.motion = disabled ? "off" : "on";
    document.documentElement.dataset.performance = disabled ? "low" : "normal";
  }, [disabled]);
  const value = useMemo(() => ({ mode, setMode, disabled }), [mode, setMode, disabled]);
  return <MotionPrefs.Provider value={value}><MotionConfig skipAnimations={disabled} reducedMotion={mode === "system" ? "user" : disabled ? "always" : "never"}>{children}</MotionConfig></MotionPrefs.Provider>;
}

export function useMotionPrefs() {
  const value = useContext(MotionPrefs);
  if (!value) throw new Error("useMotionPrefs must be used inside MotionPrefsProvider");
  return value;
}
