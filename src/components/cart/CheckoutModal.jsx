import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

import Icon from "../ui/Icon";
import { useLang } from "../../context/LanguageContext";

const STEP_ORDER = ["review", "route", "receipt", "confirmed"];

/* Checkout popup. Review of the items, the route, the receipt photo and the final confirmation all happen
 * in this dialog (instead of squeezing into the cart sidebar). Cart.jsx owns the state and passes the
 * current step's content as children; this component only provides the dialog shell: backdrop, focus
 * trap, Escape / backdrop close, scroll lock and the step indicator. */
export default function CheckoutModal({ open, step, icon = "check", title, onClose, children }) {
  const { t } = useLang();
  const dialog = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== "Tab" || !dialog.current) return;
      const f = [...dialog.current.querySelectorAll('button:not([disabled]), a[href], input:not([disabled])')].filter((el) => el.getClientRects().length);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", onKey); if (opener?.isConnected) opener.focus?.({ preventScroll: true }); };
  }, [open]);

  useEffect(() => { if (open) dialog.current?.focus({ preventScroll: true }); }, [open, step]);

  const at = STEP_ORDER.indexOf(step);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="nt-modal-bg sc-bg co-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div ref={dialog} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="co-title" className="co" initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} transition={{ type: "spring", stiffness: 340, damping: 32 }}>
            <button type="button" className="nt-icon-btn co-x" onClick={onClose} aria-label={t("nav.close")}><Icon name="x" size={18} /></button>
            <ol className="co-steps" aria-hidden="true">
              {STEP_ORDER.map((s, i) => <li key={s} className={i < at ? "is-done" : i === at ? "is-now" : ""} />)}
            </ol>
            <header className="co-head">
              <span className="co-ico" aria-hidden="true"><Icon name={icon} size={22} /></span>
              <h2 id="co-title">{title}</h2>
            </header>
            <div className="co-body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
