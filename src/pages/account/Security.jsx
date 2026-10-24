import { useCallback, useEffect, useRef, useState } from "react";
import useLogout from "../../hooks/useLogout";
import Field, { StrengthMeter } from "../../components/auth/Field";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Icon from "../../components/ui/Icon";
import { useAuth } from "../../context/AuthContext";
import { formatDateTime } from "../../lib/dates";
import { useLang } from "../../context/LanguageContext";
import { authErrorKey, passwordStrength, withTimeout } from "../../lib/authUtils";
import { apiFetch } from "../../lib/api";
import { toast } from "../../lib/toast";

export default function Security() {
  const { t, lang } = useLang();
  const { user, updatePassword, verifyPassword, sendPasswordRecovery, verifyResetCode, resetPassword, refreshSession, signOutOthers, getSessions, terminateSession } = useAuth();
  const logout = useLogout();
  const [currentPw, setCurrentPw] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [pwStep, setPwStep] = useState("current");
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState("");
  const [touched, setTouched] = useState(false);
  const [dialog, setDialog] = useState(false), [logoutDialog, setLogoutDialog] = useState(false), [endingSession, setEndingSession] = useState(null), [busy, setBusy] = useState(false);
  const [sessions, setSessions] = useState(null), [sessionsError, setSessionsError] = useState("");
  const [locationBusy, setLocationBusy] = useState(false), [locationError, setLocationError] = useState("");
  const locationAttempted = useRef(false), locationBusyRef = useRef(false), lock = useRef(false);
  const strength = passwordStrength(pw);
  const providers = user?.app_metadata?.providers ?? [user?.app_metadata?.provider ?? "email"];
  const hasPassword = providers.includes("email");
  const hasGoogle = providers.includes("google");

  const saveCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) { setLocationError(t("acc.locationUnavailable")); return; }
    if (locationBusyRef.current) return;
    locationBusyRef.current = true; setLocationBusy(true); setLocationError("");
    navigator.geolocation.getCurrentPosition(async (position) => {
      try {
        const response = await apiFetch("/api/auth/sessions/location", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latitude: position.coords.latitude, longitude: position.coords.longitude }) });
        const result = await response.json().catch(() => null);
        if (!response.ok || !result?.success) throw new Error(result?.message || t("acc.actionError"));
        setSessions((items) => (items ?? []).map((item) => item.current ? { ...item, location: result.location } : item));
      } catch (error) { setLocationError(error.message || t("acc.actionError")); }
      finally { locationBusyRef.current = false; setLocationBusy(false); }
    }, (error) => {
      locationBusyRef.current = false; setLocationBusy(false);
      setLocationError(error.code === 1 ? t("acc.locationDenied") : t("acc.locationUnavailable"));
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  }, [t]);

  const loadSessions = useCallback(async (askForLocation = false) => {
    setSessionsError("");
    try {
      const result = await getSessions();
      const items = result.sessions ?? [];
      setSessions(items);
      const current = items.find((item) => item.current);
      if (askForLocation && current && !current.location && !locationAttempted.current) {
        locationAttempted.current = true;
        saveCurrentLocation();
      }
    } catch (error) { setSessionsError(error.message || t("acc.actionError")); }
  }, [getSessions, saveCurrentLocation, t]);

  useEffect(() => { loadSessions(true); }, [loadSessions, user?.id]);
  useEffect(() => {
    if (!pwOpen) return undefined;
    const close = (event) => { if (event.key === "Escape" && !pwBusy) setPwOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [pwOpen, pwBusy]);

  const openPassword = () => {
    setCurrentPw(""); setPw(""); setConfirm(""); setCode(""); setPwError(""); setTouched(false); setRecoveryMode(false);
    setPwStep(hasPassword ? "current" : "new"); setPwOpen(true);
  };

  const verifyOldPassword = async (event) => {
    event.preventDefault(); setPwError("");
    if (!currentPw || lock.current) return;
    lock.current = true; setPwBusy(true);
    try { await withTimeout(verifyPassword(currentPw)); setPwStep("new"); }
    catch (error) { setPwError(t(authErrorKey(error))); }
    finally { lock.current = false; setPwBusy(false); }
  };

  const requestResetCode = async () => {
    setPwError(""); setPwBusy(true);
    try { await withTimeout(sendPasswordRecovery(user.email)); setRecoveryMode(true); setPwStep("code"); }
    catch (error) { setPwError(t(authErrorKey(error))); }
    finally { setPwBusy(false); }
  };

  const verifyCode = async (event) => {
    event.preventDefault(); setPwError("");
    if (!/^\d{6}$/.test(code) || lock.current) return;
    lock.current = true; setPwBusy(true);
    try { await withTimeout(verifyResetCode(user.email, code)); setPwStep("new"); }
    catch (error) { setPwError(t(authErrorKey(error))); }
    finally { lock.current = false; setPwBusy(false); }
  };

  const change = async (event) => {
    event.preventDefault(); setTouched(true);
    if (!strength.ok || pw !== confirm || lock.current) return;
    lock.current = true; setPwBusy(true); setPwError("");
    try {
      if (recoveryMode) {
        await withTimeout(resetPassword({ email: user.email, code, password: pw }));
        await refreshSession();
        setPwOpen(false); toast(t("acc.pwResetSignedOut"));
      } else {
        await withTimeout(updatePassword(pw, currentPw));
        setPwOpen(false); toast(t("acc.pwChanged"));
      }
    } catch (error) { setPwError(t(authErrorKey(error))); }
    finally { lock.current = false; setPwBusy(false); }
  };

  const revokeOthers = async () => {
    setBusy(true);
    try { await signOutOthers(); await loadSessions(); toast(t("acc.othersDone")); }
    catch { toast(t("acc.actionError")); }
    finally { setBusy(false); setDialog(false); }
  };

  const endSession = async () => {
    if (!endingSession) return;
    const current = endingSession.current;
    setBusy(true);
    try {
      await terminateSession(endingSession.id);
      if (current) { setEndingSession(null); await logout(); }
      else { setSessions((items) => (items ?? []).filter((item) => item.id !== endingSession.id)); toast(t("acc.sessionEnded")); }
      setEndingSession(null);
    } catch { toast(t("acc.actionError")); }
    finally { setBusy(false); }
  };

  return (
    <div className="nt-panel">
      <h2>{t("acc.secTitle")}</h2>
      <p className="nt-sub">{t("acc.secSub")}</p>
      <div className="nt-security-password">
        <div><b>{t("acc.passwordTitle")}</b><small>{t("acc.passwordSub")}</small></div>
        <button type="button" className="nt-btn nt-btn-primary" onClick={openPassword}><Icon name="lock" size={16} />{t("acc.changePw")}</button>
      </div>

      <h3 className="nt-h3">{t("acc.connected")}</h3>
      <ul className="nt-list">
        <li><span className="nt-method"><Icon name="mail" size={16} /> {t("acc.method.email")}</span><b className={hasPassword ? "is-open" : ""}>{hasPassword ? t("acc.connectedOn") : t("acc.notSet")}</b></li>
        <li><span className="nt-method"><b className="nt-g" aria-hidden="true">G</b> {t("acc.method.google")}</span><b className={hasGoogle ? "is-open" : ""}>{hasGoogle ? t("acc.connectedOn") : t("acc.notSet")}</b></li>
      </ul>
      {!hasGoogle && <p className="nt-sub">Google ulanishi Google orqali kirganingizda shu email bilan avtomatik bog‘lanadi.</p>}

      <h3 className="nt-h3">{t("acc.sessionTitle")}</h3>
      <p className="nt-sub">{t("acc.sessionSub")}</p>
      <p className="nt-sub nt-location-note">{t("acc.locationNote")}</p>
      <div className="nt-device-list" aria-live="polite">
        {sessions === null && !sessionsError && <p className="nt-sub">{t("auth.wait")}</p>}
        {sessionsError && <p className="nt-alert is-err" role="alert">{sessionsError}<button type="button" className="nt-link" onClick={() => loadSessions(true)}>{t("auth.resend")}</button></p>}
        {locationError && <p className="nt-sub" role="status">{locationError} <button type="button" className="nt-link" onClick={saveCurrentLocation}>{t("acc.locationRetry")}</button></p>}
        {sessions?.map((item) => (
          <article className="nt-device" key={item.id}>
            <span className="nt-device-icon"><Icon name="laptop" size={19} /></span>
            <div className="nt-device-info"><b>{item.device}</b><small><Icon name="pin" size={13} />{item.location || t("acc.sessionLocationUnknown")}</small><small>{t("acc.sessionLastSeen")}: {formatDateTime(item.lastSeenAt, lang)}</small></div>
            <div className="nt-device-actions">{item.current && <>{locationBusy && <em>{t("acc.locationLoading")}</em>}<em>{t("acc.thisDevice")}</em></>}<button type="button" className="nt-btn nt-btn-ghost" onClick={() => setEndingSession(item)}>{t("acc.sessionEnd")}</button></div>
          </article>
        ))}
        {sessions?.length === 0 && <p className="nt-sub">{t("acc.sessionEmpty")}</p>}
      </div>
      <div className="nt-row">
        <button type="button" className="nt-btn nt-btn-ghost" onClick={() => setDialog(true)}>{t("acc.signOutOthers")}</button>
        <button type="button" className="nt-btn nt-btn-danger" onClick={() => setLogoutDialog(true)}>{t("nav.logout")}</button>
      </div>

      {pwOpen && <div className="nt-security-modal-bg" onMouseDown={(event) => event.target === event.currentTarget && !pwBusy && setPwOpen(false)}>
        <section className="nt-security-modal" role="dialog" aria-modal="true" aria-labelledby="nt-password-title">
          <button type="button" className="nt-security-close" onClick={() => setPwOpen(false)} disabled={pwBusy} aria-label={t("acc.close")}><Icon name="x" size={18} /></button>
          <span className="nt-security-modal-icon"><Icon name="lock" size={23} /></span>
          <h3 id="nt-password-title">{t("acc.changePw")}</h3>
          <p className="nt-sub">{pwStep === "current" ? t("acc.passwordVerifyPrompt") : pwStep === "code" ? t("acc.passwordCodePrompt", { email: user?.email }) : t("acc.passwordNewPrompt")}</p>
          {pwStep === "current" && <form onSubmit={verifyOldPassword} noValidate>
            <Field label={t("auth.password")} password value={currentPw} onChange={(event) => setCurrentPw(event.target.value)} autoComplete="current-password" />
            {pwError && <p className="nt-alert is-err" role="alert">{pwError}</p>}
            <button type="submit" className="nt-btn nt-btn-primary" disabled={pwBusy || !currentPw}>{pwBusy ? <span className="nt-spin" /> : t("acc.passwordVerify")}</button>
            <button type="button" className="nt-link nt-forgot-password" onClick={requestResetCode} disabled={pwBusy}>{t("auth.forgot")}</button>
          </form>}
          {pwStep === "code" && <form onSubmit={verifyCode} noValidate>
            <Field label={t("acc.passwordCode")} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" />
            {pwError && <p className="nt-alert is-err" role="alert">{pwError}</p>}
            <button type="submit" className="nt-btn nt-btn-primary" disabled={pwBusy || code.length !== 6}>{pwBusy ? <span className="nt-spin" /> : t("acc.passwordVerifyCode")}</button>
            <button type="button" className="nt-link nt-forgot-password" onClick={requestResetCode} disabled={pwBusy}>{t("acc.passwordResendCode")}</button>
          </form>}
          {pwStep === "new" && <form onSubmit={change} noValidate>
            <Field label={t("acc.newPw")} password value={pw} onChange={(event) => setPw(event.target.value)} onBlur={() => setTouched(true)} error={touched && !strength.ok ? t("auth.err.pwRules") : ""} autoComplete="new-password" />
            {pw && <StrengthMeter strength={strength} />}
            <Field label={t("acc.repeatPw")} password value={confirm} onChange={(event) => setConfirm(event.target.value)} error={touched && confirm !== pw ? t("acc.errMatch") : ""} valid={confirm && confirm === pw} autoComplete="new-password" />
            {pwError && <p className="nt-alert is-err" role="alert">{pwError}</p>}
            <button type="submit" className="nt-btn nt-btn-primary" disabled={pwBusy || !strength.ok || pw !== confirm}>{pwBusy ? <span className="nt-spin" /> : t("acc.changePw")}</button>
          </form>}
        </section>
      </div>}

      <ConfirmDialog open={dialog} busy={busy} title={t("acc.signOutOthers")} text={t("acc.signOutOthersText")} confirmLabel={t("p.confirm")} danger onCancel={() => setDialog(false)} onConfirm={revokeOthers} />
      <ConfirmDialog open={logoutDialog} busy={busy} title={t("acc.logoutConfirmTitle")} text={t("acc.logoutConfirmText")} confirmLabel={t("nav.logout")} danger onCancel={() => setLogoutDialog(false)} onConfirm={logout} />
      <ConfirmDialog open={Boolean(endingSession)} busy={busy} title={t("acc.sessionEndTitle")} text={endingSession ? `${endingSession.device} · ${endingSession.location || t("acc.sessionLocationUnknown")}` : ""} confirmLabel={t("acc.sessionEnd")} danger onCancel={() => setEndingSession(null)} onConfirm={endSession} />
    </div>
  );
}
