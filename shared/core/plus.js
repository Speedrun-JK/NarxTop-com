/*
 * NarxTop Plus — pure domain logic shared by the API (server/plus.js), the UI and the tests.
 * No dependencies, no I/O: everything that needs the clock or randomness takes it as an argument.
 *
 *   free plan  : a basket may cost at most FREE_BASKET_LIMIT UZS (cheapest single-store total)
 *   Plus       : no basket cap while the subscription is active
 *   launch trial: one per account, `trialMonths` calendar months, no card, no auto-renew
 *   gift       : each covered subscription month gets a randomly chosen supermarket gift
 *                (fulfilled manually by an admin — nothing is bought automatically)
 */

export const FREE_BASKET_LIMIT = 1_000_000; // UZS
export const GIFT_STORES = ["Korzinka", "Makro", "Havas"];
export const MAX_GIFT_MONTHS = 24;
export const MAX_ADMIN_GIFT = 365; // days or months an admin may grant in one action
export const MAX_PLAN_PRICE = 100_000_000;

export const DEFAULT_PLAN = Object.freeze({
  name: "NarxTop Premium",
  price: null, // an admin sets it before real payments are switched on
  currency: "UZS",
  trialMonths: 2,
  description: "",
  features: [],
});

const DAY = 86_400_000;

/** Calendar-month addition that never overflows (Jan 31 + 1 month = Feb 28/29, not Mar 3). */
export function addMonths(date, months) {
  const next = new Date(date);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() < day) next.setDate(0);
  return next;
}

const time = (d) => (d ? new Date(d).getTime() : NaN);

/** Is this subscription row currently granting Plus? */
export function isPlusActive(subscription, now = Date.now()) {
  if (!subscription || subscription.status !== "active") return false;
  const end = time(subscription.expiresAt);
  return Number.isFinite(end) && end > +now;
}

/** Whole days left (rounded up, never negative). */
export function remainingDays(subscription, now = Date.now()) {
  const end = time(subscription?.expiresAt);
  if (!Number.isFinite(end)) return 0;
  return Math.max(0, Math.ceil((end - +now) / DAY));
}

/**
 * One gift record per covered month. `rand` is injectable so tests are deterministic.
 * Each is due at the start of its month, but never after the subscription ends.
 */
export function planGiftEvents({ userId, email = "", name = "", months, now, expiresAt, rand = Math.random }) {
  const count = Math.max(1, Math.min(MAX_GIFT_MONTHS, Math.floor(Number(months)) || 1));
  const end = new Date(expiresAt).getTime();
  return Array.from({ length: count }, (_, i) => ({
    userId, email, name,
    period: i + 1,
    store: GIFT_STORES[Math.min(GIFT_STORES.length - 1, Math.floor(rand() * GIFT_STORES.length))],
    status: "awaiting-fulfilment",
    createdAt: now,
    dueAt: new Date(Math.min(addMonths(now, i + 1).getTime(), end)),
  }));
}

/** New expiry when time is added: extends an active plan, otherwise starts now. */
export function extendExpiry(currentExpiresAt, { unit, amount }, now = new Date()) {
  const active = currentExpiresAt && time(currentExpiresAt) > +now;
  const base = active ? new Date(currentExpiresAt) : new Date(now);
  return unit === "months" ? addMonths(base, amount) : new Date(base.getTime() + amount * DAY);
}

/* ------------------------------ validators ------------------------------ */

/** Admin plan form -> { ok, error?, value? } (price is a whole number of UZS). */
export function validatePlanInput(body, current = DEFAULT_PLAN) {
  const b = body && typeof body === "object" ? body : {};
  const price = Number(b.price);
  if (!Number.isInteger(price) || price < 1 || price > MAX_PLAN_PRICE) {
    return { ok: false, error: `Premium narxi 1 dan ${MAX_PLAN_PRICE.toLocaleString("en-US")} so‘mgacha butun son bo‘lishi kerak.` };
  }
  const description = String(b.description ?? "").trim().slice(0, 500);
  const features = Array.isArray(b.features)
    ? b.features.map((x) => String(x).trim().slice(0, 160)).filter(Boolean).slice(0, 12)
    : current.features ?? [];
  return { ok: true, value: { ...DEFAULT_PLAN, ...current, price, description, features, trialMonths: current.trialMonths ?? DEFAULT_PLAN.trialMonths } };
}

/** Admin "gift time" form -> { ok, error?, value? }. */
export function validateGiftInput(body) {
  const b = body && typeof body === "object" ? body : {};
  const userId = String(b.userId ?? "").trim().slice(0, 128);
  const unit = String(b.unit ?? "days");
  const amount = Number(b.amount);
  const max = unit === "months" ? MAX_GIFT_MONTHS : MAX_ADMIN_GIFT;
  if (!userId || !["days", "months"].includes(unit) || !Number.isInteger(amount) || amount < 1 || amount > max) {
    return { ok: false, error: "Foydalanuvchini va to‘g‘ri kun yoki oy sonini tanlang." };
  }
  const message = String(b.message ?? "").trim().slice(0, 500);
  return { ok: true, value: { userId, unit, amount, message, email: String(b.email ?? "").slice(0, 200), name: String(b.name ?? "").slice(0, 200) } };
}

/* ----------------------------- basket limit ----------------------------- */

/**
 * May the basket grow to `nextTotal`? Plus members: always. Free plan: up to FREE_BASKET_LIMIT.
 * Shrinking (or staying put) is ALWAYS allowed, so a basket that is already over the limit
 * (prices moved, Plus expired, guest cart merged in) can still be reduced instead of getting stuck.
 */
export function canGrowBasket({ isPlus, currentTotal = 0, nextTotal = 0, limit = FREE_BASKET_LIMIT }) {
  if (isPlus) return true;
  if (nextTotal <= limit) return true;
  return nextTotal <= currentTotal;
}
