/* Pure validation / normalisation for admin product payloads (no I/O, unit-tested). */

export const slugify = (s) =>
  String(s ?? "").toLowerCase().replace(/['’‘ʻʼ`]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

const str = (v, max) => String(v ?? "").trim().replace(/\s+/g, " ").slice(0, max);
const textMap = (v, max) => Object.fromEntries(["uz", "ru", "en"].map((lang) => [lang, String(v?.[lang] ?? "").trim().slice(0, max)]));

export function validateOffers(list) {
  const errors = [];
  const out = [];
  const seen = new Set();
  if (list == null) return { offers: [], errors };
  if (!Array.isArray(list)) return { offers: [], errors: ["Narxlar ro‘yxati noto‘g‘ri."] };
  if (list.length > 12) errors.push("Bitta mahsulotga 12 tadan ortiq do‘kon qo‘shib bo‘lmaydi.");
  for (const [i, raw] of list.entries()) {
    const store = str(raw?.store, 40);
    const price = Math.round(Number(raw?.price));
    const at = `${i + 1}-narx`;
    if (!store) { errors.push(`${at}: do‘kon nomi kerak.`); continue; }
    if (seen.has(store.toLowerCase())) { errors.push(`${store}: bir do‘kon ikki marta kiritilgan.`); continue; }
    seen.add(store.toLowerCase());
    if (!Number.isFinite(price) || price <= 0 || price > 1_000_000_000) { errors.push(`${store}: narx noto‘g‘ri.`); continue; }
    const o = { store, price, inStock: raw?.inStock !== false };
    if (raw?.oldPrice !== undefined && raw?.oldPrice !== null && raw?.oldPrice !== "") {
      const old = Math.round(Number(raw.oldPrice));
      if (!Number.isFinite(old) || old <= price) errors.push(`${store}: eski narx joriy narxdan katta bo‘lishi kerak.`);
      else o.oldPrice = old;
    }
    out.push(o);
  }
  return { offers: out, errors };
}

export function validateProduct(body, { requireAll = true } = {}) {
  const b = body && typeof body === "object" ? body : {};
  const errors = [];
  const name = str(b.name, 120);
  const category = str(b.category, 60);
  const categories = [...new Set((Array.isArray(b.categories) ? b.categories : [category]).map((value) => str(value, 60)).filter(Boolean))].slice(0, 12);
  const MEALS = ["breakfast", "lunch", "dinner", "snacks"];
  // several meal periods are allowed; the old single `mealType` value is still accepted and kept as the first one
  const mealTypes = [...new Set([...(Array.isArray(b.mealTypes) ? b.mealTypes : []), b.mealType].filter((value) => MEALS.includes(value)))];
  const mealType = mealTypes[0] ?? "";
  const unit = str(b.unit, 30);
  const brand = str(b.brand, 60);
  const description = String(b.description ?? "").trim().slice(0, 600);
  const image = String(b.image ?? "").trim();
  const sourceLanguage = ["uz", "ru", "en"].includes(b.sourceLanguage) ? b.sourceLanguage : "uz";

  if (name.length < 2) errors.push("Mahsulot nomi kamida 2 ta belgi bo‘lsin.");
  if (requireAll && !categories.length && !category) errors.push("Kategoriyani tanlang.");
  if (requireAll && !unit) errors.push("O‘lchov birligini kiriting (masalan 1.5 L).");
  const validImage = /^(https?:\/\/|\/)/i.test(image) || /^data:image\/(?:jpeg|png|webp);base64,[a-z\d+/=]+$/i.test(image);
  if (image && (image.length > 900000 || !validImage)) errors.push("Rasm URL manzili yoki tizimga yuklangan JPEG, PNG yoki WebP rasm bo‘lishi kerak.");

  const { offers, errors: offerErrors } = validateOffers(b.offers);
  errors.push(...offerErrors);

  const nameI18n = textMap(b.nameI18n, 120);
  const descriptionI18n = textMap(b.descriptionI18n, 600);
  return { ok: errors.length === 0, errors, value: { name, category: categories[0] ?? category, categories: categories.length ? categories : (category ? [category] : []), mealType, mealTypes, unit, brand, description, image, sourceLanguage, nameI18n, descriptionI18n, offers } };
}

/* offers an admin may edit: seeded from products.json or added by hand (ingested ones stay read-only) */
export const isManagedOffer = (o) => !o?.adapter || o.adapter === "seed" || o.adapter === "admin";

/* ------------------------------------------------------------------ */
/* Bulk actions                                                        */
/* ------------------------------------------------------------------ */
export const BULK_ACTIONS = ["delete", "category", "stock"];
export const BULK_MAX = 500;

export function validateBulk(body) {
  const b = body && typeof body === "object" ? body : {};
  const action = String(b.action ?? "");
  if (!BULK_ACTIONS.includes(action)) return { ok: false, error: "Noma’lum amal." };
  const raw = Array.isArray(b.slugs) ? b.slugs : [];
  const slugs = [...new Set(raw.filter((s) => typeof s === "string" && s.length > 0 && s.length <= 120))];
  if (!slugs.length) return { ok: false, error: "Hech narsa tanlanmagan." };
  if (slugs.length > BULK_MAX) return { ok: false, error: `Bir vaqtda ${BULK_MAX} tadan ortiq mahsulot tanlab bo‘lmaydi.` };
  const value = { action, slugs };
  if (action === "category") {
    value.category = str(b.category, 60);
    if (!value.category) return { ok: false, error: "Kategoriyani tanlang." };
  }
  if (action === "stock") {
    if (typeof b.inStock !== "boolean") return { ok: false, error: "Mavjudlik holati noto‘g‘ri." };
    value.inStock = b.inStock;
  }
  return { ok: true, value };
}

/* ------------------------------------------------------------------ */
/* CSV export (RFC 4180 quoting + spreadsheet-formula guard)           */
/* ------------------------------------------------------------------ */
export function csvCell(v) {
  let s = v instanceof Date ? v.toISOString() : String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // Excel/Sheets would run it as a formula otherwise
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/* columns: [[key, header], ...]; rows: objects. Returns a string with a UTF-8 BOM so Excel reads Uzbek letters. */
export function toCsv(rows, columns) {
  const head = columns.map(([, h]) => csvCell(h)).join(",");
  const body = rows.map((r) => columns.map(([k]) => csvCell(typeof k === "function" ? k(r) : r[k])).join(","));
  return `\ufeff${[head, ...body].join("\r\n")}\r\n`;
}

/* ------------------------------------------------------------------ */
/* Image URL safety (the server fetches these when checking images)    */
/* ------------------------------------------------------------------ */
export function isPublicHttpUrl(input) {
  let u;
  try { u = new URL(String(input)); } catch { return false; }
  if (u.protocol !== "http:" && u.protocol !== "https:") return false;
  if (u.username || u.password) return false;
  const h = u.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!h || h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan")) return false;
  if (h.includes(":")) return !(h === "::1" || h === "::" || /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || h.startsWith("::ffff:")); // IPv6 loopback / unique-local / link-local / mapped
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
  }
  return true;
}

/* One image probe. `fetchImpl` is injectable for tests. -> { ok, status, reason } */
export async function probeImage(url, { fetchImpl = fetch, timeoutMs = 6000 } = {}) {
  if (!isPublicHttpUrl(url)) return { ok: false, status: 0, reason: "blocked" };
  /* Redirects are followed by hand (max 4) so EVERY hop is checked against isPublicHttpUrl —
   * otherwise a public URL could redirect the server to 127.0.0.1 / 169.254.169.254 / the LAN. */
  const attempt = async (method) => {
    let target = url;
    for (let hop = 0; hop <= 4; hop++) {
      if (!isPublicHttpUrl(target)) return { status: 0, blocked: true, headers: null };
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const res = await fetchImpl(target, { method, redirect: "manual", signal: ctl.signal, headers: { "user-agent": "NarxTop-ImageCheck/1.0", ...(method === "GET" ? { range: "bytes=0-0" } : {}) } });
        try { await res.body?.cancel?.(); } catch { /* ignore */ }
        const loc = res.status >= 300 && res.status < 400 ? res.headers?.get?.("location") : null;
        if (!loc) return res;
        try { target = new URL(loc, target).href; } catch { return { status: 0, blocked: true, headers: null }; }
      } finally { clearTimeout(timer); }
    }
    return { status: 0, tooMany: true, headers: null };
  };
  try {
    let res = await attempt("HEAD");
    if ([400, 403, 405, 501].includes(res.status)) res = await attempt("GET"); // some CDNs refuse HEAD
    if (res.blocked) return { ok: false, status: 0, reason: "blocked" };
    if (res.tooMany) return { ok: false, status: 0, reason: "broken" }; // redirect loop
    if (res.status >= 200 && res.status < 300) {
      const type = String(res.headers?.get?.("content-type") ?? "");
      if (type && !/^image\//i.test(type) && !/octet-stream/i.test(type)) return { ok: false, status: res.status, reason: "not-image" };
      return { ok: true, status: res.status };
    }
    if (res.status === 429 || res.status >= 500) return { ok: false, status: res.status, reason: "unreachable" }; // not the URL's fault: do not auto-remove
    return { ok: false, status: res.status, reason: "broken" };
  } catch {
    return { ok: false, status: 0, reason: "unreachable" };
  }
}
