import test from "node:test";
import assert from "node:assert/strict";
import { createFakeApp, createFakeDb } from "./helpers/fakes.js";
import { registerAdminRoutes } from "../admin.js";
import { backfillDescriptionTranslations, buildDescriptionI18n, publicDescriptionI18n, removeStoredDescriptionTranslations, translateText } from "../descriptionTranslate.js";
import { toBuffer } from "../receipts.js";

const fake = async (text, lang) => `[${lang}] ${text}`;

test("an Uzbek description becomes uz + ru + en; the Uzbek text is kept as written", async () => {
  const i = await buildDescriptionI18n("  Yangi uzilgan olma  ", null, { translate: fake });
  assert.deepEqual(i, { uz: "Yangi uzilgan olma", ru: "[ru] Yangi uzilgan olma", en: "[en] Yangi uzilgan olma" });
  assert.deepEqual(await buildDescriptionI18n("   ", null, { translate: fake }), { uz: "", ru: "", en: "" });
});

test("unchanged text is not translated again; a failed language is retried", async () => {
  let calls = 0;
  const counting = async (t, l) => { calls++; return `[${l}] ${t}`; };
  const first = await buildDescriptionI18n("Sut", null, { translate: counting });
  assert.equal(calls, 2);
  await buildDescriptionI18n("Sut", first, { translate: counting });
  assert.equal(calls, 2, "same Uzbek text → reuse");
  const half = { uz: "Sut", ru: "", en: "milk" };
  const fixed = await buildDescriptionI18n("Sut", half, { translate: counting });
  assert.equal(calls, 3, "only the missing language is requested");
  assert.deepEqual(fixed, { uz: "Sut", ru: "[ru] Sut", en: "milk" });
  const changed = await buildDescriptionI18n("Qaymoq", first, { translate: counting });
  assert.equal(changed.ru, "[ru] Qaymoq");
});

test("translateText: Google API response shapes, failures and the off switch", async () => {
  const free = async () => ({ ok: true, json: async () => [[["Привет, ", "Salom, "], ["мир", "dunyo"]], null, "uz"] });
  assert.equal(await translateText("Salom, dunyo", "ru", { fetchImpl: free, apiKey: "" }), "Привет, мир");
  const keyed = async (url, init) => { assert.match(url, /translation\.googleapis\.com.*key=K%201/); assert.equal(JSON.parse(init.body).source, "uz"); return { ok: true, json: async () => ({ data: { translations: [{ translatedText: "Hello" }] } }) }; };
  assert.equal(await translateText("Salom", "en", { fetchImpl: keyed, apiKey: "K 1" }), "Hello");
  assert.equal(await translateText("Salom", "en", { fetchImpl: async () => { throw new Error("offline"); }, apiKey: "" }), "");
  assert.equal(await translateText("Salom", "en", { fetchImpl: async () => ({ ok: false }), apiKey: "" }), "");
  assert.equal(await translateText("Salom", "uz", { fetchImpl: free }), "Salom", "Uzbek is never sent to the provider");
  process.env.DESCRIPTION_TRANSLATE = "off";
  assert.equal(await translateText("Salom", "ru", { fetchImpl: free, apiKey: "" }), "");
  delete process.env.DESCRIPTION_TRANSLATE;
});

test("the public catalog only exposes translations that match the current Uzbek text", () => {
  assert.deepEqual(publicDescriptionI18n({ description: "Sut", descriptionI18n: { uz: "Sut", ru: "Молоко", en: "Milk" } }), { uz: "Sut", ru: "Молоко", en: "Milk" });
  assert.equal(publicDescriptionI18n({ description: "Qaymoq", descriptionI18n: { uz: "Sut", ru: "Молоко", en: "Milk" } }), undefined);
  assert.equal(publicDescriptionI18n({ description: "", descriptionI18n: { uz: "", ru: "", en: "" } }), undefined);
  assert.equal(publicDescriptionI18n({ description: "Sut" }), undefined);
});

const ADMIN = { id: "a", email: "boss@gmail.com", user_metadata: {}, app_metadata: {} };
function setup() {
  const app = createFakeApp(), db = createFakeDb();
  const requireAdmin = (req, res, next) => { req.admin = ADMIN; next(); };
  registerAdminRoutes(app, () => db, { requireAdmin, verifyUser: async () => ({ user: ADMIN }), translate: fake });
  return { db, api: (m, u, body) => app.call(m, u, { body, headers: { authorization: "Bearer admin" } }) };
}
const body = (o = {}) => ({ name: "Olma 1kg", category: "Mevalar", unit: "1 kg", offers: [{ store: "Korzinka", price: 12000 }], ...o });

