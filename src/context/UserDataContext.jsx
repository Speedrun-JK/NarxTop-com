import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "../lib/api";
import { useAuth } from "./AuthContext";
import { useCatalog } from "./CatalogContext";
import { usePlus } from "./PlusContext";
import { onStorage, safeGet, safeRemove, safeSet } from "../lib/storage";
import { useLang } from "./LanguageContext";
import { formatPrice } from "../lib/constants";
import { toast } from "../lib/toast";

/*
 * Favorites, purchase history, alerts, notifications, preferences.
 * Local-first (localStorage per user) + background sync to the NarxTop API's
 * MongoDB `user_state` collection. The local copy remains usable while offline.
 */
const Ctx = createContext(null);
const KEYS = ["favorites", "purchases", "alerts", "notifications", "favoriteNotifications", "prefs"];

export const DEFAULT_PREFS = {
  notifyDrops: true,
  siteAccent: "brown",
  strategy: "cheapest",
  weights: { cost: 0.5, stores: 0.2, time: 0.3 },
};
const EMPTY = { favorites: [], purchases: [], alerts: {}, notifications: [], favoriteNotifications: [], prefs: DEFAULT_PREFS };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
/* cheapest in-stock price, or null when nothing can be bought right now */
const cheapestOf = (p) => {
  return bestOfferOf(p)?.price ?? null;
};
const bestOfferOf = (p) => p?.prices?.filter((o) => o.inStock !== false && o.price > 0).sort((a, b) => a.price - b.price)[0] ?? null;
const MAX_PURCHASES = 500;

/* never let a malformed remote row break the app */
const sameShape = (key, v) => (key === "alerts" || key === "prefs" ? v && typeof v === "object" && !Array.isArray(v) : Array.isArray(v));

function readLocal(key) {
  const raw = safeGet(key, null);
  return raw && typeof raw === "object" ? { data: { ...EMPTY, ...raw.data, prefs: { ...DEFAULT_PREFS, ...raw.data?.prefs } }, stamps: raw.stamps ?? {} } : null;
}

function moveOldDropMessages(data) {
  const oldDrops = data.notifications.filter((n) => n.kind === "drop");
  if (!oldDrops.length) return { data, changed: false };
  const priorIds = new Set(data.favoriteNotifications.map((n) => n.id));
  const moved = oldDrops.filter((n) => data.favorites.includes(n.slug) && !priorIds.has(n.id)).map((n) => {
    const oldTime = new Date(n.ts);
    return {
      id: n.id, kind: "drop", slug: n.slug, from: n.from, to: n.to,
      createdAt: n.createdAt ?? (Number.isFinite(oldTime.getTime()) ? oldTime.toISOString() : new Date().toISOString()), readAt: n.readAt ?? null,
    };
  });
  return {
    data: { ...data, notifications: data.notifications.filter((n) => n.kind !== "drop"), favoriteNotifications: [...moved, ...data.favoriteNotifications].slice(0, 100) },
    changed: true,
  };
}

