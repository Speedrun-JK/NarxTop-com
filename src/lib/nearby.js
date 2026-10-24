/* Nearest branches of one chain, from OpenStreetMap through the free Overpass API (no key).
 * Fused from the original NarxTop build into the route popup. Only the rounded search area is sent to the
 * Overpass servers; nothing is stored. Every failure resolves to "no list" so the popup keeps working with
 * the plain map-app links. Pure helpers (distanceKm, formatKm, matcherFor, branchRoute) are unit-tested. */

export const SEARCH_RADIUS_KM = 30;
const OVERPASS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];

/* how the known chains are spelled in OpenStreetMap (Latin + Cyrillic); any other chain matches by its own name */
const KNOWN = { korzinka: "korzinka|корзинка", makro: "makro|macro|макро", havas: "havas|хавас" };
const escape = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const slug = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

export function matcherFor(chain) {
  const alt = KNOWN[slug(chain)] ?? escape(String(chain).trim().toLowerCase());
  return { regex: new RegExp(`(?:^|[^\\p{L}])(?:${alt})(?![\\p{L}])`, "iu"), overpass: alt };
}

export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export const formatKm = (km) => (km < 1 ? `${Math.max(10, Math.round(km * 100) * 10)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`);

/** Direct driving directions from `from` to a branch, per map app. */
export function branchRoute(app, from, to) {
  const f = `${from.lat},${from.lng}`, d = `${to.lat},${to.lng}`;
  return {
    google: `https://www.google.com/maps/dir/?api=1&origin=${f}&destination=${d}&travelmode=driving`,
    yandex: `https://yandex.com/maps/?rtext=${f}~${d}&rtt=auto`,
    gis: `https://2gis.com/directions/points/${from.lng},${from.lat}|${to.lng},${to.lat}`,
    waze: `https://waze.com/ul?ll=${d}&navigate=yes`,
  }[app];
}

async function overpass(query, signal) {
  let last;
  for (const url of OVERPASS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 14000);
    const abort = () => ctrl.abort();
    signal?.addEventListener("abort", abort);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: `data=${encodeURIComponent(query)}`, signal: ctrl.signal });
      if (!res.ok) throw new Error(`overpass ${res.status}`);
      return await res.json();
    } catch (e) {
      last = e;
      if (signal?.aborted) break;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    }
  }
  throw last;
}

/** → [{ name, lat, lng, km }] nearest first (at most `limit`); throws when every Overpass server failed. */
export async function findBranches(chain, origin, { limit = 3, signal } = {}) {
  const { regex, overpass: alt } = matcherFor(chain);
  const cacheKey = `narxtop_branches_${slug(chain)}_${origin.lat.toFixed(2)}_${origin.lng.toFixed(2)}`;
  let elements = null;
  try { elements = JSON.parse(sessionStorage.getItem(cacheKey) || "null"); } catch { /* ignore */ }
  if (!elements) {
    const around = `(around:${SEARCH_RADIUS_KM * 1000},${origin.lat},${origin.lng})`;
    const q = `[out:json][timeout:20];(nwr["name"~"${alt}",i]${around};nwr["brand"~"${alt}",i]${around};);out center tags;`;
    elements = (await overpass(q, signal)).elements ?? [];
    try { sessionStorage.setItem(cacheKey, JSON.stringify(elements)); } catch { /* ignore */ }
  }
  const seen = new Set();
  const out = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat, lng = el.lon ?? el.center?.lon;
    if (lat == null || lng == null) continue;
    const tags = el.tags ?? {};
    if (!regex.test([tags.name, tags["name:en"], tags["name:ru"], tags["name:uz"], tags.brand].filter(Boolean).join(" "))) continue;
    const key = `${lat.toFixed(4)}_${lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name: tags["name:en"] || tags.name || chain, lat, lng, km: distanceKm(origin, { lat, lng }) });
  }
  return out.sort((a, b) => a.km - b.km).slice(0, limit);
}
