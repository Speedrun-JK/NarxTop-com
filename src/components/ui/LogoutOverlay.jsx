import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";

import { LogoMark } from "../brand/Logo";
import { farewell } from "../../lib/farewell";
import { useLang } from "../../context/LanguageContext";
import { useMotionPrefs } from "../../context/MotionPrefsContext";

/* Full-screen goodbye shown while signing out: blurred backdrop, avatar, progress bar, drifting dots. */
export default function LogoutOverlay() {
  const { t } = useLang();
  const { disabled } = useMotionPrefs();
  const f = useSyncExternalStore(farewell.subscribe, farewell.get, () => null);
  return createPortal((
    <AnimatePresence>
      {f && (
        <motion.div className="nt-bye" role="status" aria-live="polite" initial={disabled ? false : { opacity: 0, clipPath: "circle(0% at 50% 50%)" }} animate={{ opacity: 1, clipPath: "circle(150% at 50% 50%)" }} exit={{ opacity: 0, clipPath: disabled ? "circle(150% at 50% 50%)" : "circle(0% at 50% 50%)", transition: { duration: disabled ? 0 : 0.6, delay: 0.1, ease: [0.65, 0, 0.35, 1] } }} transition={{ duration: disabled ? 0 : 0.3 }}>
          <div className="nt-bye-dots" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ "--i": i }} />)}</div>
          <motion.div className="nt-bye-card" initial={disabled ? false : { opacity: 0, y: 30, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={disabled ? { opacity: 0 } : { opacity: 0, y: -24, scale: 0.96 }} transition={disabled ? { duration: 0 } : { type: "spring", stiffness: 240, damping: 22 }}>
            <div className="nt-bye-ring">
              <div className="nt-bye-rays" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ "--r": `${i * 30}deg` }} />)}</div>
              {f.avatar
                ? <img src={f.avatar} alt="" referrerPolicy="no-referrer" />
                : <span className="nt-bye-initial">{(f.name || "?").slice(0, 1).toUpperCase()}</span>}
              <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="46" /></svg>
              <span className="nt-bye-hand" aria-hidden="true">👋</span>
            </div>
            <h2>{t("auth.bye", { name: f.name })}</h2>
            <p>{t("auth.byeSub")}</p>
            <div className="nt-bye-bar" aria-hidden="true"><i /></div>
            <span className="nt-bye-mark" aria-hidden="true"><LogoMark size={28} /></span>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  ), document.body);
}
