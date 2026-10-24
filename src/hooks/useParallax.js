import { useEffect, useRef } from "react";
import { useMotionPrefs } from "../context/MotionPrefsContext";

/* Subtle scroll parallax: writes --py (px) on the referenced element while it is on screen; CSS turns it into a
 * transform on .nt-mesh. One passive scroll listener + rAF, only while visible, skipped on phones / motion off. */
export default function useParallax(strength = 0.12) {
  const ref = useRef(null);
  const { disabled } = useMotionPrefs();
  useEffect(() => {
    const el = ref.current;
    if (!el || disabled || typeof IntersectionObserver === "undefined" || window.matchMedia("(max-width: 720px)").matches) return undefined;
    let raf = 0, visible = true;
    const update = () => { raf = 0; el.style.setProperty("--py", `${(window.scrollY * strength).toFixed(1)}`); };
    const onScroll = () => { if (visible && !raf) raf = requestAnimationFrame(update); };
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) onScroll(); });
    io.observe(el);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { io.disconnect(); window.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); el.style.removeProperty("--py"); };
  }, [disabled, strength]);
  return ref;
}
