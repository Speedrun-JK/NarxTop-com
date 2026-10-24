import { useId, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLang } from "../../context/LanguageContext";
import Icon from "../ui/Icon";

/* Eye = "password is hidden, click to show"; crossed-out eye = "password is visible, click to hide". Both are complete glyphs. */
function EyeIcon({ off }) {
  return (
    <svg className="nt-eye-svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M2.06 12.35a1 1 0 0 1 0-.7C3.42 8.1 7.36 5 12 5s8.58 3.1 9.94 6.65a1 1 0 0 1 0 .7C20.58 15.9 16.64 19 12 19s-8.58-3.1-9.94-6.65Z" />
      <circle cx="12" cy="12" r="3" />
      <path className="nt-eye-slash" d="M3.5 3.5l17 17" pathLength="1" style={{ strokeDasharray: 1, strokeDashoffset: off ? 0 : 1 }} />
    </svg>
  );
}

/* Animated input: status icon, inline error, optional show/hide for passwords. */
export default function Field({ label, error, valid, type = "text", password = false, prefix, hint, children, ...props }) {
  const { t } = useLang();
  const id = useId();
  const [show, setShow] = useState(false);
  const state = error ? "is-error" : valid ? "is-valid" : "";
  return (
    <div className={`nt-field ${state}`}>
      <label htmlFor={id}>{label}</label>
      <div className={`nt-input ${prefix ? "has-prefix" : ""}`}>
        {prefix && <span className="nt-input-prefix" aria-hidden="true">{prefix}</span>}
        <input id={id} type={password ? (show ? "text" : "password") : type} aria-invalid={Boolean(error)} aria-describedby={`${id}-m`} {...props} />
        {password && (
          <button type="button" className={`nt-password-eye ${show ? "is-shown" : ""}`} onMouseDown={(e) => e.preventDefault()} onClick={() => setShow((v) => !v)}
            aria-label={show ? t("acc.hide") : t("acc.show")} title={show ? t("acc.hide") : t("acc.show")} aria-pressed={show}>
            <EyeIcon off={show} />
          </button>
        )}
        <AnimatePresence>{valid && !error && <motion.span className="nt-ok" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Icon name="check" size={16} strokeWidth={2.6} /></motion.span>}</AnimatePresence>
      </div>
      <div id={`${id}-m`} className="nt-msg">
        <AnimatePresence mode="wait" initial={false}>
          {error ? <motion.span key="e" className="is-err" initial={{ opacity: 0, y: -4, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, height: 0 }} role="alert">{error}</motion.span>
            : hint ? <motion.span key="h" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{hint}</motion.span> : null}
        </AnimatePresence>
      </div>
      {children}
    </div>
  );
}

export function StrengthMeter({ strength }) {
  const { t } = useLang();
  const { score, rules } = strength;
  return (
    <div className="nt-strength" aria-live="polite">
      <div className="nt-bars">{[1, 2, 3, 4].map((i) => <motion.i key={i} className={score >= i ? `on s${score}` : ""} layout animate={{ scaleY: score >= i ? 1 : 0.6 }} />)}</div>
      <span>{t(`acc.strength${score}`)}</span>
      <ul>
        <li className={rules.len ? "ok" : ""}><Icon name={rules.len ? "check" : "minus"} size={13} strokeWidth={2.4} /> {t("acc.rule8")}</li>
        <li className={rules.case ? "ok" : ""}><Icon name={rules.case ? "check" : "minus"} size={13} strokeWidth={2.4} /> {t("acc.ruleCase")}</li>
        <li className={rules.num ? "ok" : ""}><Icon name={rules.num ? "check" : "minus"} size={13} strokeWidth={2.4} /> {t("acc.ruleNum")}</li>
      </ul>
    </div>
  );
}
