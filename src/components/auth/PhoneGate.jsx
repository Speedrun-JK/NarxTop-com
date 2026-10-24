import { useEffect, useId, useRef, useState } from "react";
import { motion } from "framer-motion";

import PhoneField from "./PhoneField";
import Logo from "../brand/Logo";
import Icon from "../ui/Icon";
import { useAuth } from "../../context/AuthContext";
import { useLang } from "../../context/LanguageContext";
import useLogout from "../../hooks/useLogout";
import { apiFetch } from "../../lib/api";
import { hasValidPhone, normalizePhone } from "../../lib/phone";

/* True for a signed-in user whose account has no usable phone number yet. */
export const needsPhone = (user) => Boolean(user) && !hasValidPhone(user.user_metadata?.phone);

/* Full-screen, non-dismissable pop-up. While it is shown the rest of the website is not rendered at all, so nothing
 * can be used until the number is saved (PUT /api/auth/phone writes it to the MongoDB `users` document). */
export default function PhoneGate() {
  const { t } = useLang();
  const { refreshSession } = useAuth();
  const logout = useLogout();
  const uid = useId();
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState("");
  const cardRef = useRef(null);

  const valid = hasValidPhone(phone);
  const showInvalid = touched && !valid;

  /* nothing behind the pop-up may scroll or take focus */
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    setTouched(true);
    if (!valid || busy) return;
    setBusy(true); setServerError("");
    try {
      const response = await apiFetch("/api/auth/phone", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalizePhone(phone) }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        setServerError(result?.code === "PHONE_INVALID" ? t("phoneGate.invalid") : t("phoneGate.error"));
        return;
      }
      /* the session now carries the phone, so App stops rendering this gate */
      await refreshSession();
    } catch {
      setServerError(t("phoneGate.error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="nt-pg" role="presentation">
      <motion.form ref={cardRef} className="nt-pg-card" role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`} aria-describedby={`${uid}-d`}
        onSubmit={submit} noValidate
        initial={{ opacity: 0, y: 18, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 260, damping: 26 }}>
        <div className="nt-pg-brand"><Logo bare size={40} /></div>
        <span className="nt-pg-ico" aria-hidden="true"><Icon name="phone" size={26} /></span>
        <h1 id={`${uid}-t`} className="nt-pg-title">{t("phoneGate.title")}</h1>
        <p id={`${uid}-d`} className="nt-pg-text">{t("phoneGate.text")}</p>

        <PhoneField label={t("phoneGate.label")} value={phone} onChange={(v) => { setPhone(v); setServerError(""); }} onBlur={() => setTouched(true)}
          error={showInvalid ? t("phoneGate.invalid") : ""} valid={valid} autoFocus
          hint={({ n, c }) => t("phoneGate.hint", { n, c })} />

        {serverError && <p className="nt-pg-error" role="alert">{serverError}</p>}

        <button type="submit" className="nt-btn nt-btn-primary nt-pg-save" disabled={busy || !valid}>
          {busy ? t("phoneGate.saving") : t("phoneGate.save")}
        </button>
        <button type="button" className="nt-pg-out" onClick={logout} disabled={busy}>
          <Icon name="logout" size={15} />{t("phoneGate.logout")}
        </button>
      </motion.form>
    </div>
  );
}
