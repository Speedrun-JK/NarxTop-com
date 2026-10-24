import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import PageShell from "../components/layout/PageShell";
import Icon from "../components/ui/Icon";
import { LogoMark, PlusCrown } from "../components/brand/Logo";
import useSpotlight from "../hooks/useSpotlight";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { useErrorText, usePlus } from "../context/PlusContext";
import Mesh from "../components/ui/Mesh";
import useParallax from "../hooks/useParallax";
import { toast } from "../lib/toast";
import { FREE_BASKET_LIMIT } from "../../shared/core/plus.js";
import PlusMember from "./plus/PlusMember";

const PERKS = [["zap", "basket"], ["sparkles", "alerts"], ["gift", "gift"], ["badgeCheck", "support"]];

export function PlusContent({ embedded = false } = {}) {
  const { t } = useLang();
  const { isAuthenticated } = useAuth();
  const { plan, subscription, isPlus, trialUsed, paymentsReady, loading, status, refresh, startTrial, beginCheckout } = usePlus();
  const errText = useErrorText();
  const spot = useSpotlight();
  const heroRef = useParallax();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const renderPage = (content) => embedded ? <div className="plus-embedded">{content}</div> : <PageShell>{content}</PageShell>;

  const money = (n) => `${Number(n).toLocaleString("uz-UZ")} UZS`;
  const run = async (action, onOk) => {
    setBusy(true); setMessage("");
    const r = await action();
    setBusy(false);
    if (r.ok) onOk?.(r); else setMessage(errText(r.code));
  };
  const claim = () => run(startTrial, () => toast(t("plus.started"), { confetti: true }));
  const pay = () => run(beginCheckout);

  /* Active members get their own page. While the first lookup is still running, show a neutral placeholder so the
   * sales page does not flash at someone who already has Plus. */
  if (isAuthenticated && status === "idle") return renderPage(<div className="plus pm-loading" role="status" aria-busy="true"><span /><span /><span /></div>);
  if (isPlus && subscription) return renderPage(<PlusMember />);
  const expired = Boolean(subscription) && !isPlus;

  return renderPage(
      <div className={`plus ${embedded ? "plus-embedded-content" : ""}`}>
        {expired && <p className="plus-expired" role="status"><Icon name="alert" size={16} />{t("plus.m.expired")}</p>}
        <section ref={heroRef} className="plus-hero nt-glass nt-spot" onPointerMove={spot}>
          <Mesh />
          <div className="plus-hero-copy">
            <motion.span className="nt-eyebrow" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><Icon name="sparkles" size={14} />{t("plus.eyebrow")}</motion.span>
            <p className="plus-launch">{t("plus.launch")} <b>{t("plus.trial")}</b></p>
            <h1>{t("plus.title")}</h1>
            <p className="plus-sub">{plan.description || t("plus.sub")}</p>

            <div className="plus-actions">
              {!isAuthenticated ? (
                <Link to="/auth?next=%2Fpremium" className="nt-btn nt-btn-primary nt-btn-lg">{t("plus.login")}<Icon name="arrowRight" size={18} /></Link>
              ) : trialUsed ? (
                <span className="plus-pill"><Icon name="lock" size={16} />{t("plus.used")}</span>
              ) : (
                <button type="button" className="nt-btn nt-btn-primary nt-btn-lg" disabled={busy || loading || status !== "ok"} onClick={claim}>
                  <Icon name="zap" size={18} />{busy ? "…" : t("plus.claim")}<Icon name="arrowRight" size={16} />
                </button>
              )}
            </div>
            <small className="plus-note"><Icon name="lock" size={13} />{t("plus.notice")}</small>
          </div>

          <div className="plus-mark" aria-hidden="true">
            <span className="plus-ring r1" /><span className="plus-ring r2" />
            <div className="plus-logo"><LogoMark size={132} plus /><PlusCrown size={70} className="plus-logo-crown" /></div>
          </div>
        </section>

        <section className="plus-body">
          <div className="plus-perks nt-glass">
            <header><h2>{t("plus.perks")}</h2><p>{plan.description || t("plus.sub")}</p></header>
            <ul className="plus-feats">
              {PERKS.map(([icon, k], i) => (
                <motion.li key={k} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.06, duration: 0.4 }}>
                  <span className="plus-feat-ico"><Icon name={icon} size={19} /></span>
                  <div><h3>{t(`plus.${k}`)}</h3><p>{t(`plus.${k}Info`)}</p></div>
                  <Icon name="check" size={17} className="plus-tick" strokeWidth={2.6} />
                </motion.li>
              ))}
            </ul>
            {plan.features?.length > 0 && <ul className="plus-extra">{plan.features.map((f) => <li key={f}><Icon name="check" size={14} strokeWidth={2.8} />{f}</li>)}</ul>}
            <p className="plus-fine"><Icon name="info" size={15} />{t("plus.giftTerm")}</p>
          </div>

          <aside className="plus-plan nt-glass" aria-label={plan.name}>
            <div className="plus-plan-head"><span><Icon name="sparkles" size={15} />{plan.name || "NarxTop Premium"}</span><em>{t("plus.perMonth")}</em></div>
            <div className="plus-price">
              <strong>{plan.price ? Number(plan.price).toLocaleString("uz-UZ") : t("plus.priceNotSet")}</strong>{plan.price ? <span>UZS</span> : null}
            </div>
            <div className="plus-trial"><Icon name="gift" size={18} /><span><b>{t("plus.trial")}</b><small>{t("plus.then")} {plan.price ? `${money(plan.price)} · ${t("plus.perMonth")}` : t("plus.priceHint")}</small></span></div>
            <p className="plus-fine"><Icon name="lock" size={14} />{t("plus.charge")}</p>
            <button type="button" className="nt-btn nt-btn-ghost nt-block" disabled={!paymentsReady || busy} onClick={pay}>
              <Icon name="wallet" size={17} />{paymentsReady ? t("plus.buy") : t("plus.disabled")}
            </button>
            {!paymentsReady && <p className="plus-fine">{t("plus.ready")}</p>}
            <p className="plus-free"><Icon name="tag" size={14} />{t("plus.free")} · {t("plus.freeLimit", { n: money(FREE_BASKET_LIMIT) })}</p>
          </aside>
        </section>

        {message && <p className="nt-warn plus-msg" role="status">{message}</p>}
        {status === "offline" && isAuthenticated && (
          <div className="nt-warn plus-msg" role="status">{t("plus.err.offline")} <button type="button" className="nt-link" onClick={refresh}>{t("plus.retry")}</button></div>
        )}
      </div>
  );
}

export default function Plus() {
  return <PlusContent />;
}
