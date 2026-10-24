import { apiUrl } from "../lib/api";
import { DEFAULT_MAX_ECONOMY, validateMaxEconomySettings } from "../../shared/core/maxEconomy.js";
/*
 * Catalog service: the ONLY place the UI learns about products/prices.
 *   live    -> /api/catalog (data ingested from supermarket adapters)
 *   fixture -> bundled src/data/products.json, ONLY when VITE_ALLOW_FIXTURE=true
 *              (defaults to true in dev). The UI shows a "demo data" banner.
 */
const ALLOW_FIXTURE = (import.meta.env.VITE_ALLOW_FIXTURE ?? String(import.meta.env.DEV)) === "true";

const clean = (p) => ({
  ...p,
  id: p.id ?? p.slug,
  prices: (p.prices ?? [])
    .map((o) => ({ ...o, price: Number(o.price), oldPrice: o.oldPrice ? Number(o.oldPrice) : undefined }))
    .filter((o) => Number.isFinite(o.price) && o.price > 0),
});

/* A product without any usable price (or slug) cannot be compared, so the UI never sees it. */
const usable = (p) => Boolean(p?.slug) && p.prices.length > 0;

async function fetchLive(signal) {
  const all = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(apiUrl(`/api/catalog?limit=1000&offset=${offset}`), { signal });
    if (!res.ok) throw new Error(`catalog ${res.status}`);
    const body = await res.json();
    all.push(...(body.products ?? []));
    if (all.length >= body.total || !body.products?.length) return { products: all, generatedAt: body.generatedAt };
  }
}

export async function loadCatalog(signal) {
  try {
    const live = await fetchLive(signal);
    if (live.products.some((p) => p?.prices?.length)) return { source: "live", generatedAt: live.generatedAt, products: live.products.map(clean).filter(usable) };
  } catch (e) {
    if (e.name === "AbortError") throw e;
    if (!ALLOW_FIXTURE) throw e;
  }
  if (!ALLOW_FIXTURE) throw new Error("catalog-empty");
  const { default: fixture } = await import("../data/products.json");
  return { source: "fixture", generatedAt: null, products: fixture.map(clean).filter(usable) };
}

/* Real price drops and trending products (server/catalog.js -> /api/insights). */
export async function loadInsights(signal) {
  const res = await fetch(apiUrl("/api/insights"), { signal });
  if (!res.ok) throw new Error(`insights ${res.status}`);
  const body = await res.json();
  return { drops: body.drops ?? [], trending: body.trending ?? [] };
}

export async function loadMaxEconomy(signal) {
  const res = await fetch(apiUrl("/api/site/max-economy"), { signal });
  if (!res.ok) throw new Error(`max-economy ${res.status}`);
  const body = await res.json();
  const checked = validateMaxEconomySettings(body?.settings);
  if (!checked.ok) return DEFAULT_MAX_ECONOMY;
  return checked.value;
}
