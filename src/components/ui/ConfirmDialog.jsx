import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "./Icon";
import { useLang } from "../../context/LanguageContext";

/* Accessible confirmation modal for sensitive / destructive actions. */
export default function ConfirmDialog({ open, title, text, confirmLabel, danger = false, busy = false, onConfirm, onCancel }) {
  const { t } = useLang();
  const btn = useRef(null);
  const cancel = useRef(onCancel);
  const isBusy = useRef(busy);
  useEffect(() => { cancel.current = onCancel; isBusy.current = busy; }, [onCancel, busy]);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement;
    btn.current?.focus(); // focus once per opening, not on every parent render
    const esc = (e) => e.key === "Escape" && !isBusy.current && cancel.current();
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("keydown", esc); opener?.focus?.(); };
  }, [open]);

  return createPortal((
    <AnimatePresence>
      {open && (
        <motion.div className="nt-modal-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
          <motion.div role="alertdialog" aria-modal="true" aria-labelledby="nt-cd-title" className={`nt-modal ${danger ? "is-danger" : ""}`} initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: "spring", stiffness: 340, damping: 28 }}>
            <span className={`nt-modal-ico ${danger ? "is-danger" : ""}`} aria-hidden="true"><Icon name={danger ? "trash" : "info"} size={24} /></span>
            <h3 id="nt-cd-title">{title}</h3>
            {text && <p>{text}</p>}
            <div className="nt-modal-actions">
              <button type="button" className="nt-btn nt-btn-ghost" onClick={onCancel} disabled={busy}>{t("p.cancel")}</button>
              <button ref={btn} type="button" className={`nt-btn ${danger ? "nt-btn-danger" : "nt-btn-primary"}`} onClick={onConfirm} disabled={busy}>{busy ? "…" : confirmLabel}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  ), document.body);
}
