import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import Icon from "../../components/ui/Icon";
import { useLang } from "../../context/LanguageContext";
import { usePlus } from "../../context/PlusContext";
import { FREE_BASKET_LIMIT } from "../../../shared/core/plus.js";
import { formatDate } from "../../lib/dates";

const PERKS = [["zap", "m.noLimit", "m.noLimitInfo"], ["sparkles", "alerts", "alertsInfo"], ["gift", "gift", "giftInfo"], ["badgeCheck", "support", "supportInfo"]];
const DAY = 86_400_000, FALLBACK_SPAN = 60 * DAY;
const pad = (n) => String(n).padStart(2, "0");

/* Live countdown to `end`; ticks every second while the tab is visible. */
function useCountdown(end) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, end - now);
  return { now, left, d: Math.floor(left / DAY), h: Math.floor(left / 3_600_000) % 24, m: Math.floor(left / 60_000) % 60, s: Math.floor(left / 1000) % 60 };
}

/* /plus for an active member: how long Plus lasts (live countdown), what it does for them, and their gift schedule. */
export default function PlusMember() {
  const { t, lang } = useLang();
  const { plan, subscription, gifts, paymentsReady, beginCheckout } = usePlus();
  const end = new Date(subscription.expiresAt).getTime();
  const start = subscription.startedAt ? new Date(subscription.startedAt).getTime() : end - FALLBACK_SPAN;
  const { now, left, d, h, m, s } = useCountdown(end);
  const span = Math.max(DAY, end - start);
  const used = Math.min(1, Math.max(0, (now - start) / span));
  const soon = left < 7 * DAY;
  const date = (ms) => formatDate(ms, lang);
  const R = 92, C = 2 * Math.PI * R;
  const source = subscription.source === "launch-trial" ? t("plus.trial") : subscription.source === "admin-gift" ? t("plus.m.srcGift") : plan.name;
  const units = [[d, t("plus.m.d")], [h, t("plus.m.h")], [m, t("plus.m.m")], [s, t("plus.m.s")]];

  return (
    <div className="plus pm">
      <section className={`pm-hero ${soon ? "is-soon" : ""}`}>
        <span className="pm-glow" aria-hidden="true" />
        <div className="pm-copy">
          <span className="pm-badge"><Icon name="badgeCheck" size={15} />{t("plus.active")}<em>{source}</em></span>
          <h1>{t("plus.m.title")}</h1>
          <p>{t("plus.m.sub")}</p>
          <ul className="pm-dates">
            <li><small>{t("plus.m.started")}</small><b>{date(start)}</b></li>
            <li><small>{t("plus.m.ends")}</small><b>{date(end)}</b></li>
          </ul>
          {soon && <p className="pm-warn" role="status"><Icon name="alert" size={16} />{t("plus.m.soon")}</p>}
          <div className="pm-actions">
            <Link to="/" className="nt-btn nt-btn-primary nt-btn-lg"><Icon name="cart" size={18} />{t("plus.m.shop")}</Link>
            {paymentsReady && <button type="button" className="nt-btn nt-btn-ghost nt-btn-lg" onClick={() => beginCheckout()}><Icon name="wallet" size={17} />{t("plus.m.renew")}</button>}
          </div>
        </div>

        <div className="pm-clock" role="timer" aria-label={`${t("plus.m.left")}: ${d} ${t("plus.m.d")} ${h} ${t("plus.m.h")}`}>
          <span className="pm-halo" aria-hidden="true" /><span className="pm-orbit" aria-hidden="true" />
          <svg viewBox="0 0 220 220" aria-hidden="true">
            <circle cx="110" cy="110" r={R} className="pm-track" />
            <motion.circle cx="110" cy="110" r={R} className="pm-arc" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * used }} transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} />
          </svg>
          <div className="pm-clock-in">
            <small>{t("plus.m.left")}</small>
            <strong>{d}</strong>
            <span>{t("plus.m.d")}</span>
            <em>{pad(h)}:{pad(m)}:{pad(s)}</em>
          </div>
        </div>
      </section>

      <ul className="pm-units" aria-hidden="true">
        {units.map(([v, label]) => <li key={label}><b>{pad(v)}</b><span>{label}</span></li>)}
        <li className="pm-pct"><b>{Math.round(used * 100)}%</b><span>{t("plus.m.passed")}</span></li>
      </ul>

      <section className="pm-section">
        <header><h2>{t("plus.m.does")}</h2><p>{t("plus.m.doesSub", { n: `${FREE_BASKET_LIMIT.toLocaleString("uz-UZ")} UZS` })}</p></header>
        <ul className="pm-perks">
          {PERKS.map(([icon, title, info], i) => (
            <motion.li key={title} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07, duration: 0.4 }}>
              <span className="pm-perk-ico"><Icon name={icon} size={22} /></span>
              <h3>{t(`plus.${title}`)}</h3>
              <p>{t(`plus.${info}`, { n: `${FREE_BASKET_LIMIT.toLocaleString("uz-UZ")} UZS` })}</p>
              <span className="pm-on"><Icon name="check" size={13} strokeWidth={3} />{t("plus.m.on")}</span>
            </motion.li>
          ))}
        </ul>
        {plan.features?.length > 0 && <ul className="plus-extra pm-extra">{plan.features.map((f) => <li key={f}><Icon name="check" size={14} strokeWidth={2.8} />{f}</li>)}</ul>}
      </section>

      {gifts.length > 0 && (
        <section className="pm-section">
          <header><h2>{t("plus.m.gifts")}</h2></header>
          <ol className="pm-gifts">
            {[...gifts].reverse().map((g, i) => (
              <li key={g.id || i} className={g.issuedAt ? "is-done" : ""}>
                <span className="pm-gift-n">{g.issuedAt ? <Icon name="check" size={15} strokeWidth={3} /> : i + 1}</span>
                <div><b>{g.store}</b><small>{g.issuedAt ? t("plus.giftIssued") : `${t("plus.giftPending")}${g.dueAt ? ` · ${date(new Date(g.dueAt).getTime())}` : ""}`}</small></div>
              </li>
            ))}
          </ol>
          <p className="plus-fine"><Icon name="info" size={15} />{t("plus.giftTerm")}</p>
        </section>
      )}
    </div>
  );
}
