import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import Icon from "./Icon";
import { useAuth } from "../../context/AuthContext";
import { useLang } from "../../context/LanguageContext";
import { usePlus } from "../../context/PlusContext";

const QUIET_PATHS = ["/admin", "/plus", "/premium", "/smart-buy", "/auth", "/auth/confirm", "/reset-password"];
const WEEK = 7 * 86400000;
const DELAY = 24000; // let people look around before offering anything

/* Two small Plus nudges: a once-a-week invitation for signed-in non-members, and the toast that explains why
 * an item was not added when the free basket limit is reached. */
export default function PlusPrompt() {
  const { t } = useLang();
  const { user } = useAuth();
  const { isPlus, status, limitNotice, dismissLimitNotice } = usePlus();
  const { pathname } = useLocation();
  const [promo, setPromo] = useState(false);
  const quiet = QUIET_PATHS.includes(pathname.replace(/\/+$/, "") || "/");

  useEffect(() => {
    if (!user || isPlus || status !== "ok" || quiet) return undefined; // only once we know they are not members
    const key = `narxtop_plus_prompt_seen_${user.id}`;
    try { if (Date.now() - Number(localStorage.getItem(key) || 0) < WEEK) return undefined; } catch { /* no storage: still show once per visit */ }
    const timer = window.setTimeout(() => {
      setPromo(true);
      try { localStorage.setItem(key, String(Date.now())); } catch { /* ignore */ }
    }, DELAY);
    return () => window.clearTimeout(timer);
  }, [user, isPlus, status, quiet]);

  useEffect(() => {
    if (!promo) return undefined;
    const onKey = (e) => e.key === "Escape" && setPromo(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [promo]);

  // the limit toast closes by itself
  useEffect(() => {
    if (!limitNotice) return undefined;
    const timer = window.setTimeout(dismissLimitNotice, 9000);
    return () => window.clearTimeout(timer);
  }, [limitNotice, dismissLimitNotice]);

  return (
    <>
      <AnimatePresence>
        {promo && !quiet && (
          <motion.div className="nt-modal-bg plus-promo-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && setPromo(false)}>
            <motion.section className="plus-promo nt-glass" role="dialog" aria-modal="true" aria-labelledby="plus-promo-title" initial={{ opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10 }} transition={{ type: "spring", stiffness: 320, damping: 30 }}>
              <button type="button" className="nt-icon-btn plus-promo-x" onClick={() => setPromo(false)} aria-label={t("nav.close")}><Icon name="x" size={18} /></button>
              <span className="nt-eyebrow"><Icon name="sparkles" size={14} />NARXTOP PREMIUM</span>
              <h2 id="plus-promo-title">{t("plus.promo.title")}</h2>
              <p>{t("plus.promo.body")}</p>
              <Link to="/premium" className="nt-btn nt-btn-primary" onClick={() => setPromo(false)}>{t("plus.promo.cta")}<Icon name="sparkles" size={16} /></Link>
              <button type="button" className="plus-promo-later" onClick={() => setPromo(false)}>{t("plus.promo.later")}</button>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {limitNotice && (
          <motion.div className="plus-limit nt-glass" role="status" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}>
            <Icon name="alert" size={18} />
            <span>{t("plus.limit")}</span>
            <Link to="/premium" onClick={dismissLimitNotice}>{t("plus.limitOpen")}<Icon name="sparkles" size={14} /></Link>
            <button type="button" onClick={dismissLimitNotice} aria-label={t("nav.close")}><Icon name="x" size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
