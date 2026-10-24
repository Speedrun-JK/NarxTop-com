import { useLang } from "../../context/LanguageContext";
import { SITE_ACCENTS, useTheme } from "../../context/ThemeContext";
import { useUserData } from "../../context/UserDataContext";
import { useMotionPrefs } from "../../context/MotionPrefsContext";
import { useEffect, useState } from "react";
import Icon from "../../components/ui/Icon";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import useLogout from "../../hooks/useLogout";

const LANG_NAMES = { uz: "O‘zbekcha", ru: "Русский", en: "English" };

const Toggle = ({ checked, onChange, label, sub, disabled }) => (
  <label className={`nt-toggle ${disabled ? "is-disabled" : ""}`}>
    <span><b>{label}</b>{sub && <small>{sub}</small>}</span>
    <input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
    <i aria-hidden="true" />
  </label>
);

export default function Preferences() {
  const { t, lang, setLang, languages } = useLang();
  const { preference, theme, setPreference, accent, setAccent } = useTheme();
  const { prefs, setPref, sync } = useUserData();
  const { mode, setMode } = useMotionPrefs();
  const signOut = useLogout();
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  useEffect(() => {
    if (["system", "on", "off"].includes(prefs.animations) && prefs.animations !== mode) setMode(prefs.animations);
  }, [prefs.animations, mode, setMode]);
  return (
    <div className="nt-panel">
      <h2>{t("acc.prefTitle")}</h2>
      <p className="nt-sub">{t("acc.prefSub")}</p>

      <h3 className="nt-h3">{t("acc.language")}</h3>
      <div className="nt-seg" role="radiogroup">{languages.map((l) => <button key={l} role="radio" aria-checked={lang === l} className={lang === l ? "is-on" : ""} onClick={() => setLang(l)}>{LANG_NAMES[l] ?? l.toUpperCase()}</button>)}</div>

      <h3 className="nt-h3">{t("acc.theme")}</h3>
      <div className="nt-seg nt-theme-seg" role="radiogroup" aria-label={t("acc.theme")}>
        {[["system", "monitor"], ["light", "sun"], ["dark", "moon"]].map(([m, icon]) => (
          <button key={m} type="button" role="radio" aria-checked={preference === m} className={preference === m ? "is-on" : ""} onClick={() => setPreference(m)}>
            <Icon name={icon} size={15} />{t(`acc.${m}`)}
          </button>
        ))}
      </div>
      {preference === "system" && <p className="nt-note nt-theme-note">{t("acc.systemNote", { mode: t(`acc.${theme}`) })}</p>}

      <h3 className="nt-h3">{t("acc.accentTitle")}</h3>
      <p className="nt-sub">{t("acc.accentSub")}</p>
      <div className="nt-accent-options" role="radiogroup" aria-label={t("acc.accentTitle")}>
        {SITE_ACCENTS.map((option) => <button key={option.id} type="button" role="radio" aria-label={t(option.label)} aria-checked={accent === option.id} className="nt-accent-option" onClick={() => { setAccent(option.id); setPref({ siteAccent: option.id }); }}>
          <i style={{ background: option.swatch }} aria-hidden="true" />{accent === option.id && <Icon name="check" size={15} aria-hidden="true" />}
        </button>)}
      </div>

      <h3 className="nt-h3">{t("motion.title")}</h3>
      <p className="nt-sub">{t("motion.help")}</p>
      <div className="nt-seg" role="radiogroup" aria-label={t("motion.title")}>
        {["system", "on", "off"].map((value) => <button key={value} type="button" role="radio" aria-checked={mode === value} className={mode === value ? "is-on" : ""} onClick={() => { setMode(value); setPref({ animations: value }); }}>{t(`motion.${value}`)}</button>)}
      </div>

      <h3 className="nt-h3">{t("acc.notifications")}</h3>
      <Toggle checked={prefs.notifyDrops} onChange={(v) => setPref({ notifyDrops: v })} label={t("acc.notifyDrops")} sub={t("acc.notifyDropsSub")} />
      <Toggle checked={false} disabled onChange={() => {}} label={t("acc.notifyEmail")} sub={t("acc.notifyEmailSub")} />

      <p className="nt-note">{t(`acc.sync.${sync}`)}</p>

      <div className="nt-signout">
        <span className="nt-signout-ico" aria-hidden="true"><Icon name="logout" size={20} /></span>
        <div><b>{t("nav.logout")}</b><small>{t("auth.byeSub")}</small></div>
        <button type="button" className="nt-signout-btn" onClick={() => setLogoutConfirm(true)}><Icon name="logout" size={16} />{t("nav.logout")}</button>
      </div>
      <ConfirmDialog open={logoutConfirm} title={t("acc.logoutConfirmTitle")} text={t("acc.logoutConfirmText")} confirmLabel={t("nav.logout")} danger onCancel={() => setLogoutConfirm(false)} onConfirm={() => { setLogoutConfirm(false); signOut(); }} />
    </div>
  );
}
