/* Daily "cheap picks": 9 random products from the cheaper part of the catalog, the same for everyone all day.
 * The day rolls over at midnight Tashkent time (UTC+5), so the set changes every 24 hours without a server job. */
const TASHKENT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const PICKS_PER_SLIDE = 3;
export const PICK_SLIDES = 3;

/** "2026-10-18" in Tashkent time. */
export function dayKey(now = Date.now()) {
  return new Date(now + TASHKENT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Milliseconds until the next Tashkent midnight (+ a small buffer). */
export function msUntilNextDay(now = Date.now()) {
  const local = now + TASHKENT_OFFSET_MS;
  return DAY_MS - (local % DAY_MS) + 500;
}

function hashSeed(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

/** Small deterministic PRNG (mulberry32). */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {Array<{slug:string, price:number}>} candidates  products that are in stock, with their cheapest price
 * @returns {string[]} slugs, a multiple of 3 (up to 9)
 */
export function pickDaily(candidates, key = dayKey(), { total = PICKS_PER_SLIDE * PICK_SLIDES, poolShare = 0.5 } = {}) {
  const valid = candidates.filter((c) => c && c.slug && Number(c.price) > 0);
  const sorted = [...valid].sort((a, b) => a.price - b.price || a.slug.localeCompare(b.slug));
  // the cheaper half (but never fewer than `total` when the catalog has that many)
  const poolSize = Math.min(sorted.length, Math.max(total, Math.ceil(sorted.length * poolShare)));
  const pool = sorted.slice(0, poolSize);
  const rand = rng(hashSeed(`narxtop-daily-${key}`));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const count = Math.min(total, Math.floor(pool.length / PICKS_PER_SLIDE) * PICKS_PER_SLIDE);
  return pool.slice(0, count).map((c) => c.slug);
}

export function chunk(list, size = PICKS_PER_SLIDE) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
