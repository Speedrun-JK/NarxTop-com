import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useAuth } from "./AuthContext";
import { useLang } from "./LanguageContext";
import { apiFetch } from "../lib/api";
import { DEFAULT_PLAN, isPlusActive, remainingDays } from "../../shared/core/plus.js";
import { displayPremiumName } from "../../shared/translations.js";
import { toast } from "../lib/toast";
import { safeGet, safeSet } from "../lib/storage";
import { formatDate } from "../lib/dates";

/*
 * NarxTop Plus state: the public plan, the signed-in user's subscription and gift records, and the
 * "free basket limit reached" notice. Business rules live in shared/core/plus.js; the API is server/plus.js.
 * Every action resolves to { ok, code?, ... } — never throws — so the UI can show a translated message.
 */
const PlusContext = createContext(null);

async function call(path, { method = "GET", auth = true } = {}) {
  const headers = {};
  void auth; // the NarxTop HttpOnly cookie is attached by apiFetch
  if (method !== "GET") headers["Content-Type"] = "application/json";
  let res;
  try {
    res = await apiFetch(path, { method, headers, body: method !== "GET" ? "{}" : undefined });
  } catch {
    return { ok: false, code: "offline" };
  }
  const body = await res.json().catch(() => null);
  if (!body) return { ok: false, code: res.status >= 500 ? "SERVER" : "offline" };
  if (!res.ok || body.success === false) return { ok: false, code: body.code ?? "generic", ...body };
  return { ok: true, ...body };
}

export function PlusProvider({ children }) {
  const { user } = useAuth();
  const { t, lang } = useLang();
  const userId = user?.id ?? "";
  const [plan, setPlan] = useState(DEFAULT_PLAN);
  const [subscription, setSubscription] = useState(null);
  const [gifts, setGifts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [paymentsReady, setPaymentsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | ok | offline
  const [limitNotice, setLimitNotice] = useState(false);
  const run = useRef(0);

  // the public plan (name, price, benefits) is the same for everybody
  useEffect(() => {
    let off = false;
    call("/api/plus/plan", { auth: false }).then((r) => { if (!off && r.ok) { setPlan({ ...DEFAULT_PLAN, ...r.plan, name: "NarxTop Premium", description: displayPremiumName(r.plan?.description ?? ""), features: (r.plan?.features ?? []).map(displayPremiumName) }); setPaymentsReady(Boolean(r.paymentsReady)); } });
    return () => { off = true; };
  }, []);

  const refresh = useCallback(async () => {
    const id = ++run.current; // a later call wins
    if (!userId) { setSubscription(null); setGifts([]); setNotifications([]); setStatus("idle"); return; }
    setLoading(true);
    const r = await call("/api/plus/me");
    if (id !== run.current) return;
    setLoading(false);
    if (!r.ok) { setStatus("offline"); return; }
    setSubscription(r.subscription ?? null);
    setGifts(r.gifts ?? []);
    const incoming = r.notifications ?? [];
    // Version the toast receipt key so unread gifts missed by the old fire-and-forget toast can surface once.
    const toastKey = `narxtop_plus_toast_seen_v2_${userId}`;
    const known = new Set(safeGet(toastKey, []).filter((id) => typeof id === "string"));
    const unseen = incoming.filter((n) => !n.readAt && !known.has(n.id));
    if (unseen.length) {
      const newest = unseen.sort((a, b) => new Date(b.createdAt ?? b.ts ?? 0).getTime() - new Date(a.createdAt ?? a.ts ?? 0).getTime())[0];
      const premiumGift = newest.kind === "plus_gift";
      const review = newest.kind === "receipt_review";
      const approved = review && newest.status === "approved";
      const title = premiumGift
        ? t("plus.giftToast")
        : review
          ? t(approved ? "receipt.review.approved" : "receipt.review.rejected")
          : (newest.title || newest.subject || newest.message || t("acc.notifTitle"));
      const description = premiumGift
        ? (newest.message || (newest.expiresAt ? t("toast.premiumUntil", { expiry: formatDate(newest.expiresAt, lang) }) : ""))
        : review
          ? (newest.note || "")
          : (newest.detail || newest.note || "");
      toast("", {
        kind: "accountNotification",
        tone: premiumGift ? "premium" : review ? (approved ? "success" : "warning") : "general",
        icon: premiumGift ? "crown" : review ? (approved ? "badgeCheck" : "alert") : "bell",
        label: premiumGift ? t("toast.premium") : t("toast.notification"),
        title,
        description,
        href: `/account?tab=notifications&notice=${encodeURIComponent(newest.id)}`,
      });
    }
    incoming.forEach((n) => known.add(n.id));
    safeSet(toastKey, [...known].slice(-100));
    setNotifications(incoming);
    setPaymentsReady(Boolean(r.paymentsReady));
    setStatus("ok");
  }, [userId, t, lang]);

  useEffect(() => {
    // Identity changes require an immediate refresh, including clearing account-only state on logout.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  // Stay current while visible so account notices from a new admin gift arrive promptly.
  useEffect(() => {
    if (!userId) return undefined;
    const soon = () => { if (document.visibilityState === "visible") refresh(); };
    const timer = window.setInterval(soon, 30000);
    window.addEventListener("focus", soon);
    document.addEventListener("visibilitychange", soon);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", soon); document.removeEventListener("visibilitychange", soon); };
  }, [userId, refresh]);

  const startTrial = useCallback(async () => {
    const r = await call("/api/plus/trial", { method: "POST" });
    if (r.ok) { setSubscription(r.subscription); await refresh(); }
    else if (r.code === "TRIAL_USED" && r.subscription) setSubscription(r.subscription);
    return r;
  }, [refresh]);
  const beginCheckout = useCallback(() => call("/api/plus/checkout", { method: "POST" }), []);
  const markNoticeRead = useCallback(async (id) => {
    const r = await call(`/api/notifications/${encodeURIComponent(id)}/read`, { method: "POST" });
    if (r.ok) setNotifications((current) => current.map((n) => n.id === id ? { ...n, readAt: n.readAt ?? new Date().toISOString() } : n));
    return r;
  }, []);

  const showLimitNotice = useCallback(() => setLimitNotice(true), []);
  const dismissLimitNotice = useCallback(() => setLimitNotice(false), []);

  const value = useMemo(() => ({
    plan, subscription, gifts, notifications, markNoticeRead, paymentsReady, loading, status,
    isPlus: userId ? isPlusActive(subscription) : false,
    daysLeft: remainingDays(subscription),
    trialUsed: subscription?.trialUsed === true,
    refresh, startTrial, beginCheckout,
    limitNotice, showLimitNotice, dismissLimitNotice,
  }), [plan, subscription, gifts, notifications, markNoticeRead, paymentsReady, loading, status, userId, refresh, startTrial, beginCheckout, limitNotice, showLimitNotice, dismissLimitNotice]);

  return <PlusContext.Provider value={value}>{children}</PlusContext.Provider>;
}

export function usePlus() {
  const c = useContext(PlusContext);
  if (!c) throw new Error("usePlus must be used inside PlusProvider");
  return c;
}

/** Turns a server error code (AUTH, TRIAL_USED, offline …) into a message in the visitor's language. */
export function useErrorText() {
  const { t } = useLang();
  return useCallback((code) => {
    const key = `plus.err.${code}`;
    const text = t(key);
    return text === key ? t("plus.err.generic") : text;
  }, [t]);
}
