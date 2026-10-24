import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "./AuthContext";
import { useCatalog } from "./CatalogContext";
import { usePlus } from "./PlusContext";
import { cartBreakdown, storeTotals } from "../lib/product";
import { FREE_BASKET_LIMIT, canGrowBasket } from "../../shared/core/plus.js";
import { onStorage, safeGet, safeRemove, safeSet } from "../lib/storage";

const CartContext = createContext(null);

const MAX_QTY = 99;
const GUEST_KEY = "narxtop_cart_guest";
const clampQty = (n) => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) ? Math.min(MAX_QTY, Math.max(0, v)) : 0;
};

/* Reads a saved cart and drops anything malformed (bad slug, qty <= 0, duplicates). */
function readCart(key) {
  try {
    const saved = safeGet(key, []);
    if (!Array.isArray(saved)) return [];
    const seen = new Map();
    for (const it of saved) {
      const qty = clampQty(it?.qty);
      if (typeof it?.slug !== "string" || !it.slug || !qty) continue;
      seen.set(it.slug, clampQty((seen.get(it.slug) ?? 0) + qty));
    }
    return [...seen].map(([slug, qty]) => ({ slug, qty }));
  } catch {
    return [];
  }
}

function mergeCarts(a, b) {
  const m = new Map(a.map((i) => [i.slug, i.qty]));
  for (const i of b) m.set(i.slug, clampQty((m.get(i.slug) ?? 0) + i.qty));
  return [...m].map(([slug, qty]) => ({ slug, qty }));
}

export function CartProvider({ children }) {
  const { user, loading } = useAuth();
  const storageKey = `narxtop_cart_${user?.id ?? "guest"}`;
  const previousUserId = useRef(user?.id ?? null);

  const [items, setItems] = useState([]);
  const [loadedKey, setLoadedKey] = useState(null);

  // Load the cart that belongs to the current user. Items a guest put in the cart
  // before signing in are merged into the account cart instead of being lost.
  useEffect(() => {
    if (loading) return;
    const nextUserId = user?.id ?? null;
    const previous = previousUserId.current;
    if (previous && previous !== nextUserId) safeRemove(`narxtop_checkout_draft_${previous}`);
    previousUserId.current = nextUserId;
    let next = readCart(storageKey);
    if (user?.id) {
      const guest = readCart(GUEST_KEY);
      if (guest.length) {
        next = mergeCarts(next, guest);
        safeRemove(GUEST_KEY);
      }
    }
    // Cart contents are hydrated from this account's local storage after auth resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(next);
    setLoadedKey(storageKey);
  }, [storageKey, loading, user?.id]);

  // Save on every change (only after the correct cart was loaded).
  useEffect(() => {
    if (loadedKey !== storageKey) return;
    safeSet(storageKey, items);
  }, [items, storageKey, loadedKey]);

  // Keep several open tabs in sync.
  useEffect(() => {
    return onStorage(storageKey, () => setItems(readCart(storageKey)));
  }, [storageKey]);

  /* ---- free-plan basket limit (NarxTop Plus lifts it) ---- */
  const { bySlug } = useCatalog();
  const { isPlus, showLimitNotice } = usePlus();
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  /* What the basket costs: the cheapest complete single-store total (promos + stock honoured), or the cheapest mix. */
  const basketTotal = useCallback((list) => {
    const lines = list.map((i) => ({ id: i.slug, product: bySlug.get(i.slug), qty: i.qty })).filter((l) => l.product);
    if (!lines.length) return 0;
    const complete = storeTotals(lines).filter((s) => s.complete).map((s) => s.total);
    return complete.length ? Math.min(...complete) : cartBreakdown(lines, "mix").total;
  }, [bySlug]);

  /* Applies a new item list unless it would push a free-plan basket over the limit. Shrinking is always allowed. */
  const commit = useCallback((next) => {
    const current = itemsRef.current;
    if (!isPlus && next !== current) {
      const nextTotal = basketTotal(next);
      if (nextTotal > FREE_BASKET_LIMIT && !canGrowBasket({ isPlus, currentTotal: basketTotal(current), nextTotal })) {
        showLimitNotice();
        return false;
      }
    }
    itemsRef.current = next;
    setItems(next);
    return true;
  }, [isPlus, basketTotal, showLimitNotice]);

  /* addItem / setQty return true when the change was applied (false: blocked by the free limit). */
  const addItem = useCallback((slug, n = 1) => {
    const add = clampQty(n);
    if (!slug || !add) return false;
    const current = itemsRef.current;
    const existing = current.find((item) => item.slug === slug);
    return commit(existing
      ? current.map((item) => (item.slug === slug ? { ...item, qty: clampQty(item.qty + add) } : item))
      : [...current, { slug, qty: add }]);
  }, [commit]);

  const setQty = useCallback((slug, qty) => {
    const q = clampQty(qty);
    const current = itemsRef.current;
    return commit(q <= 0 ? current.filter((item) => item.slug !== slug) : current.map((item) => (item.slug === slug ? { ...item, qty: q } : item)));
  }, [commit]);

  const removeItem = useCallback((slug) => commit(itemsRef.current.filter((item) => item.slug !== slug)), [commit]);

  const removeMany = useCallback((slugs) => {
    const gone = new Set(slugs);
    return commit(itemsRef.current.filter((item) => !gone.has(item.slug)));
  }, [commit]);

  const clear = useCallback(() => commit([]), [commit]);

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((sum, item) => sum + item.qty, 0),
      addItem,
      setQty,
      removeItem,
      removeMany,
      clear,
    }),
    [items, addItem, setQty, removeItem, removeMany, clear]
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart must be used inside CartProvider");
  }

  return context;
}