test("saving a product stores uz/ru/en descriptions in MongoDB; editing only re-translates when the text changes", async () => {
  const { api, db } = setup();
  const created = await api("POST", "/api/admin/products", body({ description: "Shirin qizil olma" }));
  assert.equal(created.status, 201);
  const slug = created.body.product.slug;
  assert.deepEqual(db.collection("products").docs[0].descriptionI18n, { uz: "Shirin qizil olma", ru: "[ru] Shirin qizil olma", en: "[en] Shirin qizil olma" });
  assert.equal(created.body.product.descriptionI18n.ru, "[ru] Shirin qizil olma");

  // price edit, same description → translations untouched (even if they were hand-corrected)
  db.collection("products").docs[0].descriptionI18n.en = "Sweet red apple";
  const same = await api("PUT", `/api/admin/products/${slug}`, body({ description: "Shirin qizil olma", offers: [{ store: "Korzinka", price: 11000 }] }));
  assert.equal(same.body.product.descriptionI18n.en, "Sweet red apple");

  const edited = await api("PUT", `/api/admin/products/${slug}`, body({ description: "Yangi hosil olmasi" }));
  assert.deepEqual(edited.body.product.descriptionI18n, { uz: "Yangi hosil olmasi", ru: "[ru] Yangi hosil olmasi", en: "[en] Yangi hosil olmasi" });

  const cleared = await api("PUT", `/api/admin/products/${slug}`, body({ description: "" }));
  assert.deepEqual(cleared.body.product.descriptionI18n, { uz: "", ru: "", en: "" });
});

test("a failing translator never blocks saving; backfill fills the gap later", async () => {
  const app = createFakeApp(), db = createFakeDb();
  registerAdminRoutes(app, () => db, { requireAdmin: (req, res, next) => { req.admin = ADMIN; next(); }, verifyUser: async () => ({ user: ADMIN }), translate: async () => "" });
  const res = await app.call("POST", "/api/admin/products", { body: body({ description: "Shirin olma" }), headers: {} });
  assert.equal(res.status, 201);
  assert.equal(db.collection("products").docs[0].descriptionI18n.ru, "");
  let invalidated = 0;
  const out = await backfillDescriptionTranslations(db, { translate: fake, invalidate: () => invalidated++ });
  assert.equal(out.updated, 1);
  assert.equal(invalidated, 1);
  assert.equal(db.collection("products").docs[0].descriptionI18n.ru, "[ru] Shirin olma");
  assert.equal((await backfillDescriptionTranslations(db, { translate: fake })).pending, 0, "nothing left to do");
});

test("backfill covers products with no translations or an outdated Uzbek text, and skips empty descriptions", async () => {
  const db = createFakeDb();
  await db.collection("products").insertOne({ _id: "a", slug: "a", description: "Bir" });
  await db.collection("products").insertOne({ _id: "b", slug: "b", description: "Ikki", descriptionI18n: { uz: "Eski", ru: "x", en: "y" } });
  await db.collection("products").insertOne({ _id: "c", slug: "c", description: "" });
  const out = await backfillDescriptionTranslations(db, { translate: fake });
  assert.equal(out.updated, 2);
  assert.equal(db.collection("products").docs.find((d) => d.slug === "b").descriptionI18n.en, "[en] Ikki");
  assert.equal(db.collection("products").docs.find((d) => d.slug === "c").descriptionI18n, undefined);
});

test("old stored product-description translations are removed; names and site translations stay", async () => {
  const db = createFakeDb();
  await db.collection("translations").insertOne({ _id: "ru", lang: "ru", messages: { "prod|milk|desc": "Молоко", "prod|milk|name": "Молоко 1 л", "nav|home": "Главная" } });
  const removed = await removeStoredDescriptionTranslations(db);
  assert.equal(removed, 1);
  assert.deepEqual(db.collection("translations").docs[0].messages, { "prod|milk|name": "Молоко 1 л", "nav|home": "Главная" });
});

test("MongoDB Binary bytes are turned back into a Buffer", () => {
  class Binary { constructor(b) { this.buffer = Uint8Array.from(b, (x) => x); this.position = b.length; } length() { return this.position; } }
  const padded = new Binary([0xff, 0xd8, 0xff]); padded.buffer = Uint8Array.from([0xff, 0xd8, 0xff, 0, 0, 0, 0, 0]);
  assert.deepEqual([...toBuffer(padded)], [0xff, 0xd8, 0xff]);
  assert.deepEqual([...toBuffer(Buffer.from([1, 2]))], [1, 2]);
  assert.deepEqual([...toBuffer(new Uint8Array([3]))], [3]);
  assert.equal(toBuffer(undefined).length, 0);
});
