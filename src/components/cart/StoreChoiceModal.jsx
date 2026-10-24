import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";

import Icon from "../ui/Icon";
import StoreMark from "../products/StoreMark";
import { useLang } from "../../context/LanguageContext";
import { formatPrice } from "../../lib/constants";

/* Checkout step 1: "Where will you buy?" Shown as a dialog over the cart when the shopper starts checkout.
 * Every store is a selectable card with its basket total, how much of the basket it covers and how much more it costs than
 * the cheapest complete store. Confirming moves the order on to the review step; closing returns to the cart. */
export default function StoreChoiceModal({ open, options, selected, onSelect, onConfirm, onClose, savings = 0, busy = false }) {
  const { t } = useLang();
  const dialog = useRef(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector('input[type="radio"]:checked, input[type="radio"]')?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); closeRef.current(); return; }
      if (e.key !== "Tab" || !dialog.current) return;
      const f = [...dialog.current.querySelectorAll('button:not([disabled]), input:not([disabled])')].filter((el) => el.getClientRects().length);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = overflow; document.removeEventListener("keydown", onKey); if (opener?.isConnected) opener.focus?.({ preventScroll: true }); };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="nt-modal-bg sc-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <motion.div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="sc-title" className="sc nt-glass" initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12 }} transition={{ type: "spring", stiffness: 340, damping: 32 }}>
            <button type="button" className="nt-icon-btn sc-x" onClick={onClose} aria-label={t("nav.close")}><Icon name="x" size={18} /></button>
            <header className="sc-head">
              <span className="sc-ico" aria-hidden="true"><Icon name="store" size={22} /></span>
              <div>
                <h2 id="sc-title">{t("cart.chooseTitle")}</h2>
                <p>{t("cart.chooseSub")}</p>
              </div>
            </header>

            <div className="sc-list" role="radiogroup" aria-labelledby="sc-title">
              {options.map((o, i) => {
                const on = selected === o.key;
                return (
                  <motion.label key={o.key} className={`sc-opt ${on ? "is-on" : ""} ${o.best ? "is-best" : ""} ${o.partial ? "is-partial" : ""}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 + i * 0.05, duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
                    <input type="radio" name="sc-store" value={o.key} checked={on} onChange={() => onSelect(o.key)} aria-label={`${o.key}: ${formatPrice(o.total)}`} />
                    <span className="sc-mark" aria-hidden="true"><StoreMark chain={o.key} size={34} /></span>
                    <span className="sc-txt">
                      <b>{o.key}{o.best && <em className="sc-badge"><Icon name="check" size={11} strokeWidth={3} />{t("p.badge.cheapest")}</em>}</b>
                      <small className={o.partial ? "is-warn" : ""}>{o.coverage}</small>
                    </span>
                    <span className="sc-price"><strong>{formatPrice(o.total)}</strong>{o.delta > 0 && <small>+{formatPrice(o.delta)}</small>}</span>
                    <span className="sc-tick" aria-hidden="true">{on && <Icon name="check" size={14} strokeWidth={3} />}</span>
                  </motion.label>
                );
              })}
            </div>

            {savings > 0 && <p className="sc-save"><Icon name="trendDown" size={17} /><span>{t("p.cart.saveVsWorst")}</span><b>{formatPrice(savings)}</b></p>}

            <div className="sc-actions">
              <button type="button" className="nt-btn nt-btn-ghost" onClick={onClose}>{t("cart.backEdit")}</button>
              <button type="button" className="nt-btn nt-btn-primary" onClick={onConfirm} disabled={!selected || busy}><Icon name="check" size={16} strokeWidth={2.6} />{t("cart.confirmStore")}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
