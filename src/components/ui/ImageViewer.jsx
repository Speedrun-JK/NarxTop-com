import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import Icon from "./Icon";
import { useLang } from "../../context/LanguageContext";
import "./ImageViewer.css";

const MIN = 1;
const MAX = 5;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/*
 * Full-screen photo viewer (Telegram style).
 *  - tap / click the dark area or press Esc to close; the X button closes too
 *  - double-tap / double-click zooms in and out, mouse wheel zooms on desktop
 *  - pinch with two fingers to zoom, drag to move a zoomed photo
 *  - swipe a non-zoomed photo up or down to dismiss it
 */
export function ImageViewer({ src, alt = "", onClose }) {
  const { t } = useLang();
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const ptrs = useRef(new Map());
  const gesture = useRef({ pinchD: 0, pinchS: 1, moved: 0, lastTap: 0, onImg: false });
  const viewRef = useRef(view);
  useEffect(() => { viewRef.current = view; }, [view]);

  const close = useCallback(() => onClose?.(), [onClose]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); html.style.overflow = prev; };
  }, [close]);

  const dist = () => { const [a, b] = [...ptrs.current.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };

  const onDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current.moved = 0;
    if (ptrs.current.size === 1) gesture.current.onImg = e.target.tagName === "IMG";
    if (ptrs.current.size === 2) { gesture.current.pinchD = dist(); gesture.current.pinchS = viewRef.current.s; }
    setDragging(true);
  };

  const onMove = (e) => {
    const p = ptrs.current.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current.moved += Math.abs(dx) + Math.abs(dy);
    if (ptrs.current.size >= 2) {
      const d = dist();
      if (gesture.current.pinchD) setView((v) => ({ ...v, s: clamp(gesture.current.pinchS * (d / gesture.current.pinchD), MIN, MAX) }));
      return;
    }
    setView((v) => (v.s > 1.02 ? { ...v, x: v.x + dx, y: v.y + dy } : { ...v, y: v.y + dy, x: 0 }));
  };

  const onUp = (e) => {
    const had = ptrs.current.delete(e.pointerId);
    if (!had) return;
    const g = gesture.current;
    if (ptrs.current.size === 1) { g.pinchD = 0; return; }
    if (ptrs.current.size > 0) return;
    setDragging(false);
    const v = viewRef.current;
    const tap = g.moved < 8;
    if (tap && !g.onImg) { close(); return; } // tap on the dark area
    if (tap) {
      const now = Date.now();
      if (now - g.lastTap < 300) { // double tap
        g.lastTap = 0;
        setView(v.s > 1.02 ? { s: 1, x: 0, y: 0 } : { s: 2.6, x: 0, y: 0 });
      } else g.lastTap = now;
      return;
    }
    if (v.s <= 1.02) {
      if (Math.abs(v.y) > 110) { close(); return; } // swiped away
      setView({ s: 1, x: 0, y: 0 });
    }
  };

  const onWheel = (e) => {
    setView((v) => {
      const s = clamp(v.s * (e.deltaY < 0 ? 1.18 : 1 / 1.18), MIN, MAX);
      return s <= 1.02 ? { s: 1, x: 0, y: 0 } : { ...v, s };
    });
  };

  const zoomed = view.s > 1.02;
  const fade = zoomed ? 1 : Math.max(0.35, 1 - Math.abs(view.y) / 420);

  return createPortal(
    <div className="nt-iv" role="dialog" aria-modal="true" aria-label={alt} style={{ "--iv-fade": fade }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
      <div className="nt-iv-top" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()}>
        <span className="nt-iv-title">{alt}</span>
        <button type="button" className="nt-iv-close" onClick={close} aria-label={t("common.close") === "common.close" ? "Close" : t("common.close")}><Icon name="x" size={22} strokeWidth={2.4} /></button>
      </div>
      <img className={`nt-iv-img ${dragging ? "is-drag" : ""} ${zoomed ? "is-zoomed" : ""}`} src={src} alt={alt} draggable={false}
        style={{ transform: `translate3d(${view.x}px, ${view.y}px, 0) scale(${view.s})` }} />
    </div>,
    document.body
  );
}

/* The little eye button that sits on a photo. Appears on hover (always visible on touch screens). */
export function EyeButton({ onClick, className = "", label }) {
  const { t } = useLang();
  const text = label ?? (t("p.viewImage") === "p.viewImage" ? "View photo" : t("p.viewImage"));
  return (
    <button type="button" className={`nt-eye ${className}`} aria-label={text} title={text}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick?.(e); }}>
      <Icon name="eye" size={18} strokeWidth={2.1} />
    </button>
  );
}

/* Convenience hook: const [viewer, open] = useImageViewer(src, alt); render {viewer} anywhere. */
export function useImageViewer(src, alt) {
  const [open, setOpen] = useState(false);
  const viewer = open && src ? <ImageViewer src={src} alt={alt} onClose={() => setOpen(false)} /> : null;
  return [viewer, () => setOpen(true)];
}