export function UserDataProvider({ children }) {
  const { user } = useAuth();
  const { t, tProduct } = useLang();
  const { notifications: plusNotices, markNoticeRead } = usePlus();
  const userId = user?.id ?? null; // the user OBJECT changes on every token refresh; the id does not
  const { products, status } = useCatalog();
  const storageKey = `narxtop_ud_${userId ?? "guest"}`;
  const [state, setState] = useState({ data: EMPTY, stamps: {} });
  const [loadedKey, setLoadedKey] = useState(null);
  const [sync, setSync] = useState("local"); // local | syncing | synced | error
  const dirty = useRef(new Set());
  const seenPriceDrops = useRef(new Set());
  const [retry, setRetry] = useState(0);

  /* load + merge remote */
  useEffect(() => {
    let cancelled = false;
    const loaded = readLocal(storageKey) ?? { data: EMPTY, stamps: {} };
    const localMigration = moveOldDropMessages(loaded.data);
    const local = { ...loaded, data: localMigration.data };
    // Hydrate account-scoped state from local storage before merging the remote copy.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(local);
    setLoadedKey(storageKey);
    dirty.current = new Set(localMigration.changed ? ["notifications", "favoriteNotifications"] : []);
    if (!userId) { setSync("local"); return; }
    setSync("syncing");
    apiFetch("/api/user-state", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error("Could not load account data.");
      const result = await response.json();
      const rows = result.rows ?? [];
      if (cancelled) return;
      setState((cur) => {
        const data = { ...cur.data }, stamps = { ...cur.stamps };
        for (const r of rows ?? []) {
          const remote = Date.parse(r.updated_at);
          if (KEYS.includes(r.key) && remote > (stamps[r.key] ?? 0) && sameShape(r.key, r.value)) { data[r.key] = r.value; stamps[r.key] = remote; }
        }
        const migration = moveOldDropMessages(data);
        if (migration.changed) {
          data.notifications = migration.data.notifications;
          data.favoriteNotifications = migration.data.favoriteNotifications;
          dirty.current.add("notifications");
          dirty.current.add("favoriteNotifications");
        }
        data.prefs = { ...DEFAULT_PREFS, ...data.prefs };
        for (const k of KEYS) if ((stamps[k] ?? 0) > Math.max(0, ...((rows ?? []).filter((r) => r.key === k).map((r) => Date.parse(r.updated_at))), 0)) dirty.current.add(k);
        return { data, stamps };
      });
      setSync("synced");
    }).catch(() => { if (!cancelled) setSync("error"); });
    return () => { cancelled = true; };
  }, [storageKey, userId]);

  /* persist + debounce remote */
  useEffect(() => {
    if (loadedKey !== storageKey) return;
    safeSet(storageKey, state);
    if (!userId || !dirty.current.size) return;
    const t = setTimeout(async () => {
      const keys = [...dirty.current];
      dirty.current = new Set();
      setSync("syncing");
      const rows = keys.map((k) => ({ key: k, value: state.data[k], updated_at: new Date(state.stamps[k] ?? Date.now()).toISOString() }));
      let response;
      try { response = await apiFetch("/api/user-state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) }); }
      catch { response = null; }
      if (!response?.ok) {
        keys.forEach((k) => dirty.current.add(k));
        setSync("error");
        setTimeout(() => setRetry((n) => n + 1), 15000); // gentle retry, no hammering
      } else setSync("synced");
    }, 900);
    return () => clearTimeout(t);
  }, [state, storageKey, loadedKey, userId, retry]);

  useEffect(() => onStorage(storageKey, () => {
    const latest = readLocal(storageKey);
    if (latest) setState(latest);
  }), [storageKey]);

  /* a failed save is retried when the browser comes back online */
  useEffect(() => {
    const again = () => { if (dirty.current.size) setRetry((n) => n + 1); };
    window.addEventListener("online", again);
    return () => window.removeEventListener("online", again);
  }, []);

  const update = useCallback((key, fn) => {
    dirty.current.add(key);
    setState((s) => ({ data: { ...s.data, [key]: fn(s.data[key]) }, stamps: { ...s.stamps, [key]: Date.now() } }));
  }, []);

  useEffect(() => {
    const reviewed = plusNotices.filter((n) => n.kind === "receipt_review" && n.receiptId && ["approved", "rejected"].includes(n.status));
    if (!reviewed.length) return;
    const byReceipt = new Map(reviewed.map((n) => [n.receiptId, n.status]));
    if (state.data.purchases.some((p) => byReceipt.has(p.receiptId) && p.status !== byReceipt.get(p.receiptId))) {
      // Apply newer review statuses received from the server notification feed.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      update("purchases", (rows) => rows.map((p) => byReceipt.has(p.receiptId) ? { ...p, status: byReceipt.get(p.receiptId) } : p));
    }
  }, [plusNotices, state.data.purchases, update]);

  /* ---------------- favorites ---------------- */
  const isFavorite = useCallback((slug) => state.data.favorites.includes(slug), [state.data.favorites]);
  const toggleFavorite = useCallback((product) => {
    const slug = product.slug;
    update("favorites", (f) => (f.includes(slug) ? f.filter((s) => s !== slug) : [...f, slug]));
    update("alerts", (a) => {
      if (a[slug]) { const rest = { ...a }; delete rest[slug]; return rest; }
      const baseline = cheapestOf(product);
      return baseline == null ? a : { ...a, [slug]: { baseline, target: null, since: Date.now() } };
    });
  }, [update]);
  const setAlertTarget = useCallback((slug, target) => update("alerts", (a) => ({ ...a, [slug]: { ...(a[slug] ?? { since: Date.now() }), target: target || null } })), [update]);

  /* ---------------- purchases / prefs / notifications ---------------- */
  /* "I bought these": remembers real baskets (same ts = one shopping trip). Feeds the "bought together" suggestions. */
  const recordPurchase = useCallback((lines, { status = "approved", receiptId = null, orderId = null } = {}) => {
    const ts = Date.now();
    const rows = lines.filter((l) => l?.slug && l.qty > 0).map((l) => ({ slug: l.slug, qty: l.qty, store: l.store ?? null, price: l.price ?? null, status, receiptId, orderId, ts }));
    if (!rows.length) return;
    update("purchases", (p) => [...rows, ...p].slice(0, MAX_PURCHASES));
  }, [update]);
  const setPref = useCallback((patch) => update("prefs", (p) => ({ ...p, ...patch })), [update]);
  const dismissNotification = useCallback((id) => {
    if (String(id).startsWith("server_notice:")) return markNoticeRead(String(id).slice("server_notice:".length));
    update("notifications", (n) => n.filter((x) => x.id !== id));
  }, [update, markNoticeRead]);
  const clearNotifications = useCallback(() => {
    update("notifications", () => []);
    plusNotices.filter((n) => !n.readAt).forEach((n) => markNoticeRead(n.id));
  }, [update, plusNotices, markNoticeRead]);
  const markFavoriteNotificationsSeen = useCallback(() => {
    const readAt = new Date().toISOString();
    update("favoriteNotifications", (rows) => rows.map((n) => n.readAt ? n : { ...n, readAt }));
  }, [update]);
  const clearFavoriteNotifications = useCallback(() => update("favoriteNotifications", () => []), [update]);
  const resetAll = useCallback(() => {
    KEYS.forEach((k) => update(k, () => EMPTY[k]));
    safeRemove(`narxtop_checkout_draft_${userId ?? "guest"}`);
    safeRemove(`narxtop_plus_toast_seen_${userId ?? "guest"}`);
    safeRemove(`narxtop_plus_toast_seen_v2_${userId ?? "guest"}`);
  }, [update, userId]);

  /* ---------------- price-drop alerts (in-app) ---------------- */
  useEffect(() => {
    if (status !== "ready" || loadedKey !== storageKey) return;
    const { alerts, prefs, favorites } = state.data;
    const found = [];
    const next = { ...alerts };
    if (prefs.notifyDrops) {
      for (const [slug, a] of Object.entries(alerts)) {
        if (!favorites.includes(slug)) continue;
        const p = products.find((x) => x.slug === slug);
        if (!p) continue;
        const bestOffer = bestOfferOf(p);
        const now = bestOffer?.price ?? null;
        if (now == null) continue; // out of stock everywhere: nothing to compare
        // Without a target, show every real decrease. With a target, notify when it is reached.
        const hit = now < a.baseline && (a.target == null || now <= a.target);
        const eventKey = `${storageKey}:${slug}:${a.baseline}:${now}:${a.target ?? ""}`;
        if (hit && !seenPriceDrops.current.has(eventKey)) {
          seenPriceDrops.current.add(eventKey);
          const productUrl = bestOffer.url ?? bestOffer.productUrl ?? bestOffer.link ?? null;
          const safeStoreUrl = typeof productUrl === "string" && /^https?:\/\//i.test(productUrl) ? productUrl : null;
          const createdAt = new Date().toISOString();
          found.push({
            id: uid(), kind: "drop", slug, from: a.baseline, to: now,
            store: bestOffer.store ?? "", storeUrl: safeStoreUrl,
            createdAt, readAt: null, toastShownAt: createdAt,
          });
          toast("", { kind: "priceDrop", title: t("fav.notice.drop", { name: tProduct(p, "name") }), store: bestOffer.store ?? "", storeUrl: safeStoreUrl, price: formatPrice(now), slug });
          next[slug] = { ...a, baseline: now };
        }
        else if (now > a.baseline) next[slug] = { ...a, baseline: now };
      }
    }
    // Favorite price-drop messages stay in Favorites after they have been read.
    if (found.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (JSON.stringify(next) !== JSON.stringify(alerts)) update("alerts", () => next);
      update("favoriteNotifications", (n) => [...found, ...n].slice(0, 100));
    } else if (JSON.stringify(next) !== JSON.stringify(alerts)) {
      update("alerts", () => next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, products, loadedKey, state.data.favorites, state.data.alerts, state.data.prefs, t, tProduct]);

  // Surface an unread price-drop notification that was saved before the toast UI was ready.
  // `toastShownAt` makes this a one-time recovery instead of replaying old alerts on every render.
  useEffect(() => {
    if (status !== "ready" || loadedKey !== storageKey) return;
    const pending = state.data.favoriteNotifications.filter((n) => !n.readAt && !n.toastShownAt);
    if (!pending.length) return;
    const newest = [...pending].sort((a, b) => new Date(b.createdAt ?? b.ts ?? 0).getTime() - new Date(a.createdAt ?? a.ts ?? 0).getTime())[0];
    const product = products.find((p) => p.slug === newest.slug);
    const offer = product ? bestOfferOf(product) : null;
    const productUrl = newest.storeUrl ?? offer?.url ?? offer?.productUrl ?? offer?.link ?? null;
    const storeUrl = typeof productUrl === "string" && /^https?:\/\//i.test(productUrl) ? productUrl : null;
    toast("", {
      kind: "priceDrop",
      title: t("fav.notice.drop", { name: product ? tProduct(product, "name") : newest.slug }),
      store: newest.store ?? offer?.store ?? "",
      storeUrl,
      price: formatPrice(newest.to),
      slug: newest.slug,
    });
    const toastShownAt = new Date().toISOString();
    update("favoriteNotifications", (rows) => rows.map((n) => !n.readAt && !n.toastShownAt ? { ...n, toastShownAt } : n));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, loadedKey, storageKey, state.data.favoriteNotifications, products, t, tProduct]);

  const notifications = useMemo(() => [
    ...state.data.notifications,
    ...plusNotices.filter((n) => !n.readAt).map((n) => ({ ...n, id: `server_notice:${n.id}`, remoteId: n.id })),
  ].sort((a, b) => notificationTime(b) - notificationTime(a)), [state.data.notifications, plusNotices]);
  const value = useMemo(() => ({
    ...state.data, notifications, sync, isFavorite, toggleFavorite, setAlertTarget, recordPurchase, setPref, dismissNotification, clearNotifications, markFavoriteNotificationsSeen, clearFavoriteNotifications, resetAll,
  }), [state.data, notifications, sync, isFavorite, toggleFavorite, setAlertTarget, recordPurchase, setPref, dismissNotification, clearNotifications, markFavoriteNotificationsSeen, clearFavoriteNotifications, resetAll]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function notificationTime(n) {
  const value = n.createdAt ?? n.ts ?? 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number(value) || 0;
}

export function useUserData() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useUserData must be used inside UserDataProvider");
  return c;
}
