import { useCallback, useEffect, useRef, useState } from "react";

/*
 * Always-visible scroll indicator for a horizontal swipe row (phones).
 * Native scrollbars are hidden or auto-fading on iOS / small Android screens, so people never saw
 * that a row could be scrolled. This draws its own track + thumb under the row, keeps them in sync
 * with the scroll position, and can be tapped or dragged. It renders nothing when the row fits.
 *
 *   <div ref={ref} className="row">…</div>
 *   <ScrollBar targetRef={ref} />
 */
export default function ScrollBar({ targetRef, className = "", axis = "x" }) {
  const v = axis === "y";
  const barRef = useRef(null);
  const [m, setM] = useState({ show: false, size: 1, pos: 0 });

  const measure = useCallback(() => {
    const el = targetRef.current;
    if (!el) return;
    const view = v ? el.clientHeight : el.clientWidth, full = v ? el.scrollHeight : el.scrollWidth, at = v ? el.scrollTop : el.scrollLeft;
    const max = full - view;
    if (max <= 2) { setM((p) => (p.show ? { show: false, size: 1, pos: 0 } : p)); return; }
    const size = Math.max(0.14, view / full);
    const pos = Math.min(1, Math.max(0, at / max));
    setM((p) => (p.show && Math.abs(p.size - size) < 0.002 && Math.abs(p.pos - pos) < 0.002 ? p : { show: true, size, pos }));
  }, [targetRef, v]);

  useEffect(() => {
    const el = targetRef.current;
    if (!el) return;
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    [...el.children].forEach((c) => ro?.observe(c));
    const mo = typeof MutationObserver !== "undefined" ? new MutationObserver(measure) : null;
    mo?.observe(el, { childList: true });
    window.addEventListener("resize", measure);
    const late = setTimeout(measure, 400); // images / fonts settle
    return () => { el.removeEventListener("scroll", measure); ro?.disconnect(); mo?.disconnect(); window.removeEventListener("resize", measure); clearTimeout(late); };
  }, [targetRef, measure]);

  const seek = (e) => {
    const el = targetRef.current, bar = barRef.current;
    if (!el || !bar) return;
    const r = bar.getBoundingClientRect();
    const len = v ? r.height : r.width, off = v ? e.clientY - r.top : e.clientX - r.left;
    const ratio = Math.min(1, Math.max(0, (off - (len * m.size) / 2) / (len * (1 - m.size) || 1)));
    if (v) el.scrollTo({ top: ratio * (el.scrollHeight - el.clientHeight), behavior: "auto" });
    else el.scrollTo({ left: ratio * (el.scrollWidth - el.clientWidth), behavior: "auto" });
  };

  if (!m.show) return null;
  return (
    <div ref={barRef} className={`nt-sbar ${v ? "is-v" : ""} ${className}`} role="scrollbar" aria-orientation={v ? "vertical" : "horizontal"} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(m.pos * 100)}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); seek(e); }}
      onPointerMove={(e) => { if (e.buttons || e.pointerType === "touch") seek(e); }}>
      <i style={v ? { height: `${m.size * 100}%`, top: `${m.pos * (1 - m.size) * 100}%` } : { width: `${m.size * 100}%`, left: `${m.pos * (1 - m.size) * 100}%` }} />
    </div>
  );
}

/* A swipe row with its scroll bar attached. */
export function HScroll({ className = "", children, as: Tag = "div", ...rest }) {
  const ref = useRef(null);
  return (
    <div className="nt-hs">
      <Tag ref={ref} className={`nt-hs-scroll ${className}`} {...rest}>{children}</Tag>
      <ScrollBar targetRef={ref} />
    </div>
  );
}
