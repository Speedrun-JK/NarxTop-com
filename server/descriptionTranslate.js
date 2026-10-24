/* Product-description translations.
 *
 * Product names and descriptions can be translated into Uzbek, Russian and English and are stored
 * on the product document as `nameI18n` / `descriptionI18n`.
 * Only product descriptions go through here — site-wide UI translations live in shared/translations*.js.
 *
 * Provider: Google Cloud Translation (set GOOGLE_TRANSLATE_API_KEY) or, without a key, Google's keyless web
 * endpoint. Set DESCRIPTION_TRANSLATE=off to disable (Uzbek only is stored). A translation failure never blocks a save:
 * the missing language stays empty and the backfill (below) retries it later. */

export const DESC_LANGS = ["uz", "ru", "en"];
const TIMEOUT_MS = 8000;

export const cleanDesc = (v) => (typeof v === "string" ? v.trim() : "");

async function withTimeout(fetchImpl, url, init = {}) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try { return await fetchImpl(url, { ...init, signal: ctl.signal }); } finally { clearTimeout(timer); }
}

/* Translate between supported product languages. Returns "" when the provider fails. */
export async function translateText(text, target, { source = "uz", fetchImpl = globalThis.fetch, apiKey = process.env.GOOGLE_TRANSLATE_API_KEY } = {}) {
  const src = cleanDesc(text);
  if (!src || target === source) return src;
  if (!DESC_LANGS.includes(source) || !DESC_LANGS.includes(target)) return "";
  if (String(process.env.DESCRIPTION_TRANSLATE || "").toLowerCase() === "off" || typeof fetchImpl !== "function") return "";
  try {
    if (apiKey) {
      const res = await withTimeout(fetchImpl, `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: src, source, target, format: "text" }),
      });
      if (!res.ok) return "";
      const data = await res.json();
      return cleanDesc(data?.data?.translations?.[0]?.translatedText);
    }
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${source}&tl=${target}&dt=t&q=${encodeURIComponent(src)}`;
    const res = await withTimeout(fetchImpl, url);
    if (!res.ok) return "";
    const data = await res.json();
    return cleanDesc(Array.isArray(data?.[0]) ? data[0].map((seg) => (Array.isArray(seg) ? seg[0] ?? "" : "")).join("") : "");
  } catch {
    return "";
  }
}

/* Build { uz, ru, en } for an Uzbek description. `prev` is the product's existing descriptionI18n: when its Uzbek text
 * is unchanged the Russian/English versions that already exist are reused, so editing a price never re-translates. */
export async function buildDescriptionI18n(description, prev = null, { translate = translateText, source = "uz" } = {}) {
  const original = cleanDesc(description);
  if (!original) return { uz: "", ru: "", en: "" };
  const same = prev && cleanDesc(prev[source]) === original;
  const out = Object.fromEntries(DESC_LANGS.map((lang) => [lang, same ? cleanDesc(prev[lang]) : ""]));
  out[source] = original;
  await Promise.all(DESC_LANGS.filter((lang) => lang !== source && !out[lang]).map(async (lang) => { out[lang] = await translate(original, lang, { source }); }));
  return out;
}

export function cleanProductI18n(value, maxLength = 600) {
  const out = Object.fromEntries(DESC_LANGS.map((lang) => [lang, cleanDesc(value?.[lang]).slice(0, maxLength)]));
  return out;
}

export const i18nComplete = (i18n, description, source = "uz") => {
  const original = cleanDesc(description);
  return !original || (cleanDesc(i18n?.[source]) === original && DESC_LANGS.every((lang) => !!cleanDesc(i18n?.[lang])));
};

/* What the public catalog exposes: only translations that still belong to the current Uzbek text. */
export function publicDescriptionI18n(doc) {
  const source = DESC_LANGS.includes(doc?.sourceLanguage) ? doc.sourceLanguage : "uz";
  const original = cleanDesc(doc?.description);
  const i = doc?.descriptionI18n;
  if (!original || !i || cleanDesc(i[source]) !== original) return undefined;
  return Object.fromEntries(DESC_LANGS.map((lang) => [lang, cleanDesc(i[lang])]));
}

/* Fill in missing / outdated translations for products that already exist (seeded products, products created before
 * this feature, or ones whose translation failed on save). Sequential and capped, so it is gentle on the provider. */
export async function backfillDescriptionTranslations(db, { translate = translateText, invalidate = () => {}, limit = 300, log = () => {} } = {}) {
  const docs = await db.collection("products").find({ description: { $ne: "" } }, { projection: { slug: 1, description: 1, descriptionI18n: 1, sourceLanguage: 1 } }).limit(2000).toArray();
  const todo = docs.filter((d) => cleanDesc(d.description) && !i18nComplete(d.descriptionI18n, d.description, DESC_LANGS.includes(d.sourceLanguage) ? d.sourceLanguage : "uz")).slice(0, limit);
  let done = 0;
  for (const d of todo) {
    const source = DESC_LANGS.includes(d.sourceLanguage) ? d.sourceLanguage : "uz";
    const i18n = await buildDescriptionI18n(d.description, d.descriptionI18n, { translate, source });
    if (!i18n.ru && !i18n.en) continue; // provider unreachable: try again on the next start
    await db.collection("products").updateOne({ slug: d.slug, description: d.description }, { $set: { descriptionI18n: i18n } });
    done++;
  }
  if (done) { invalidate(); log(`description translations: ${done} product(s) updated`); }
  return { checked: docs.length, pending: todo.length, updated: done };
}

/* One-off cleanup: the old per-product description translations that were stored in the `translations` collection
 * (keys `prod|<slug>|desc`). Product NAMES and every other site translation are left alone. */
export async function removeStoredDescriptionTranslations(db) {
  const col = db.collection("translations");
  const docs = await col.find({}).toArray();
  let removed = 0;
  for (const doc of docs) {
    const keys = Object.keys(doc.messages ?? {}).filter((k) => /^prod\|.+\|desc$/.test(k));
    if (!keys.length) continue;
    await col.updateOne({ _id: doc._id }, { $unset: Object.fromEntries(keys.map((k) => [`messages.${k}`, ""])) });
    removed += keys.length;
  }
  return removed;
}
