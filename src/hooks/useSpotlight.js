import { useCallback, useRef } from "react";
import { useMotionPrefs } from "../context/MotionPrefsContext";

/* Pointer-follow glow: sets --mx/--my (px) on the element; CSS draws the light. Skipped for touch / reduced motion. */
export default function useSpotlight() {
  const { disabled } = useMotionPrefs();
  const raf = useRef(0);
  return useCallback((e) => {
    if (disabled || e.pointerType === "touch") return;
    const el = e.currentTarget;
    const { clientX, clientY } = e;
    cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${clientX - r.left}px`);
      el.style.setProperty("--my", `${clientY - r.top}px`);
    });
  }, [disabled]);
}
