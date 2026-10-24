import { Link, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import Icon from "../../components/ui/Icon";
import { EmptyState } from "../../components/ui/States";
import { useLang } from "../../context/LanguageContext";
import { useCatalog } from "../../context/CatalogContext";
import { useUserData } from "../../context/UserDataContext";
import { formatPrice } from "../../lib/constants";
import { formatDate, formatDateTime } from "../../lib/dates";

function stamp(n) {
  const v = n.createdAt ?? n.ts;
  const d = v ? new Date(v) : null;
  return d && Number.isFinite(d.getTime()) ? d : null;
}

/* One card per message. The tone (green / red / gold / brown) comes from what happened:
 * a receipt the admins approved, a receipt they rejected, a Plus gift, or a price drop. */
function describe(n, { t, lang, bySlug }) {
  if (n.kind === "plus_gift") {
    return {
      tone: "gold", icon: "crown",
      title: t(n.extended ? "plus.notice.extended" : "plus.notice.granted", {
        duration: giftDuration(lang, n.unit, n.amount),
        expiry: formatDate(n.expiresAt, lang),
      }),
      note: n.message ? <><b>{t("plus.notice.adminMessage")}</b> {n.message}</> : "",
    };
  }
  if (n.kind === "receipt_review") {
    const ok = n.status === "approved";
    return { tone: ok ? "ok" : "bad", icon: ok ? "badgeCheck" : "alert", title: t(ok ? "receipt.review.approved" : "receipt.review.rejected"), note: n.note || "" };
  }
  const pct = n.from > 0 ? Math.round(((n.from - n.to) / n.from) * 100) : 0;
  return {
    tone: "drop", icon: "trendDown", badge: pct > 0 ? `−${pct}%` : "",
    title: <Link to={`/product/${n.slug}`}>{bySlug.get(n.slug)?.name ?? n.slug}</Link>,
    text: <><s>{formatPrice(n.from)}</s> → <b>{formatPrice(n.to)}</b></>,
  };
}

export default function Notifications() {
  const { t, lang } = useLang();
  const { bySlug } = useCatalog();
  const { notifications, dismissNotification, clearNotifications } = useUserData();
  const [searchParams] = useSearchParams();
  const targetNotice = searchParams.get("notice");
  const [highlightedId, setHighlightedId] = useState("");
  useEffect(() => {
    if (!targetNotice || !notifications.length) return undefined;
    const match = notifications.find((n) => String(n.remoteId ?? n.id).replace(/^server_notice:/, "") === targetNotice);
    if (!match) return undefined;
    setHighlightedId(match.id);
    const frame = window.requestAnimationFrame(() => {
      const row = document.getElementById(`notice-${encodeURIComponent(String(match.id))}`);
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
      row?.focus({ preventScroll: true });
    });
    const timer = window.setTimeout(() => setHighlightedId(""), 4800);
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [targetNotice, notifications]);
  if (!notifications.length) return <EmptyState icon="bell" title={t("acc.notifEmpty")} text={t("acc.notifEmptyText")} />;
  const fmt = (date) => formatDateTime(date, lang);
  return (
    <div className="nt-panel nn">
      <div className="nn-head">
        <h2>{t("acc.notifTitle")}<span className="nn-count">{notifications.length}</span></h2>
        <button type="button" className="nt-btn nt-btn-ghost nn-clear" onClick={clearNotifications}><Icon name="trash" size={15} />{t("acc.clearAll")}</button>
      </div>
      <ul className="nn-list">
        <AnimatePresence initial={false}>
          {notifications.map((n) => {
            const d = describe(n, { t, lang, bySlug });
            const when = stamp(n);
            return (
              <motion.li id={`notice-${encodeURIComponent(String(n.id))}`} data-notice-id={n.remoteId ?? String(n.id).replace(/^server_notice:/, "")} tabIndex={-1} key={n.id} layout className={`nn-item is-${d.tone} ${highlightedId === n.id ? "is-targeted" : ""}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 28 }} transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}>
                <span className="nn-ico" aria-hidden="true"><Icon name={d.icon} size={22} strokeWidth={2} /></span>
                <div className="nn-body">
                  <div className="nn-top"><b className="nn-title">{d.title}</b>{d.badge && <span className="nn-badge">{d.badge}</span>}</div>
                  {d.text && <p className="nn-text">{d.text}</p>}
                  {d.note && <p className="nn-note">{d.note}</p>}
                  {when && <time className="nn-time" dateTime={when.toISOString()}>{fmt(when)}</time>}
                </div>
                <button type="button" className="nn-x" onClick={() => dismissNotification(n.id)} aria-label={t("acc.dismiss")} title={t("acc.dismiss")}><Icon name="x" size={16} strokeWidth={2.4} /></button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}

function giftDuration(lang, unit, amount) {
  const n = Math.max(1, Number(amount) || 1);
  if (lang === "uz") return `${n} ${unit === "months" ? "oy" : "kun"}`;
  if (lang === "ru") {
    const form = new Intl.PluralRules("ru").select(n);
    const labels = unit === "months"
      ? { one: "месяц", few: "месяца", many: "месяцев", other: "месяца" }
      : { one: "день", few: "дня", many: "дней", other: "дня" };
    return `${n} ${labels[form]}`;
  }
  return `${n} ${unit === "months" ? (n === 1 ? "month" : "months") : (n === 1 ? "day" : "days")}`;
}
