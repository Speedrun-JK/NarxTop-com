/* Role-guarded staff API + user sync. CEOs, Admins and Workers receive separate permissions.
 *
 *   POST   /api/users/sync                   any signed-in user -> upsert into MongoDB `users`
 *   GET    /api/admin/me                     -> { admin, email, version, database }
 *   GET    /api/admin/stats                  dashboard numbers
 *   GET    /api/admin/products               every product with its prices
 *   POST   /api/admin/products               add a product (+ prices)
 *   PUT    /api/admin/products/:slug         edit a product (+ prices)
 *   DELETE /api/admin/products/:slug         remove a product, its prices and history
 *   POST   /api/admin/products/:slug/duplicate   copy a product (editable prices only)
 *   POST   /api/admin/products/bulk          { action: delete | category | stock, slugs, category?, inStock? }
 *   POST   /api/admin/images/check           probe product image URLs ({ slugs?, offset? })
 *   POST   /api/admin/images/clear           blank the image of the given products ({ slugs })
 *   GET    /api/admin/users                  everyone who signed in
 *   GET    /api/admin/users/:id               Admin / CEO: private profile details
 *   PUT    /api/admin/users/:id/role          CEO: { role: user | admin | worker }
 *   DELETE /api/admin/users/:id               Admin / CEO: { confirm } — permanently delete an account and its data
 *   GET    /api/admin/messages               contact-form messages
 *   PUT    /api/admin/messages/:id           { read: true|false }
 *   POST   /api/admin/messages/read-all      mark everything as read
 *   DELETE /api/admin/messages/:id           delete a message
 *   GET    /api/admin/activity               admin action log
 *   GET    /api/admin/export/:what           CSV download: products | users | messages
 *   POST   /api/admin/seed                   import products.json (adds missing; {overwrite:true} refreshes)
 *
 * Related admin-only APIs live in server/plus.js (/api/plus/admin/*) and server/storeLogos.js (/api/admin/store-logos/*).
 *
 * Anything that changes products is read by /api/catalog, so it shows up on the public site (the 30 s cache is cleared). */
import { describeProduct } from "../shared/core/matching.js";
import { ADMIN_API_VERSION } from "../shared/adminVersion.js";
import { adminEmails, isCeoEmail, resolveAdminRole, roleForUserRecord, requireAdmin as defaultRequireAdmin, requireCatalogManager as defaultRequireCatalogManager, requireCeo as defaultRequireCeo, verifyUser as defaultVerifyUser } from "./auth.js";
import { isManagedOffer, probeImage, slugify, toCsv, validateBulk, validateProduct } from "./adminValidate.js";
import { seedIfEmpty, seedProducts } from "./seed.js";
import { backfillDescriptionTranslations, buildDescriptionI18n, cleanProductI18n, translateText } from "./descriptionTranslate.js";
import { attachProductImage } from "./productImages.js";
import { DEFAULT_MAX_ECONOMY } from "../shared/core/maxEconomy.js";
import { purgeUserData } from "./account.js";
import { countryOfPhone, formatPhone, normalizePhone } from "../shared/core/phone.js";

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) { console.error(e); if (!res.headersSent) res.status(500).json({ success: false, message: `Server xatosi: ${e.message}` }); }
};
const iso = (d) => (d instanceof Date ? d.toISOString() : d ?? null);
const today = () => new Date().toISOString().slice(0, 10);

const metaPhone = (meta) => normalizePhone(meta?.phone ?? meta?.phone_number ?? "");
const userRow = (u) => {
  const role = roleForUserRecord(u);
  const providers = [...new Set(Array.isArray(u.providers) ? u.providers : [u.provider || (u.googleSub ? "google" : "email")])];
  return { phone: u.phone ?? "", phoneText: formatPhone(u.phone), phoneCountry: countryOfPhone(u.phone)?.iso ?? "", id: String(u._id), email: u.email ?? "", name: u.name ?? "", secondName: u.secondName ?? "", username: u.username ?? "", avatar: u.avatar ?? u.googlePicture ?? null, provider: u.provider ?? "email", providers, createdAt: iso(u.createdAt), lastSeenAt: iso(u.lastSeenAt), emailConfirmedAt: iso(u.emailConfirmedAt), signIns: u.signIns ?? 0, role, staffPath: u.staffPath ?? null, isAdmin: ["admin", "superadmin", "ceo"].includes(role), isWorker: role === "worker", isCeo: role === "ceo" };
};

const messageRow = (m) => ({
  id: String(m._id), name: m.name ?? "", email: m.email ?? "", message: m.message ?? "",
  page: m.meta?.page ?? "", lang: m.meta?.lang ?? "", viewport: m.meta?.viewport ?? "", userAgent: m.meta?.userAgent ?? "",
  userId: m.userId ?? null, emailStatus: m.emailStatus ?? "", read: m.read === true, createdAt: iso(m.createdAt),
});

const activityRow = (a) => ({ id: String(a._id), ts: iso(a.ts), by: a.by ?? "", action: a.action, target: a.target ?? null, detail: a.detail ?? null });

function productView(p, offers) {
  return {
    slug: p.slug, name: p.name, nameI18n: p.nameI18n ?? null, sourceLanguage: p.sourceLanguage ?? "uz", brand: p.brand ?? "", category: p.category ?? "", categories: p.categories ?? [p.category].filter(Boolean), mealType: p.mealType ?? "", mealTypes: p.mealTypes?.length ? p.mealTypes : (p.mealType ? [p.mealType] : []), unit: p.unit ?? "", image: p.image ?? "", description: p.description ?? "", descriptionI18n: p.descriptionI18n ?? null,
    source: p.source ?? "ingest", createdAt: iso(p.createdAt), updatedAt: iso(p.updatedAt ?? p.createdAt),
    offers: offers.map((o) => ({ store: o.store, price: o.price, oldPrice: o.oldPrice ?? null, inStock: o.inStock !== false, managed: isManagedOffer(o), updatedAt: iso(o.updatedAt) })).sort((a, b) => a.price - b.price),
  };
}

export async function ensureAdminIndexes(db) {
  await db.collection("users").createIndex({ lastSeenAt: -1 });
  await db.collection("users").createIndex({ isAdmin: 1 });
  await db.collection("admin_log").createIndex({ ts: -1 });
  await db.collection("contact_messages").createIndex({ createdAt: -1 });
  await db.collection("site_settings").createIndex({ key: 1 }, { unique: true });
}

/* Audit trail: who changed what. A logging failure must never break the action itself. */
export async function logAction(db, admin, action, target = null, detail = null) {
  try {
    await db.collection("admin_log").insertOne({ ts: new Date(), by: String(admin?.email ?? ""), action, target, ...(detail ? { detail } : {}) });
  } catch (e) { console.warn("admin log failed:", e.message); }
}

async function uniqueSlug(col, name) {
  const base = slugify(name) || `product-${Date.now().toString(36)}`;
  let slug = base, i = 2;
  while (await col.findOne({ _id: slug }, { projection: { _id: 1 } })) slug = `${base}-${i++}`;
  return slug;
}

/* Writes the editable prices of one product; leaves prices ingested from supermarket APIs untouched. */
async function applyOffers(db, slug, wanted) {
  const offers = db.collection("offers"), history = db.collection("price_history");
  const existing = await offers.find({ slug }).toArray();
  const mine = existing.filter(isManagedOffer);
  const keep = new Set(wanted.map((o) => o.store.toLowerCase()));
  const drop = mine.filter((o) => !keep.has(String(o.store).toLowerCase())).map((o) => o._id);
  const now = new Date();
  const operations = [];
  const historyRows = [];
  for (const o of wanted) {
    const prev = mine.find((e) => String(e.store).toLowerCase() === o.store.toLowerCase());
    const _id = prev?._id ?? `${slug}|${o.store}|*`;
    operations.push({ updateOne: { filter: { _id }, update: { $set: { slug, store: o.store, price: o.price, oldPrice: o.oldPrice ?? null, inStock: o.inStock, promos: prev?.promos ?? [], adapter: "admin", updatedAt: now } }, upsert: true } });
    if (!prev || prev.price !== o.price) historyRows.push({ slug, store: o.store, price: o.price, ts: now });
  }
  if (typeof offers.bulkWrite === "function") {
    const writes = [];
    if (drop.length) writes.push(offers.deleteMany({ _id: { $in: drop } }));
    if (operations.length) writes.push(offers.bulkWrite(operations, { ordered: false }));
    if (historyRows.length) writes.push(history.insertMany(historyRows, { ordered: false }));
    await Promise.all(writes);
    return;
  }
  if (drop.length) await offers.deleteMany({ _id: { $in: drop } });
  for (const operation of operations) {
    const item = operation.updateOne;
    await offers.updateOne(item.filter, item.update, item.upsert ? { upsert: true } : undefined);
  }
  if (historyRows.length) for (const row of historyRows) await history.insertOne(row);
}

async function removeProducts(db, slugs) {
  await Promise.all([
    db.collection("products").deleteMany({ _id: { $in: slugs } }),
    db.collection("offers").deleteMany({ slug: { $in: slugs } }),
    db.collection("price_history").deleteMany({ slug: { $in: slugs } }),
  ]);
}

/* Runs `worker` over `items` with at most `limit` in flight. */
async function pool(items, limit, worker) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) { const i = next++; out[i] = await worker(items[i], i); }
  }));
  return out;
}

const IMAGE_CHECK_BATCH = 120;

/**
 * @param deps optional overrides (used by tests): { invalidate, requireAdmin, verifyUser, fetchImpl }
 */
export function registerAdminRoutes(app, getDb, deps = {}) {
  const db = () => getDb();
  const invalidate = deps.invalidate ?? (() => {});
  const requireAdmin = deps.requireAdmin ?? defaultRequireAdmin;
  const verifyUser = deps.verifyUser ?? defaultVerifyUser;
  const requireCatalogManager = deps.requireCatalogManager ?? deps.requireAdmin ?? defaultRequireCatalogManager;
  const requireCeo = deps.requireCeo ?? deps.requireAdmin ?? defaultRequireCeo;
  const translate = deps.translate ?? translateText; // (uzbekText, "ru" | "en") => string; replaced in tests
  const admin = [requireAdmin];
  const catalogManager = [requireCatalogManager];
  const ceoOnly = [requireCeo];
  const ceo = [requireCeo];
  const readMaxEconomy = async () => (await db().collection("site_settings").findOne({ key: "maxEconomy" }))?.value ?? DEFAULT_MAX_ECONOMY;
  app.get("/api/site/max-economy", wrap(async (_req, res) => {
    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    res.json({ success: true, settings: await readMaxEconomy() });
  }));
  app.put("/api/admin/max-economy", ...admin, (_req, res) => {
    res.status(410).json({ success: false, code: "MAX_ECONOMY_DISABLED", message: "Biggest Sale product management has been disabled." });
  });
  /* ---- every signed-in user is remembered in MongoDB ---- */
  app.post("/api/users/sync", wrap(async (req, res) => {
    const r = await verifyUser(req);
    if (!r.user) return res.status(r.status).json({ success: false, message: r.message });
    const u = r.user, meta = u.user_metadata ?? {};
    const now = new Date();
    await db().collection("users").updateOne(
      { _id: u.id },
      {
        $set: { email: String(u.email ?? "").toLowerCase(), name: meta.full_name || meta.name || "", username: meta.username || meta.user_name || meta.preferred_username || meta.nickname || "", avatar: meta.avatar_url || meta.picture || null, provider: u.app_metadata?.provider ?? "email", phone: metaPhone(meta), lastSeenAt: now },
        $setOnInsert: { createdAt: u.created_at ? new Date(u.created_at) : now },
        $inc: { signIns: 1 },
      },
      { upsert: true }
    );
    res.json({ success: true });
  }));

  /* Authenticated role check used by the navbar; privileged API routes still verify the role independently. */
  app.get("/api/admin/access", wrap(async (req, res) => {
    const r = await verifyUser(req);
    if (!r.user?.id) return res.status(r.status ?? 401).json({ success: false, message: r.message ?? "Unauthorized" });
    const u = r.user;
    const role = await resolveAdminRole(u, db());
    res.set("Cache-Control", "no-store");
    const staffPath = role === "user" ? null : "/admin-" + u.id;
    if (staffPath) {
      await db().collection("users").updateOne(
        { _id: u.id },
        { $set: { staffPath }, $setOnInsert: { email: String(u.email ?? "").toLowerCase(), name: u.user_metadata?.full_name || u.user_metadata?.name || "", createdAt: new Date() } },
        { upsert: true },
      );
    }
    res.json({ success: true, role, isAdmin: role !== "user", canManageAdmins: ["ceo", "superadmin"].includes(role), staffPath });
  }));

  app.get("/api/admin/me", ...catalogManager, (req, res) => res.json({ success: true, admin: true, role: req.adminRole, email: req.admin.email, version: ADMIN_API_VERSION, database: process.env.MONGODB_DB_NAME || "narxitop" }));

  /* ------------------------------ stats ------------------------------ */
  app.get("/api/admin/stats", ...admin, wrap(async (req, res) => {
    const d = db(), day = new Date(Date.now() - 86400000), week = new Date(Date.now() - 7 * 86400000), fortnight = new Date(Date.now() - 14 * 86400000);
    const [products, offers, users, activeToday, newWeek, withOffers, noImage, cats, stores, recentProducts, recentUsers, unread, outOfStock, priceChanges, signupRows, recentActivity] = await Promise.all([
      d.collection("products").countDocuments({}),
      d.collection("offers").countDocuments({}),
      d.collection("users").countDocuments({}),
      d.collection("users").countDocuments({ lastSeenAt: { $gte: day } }),
      d.collection("users").countDocuments({ createdAt: { $gte: week } }),
      d.collection("offers").aggregate([{ $group: { _id: "$slug" } }]).toArray(), // (distinct is not allowed by the Stable API strict mode)
      d.collection("products").countDocuments({ $or: [{ image: "" }, { image: null }, { image: { $exists: false } }] }),
      d.collection("products").aggregate([{ $group: { _id: "$category", n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray(),
      d.collection("offers").aggregate([{ $group: { _id: "$store", n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray(),
      d.collection("products").find({}).sort({ createdAt: -1 }).limit(6).toArray(),
      d.collection("users").find({}).sort({ lastSeenAt: -1 }).limit(6).toArray(),
      ["ceo", "superadmin"].includes(req.adminRole) ? d.collection("contact_messages").countDocuments({ read: { $ne: true } }) : Promise.resolve(0),
      d.collection("offers").countDocuments({ inStock: false }),
      d.collection("price_history").countDocuments({ ts: { $gte: week } }),
      d.collection("users").find({ createdAt: { $gte: fortnight } }).limit(5000).toArray(),
      d.collection("admin_log").find({}).sort({ ts: -1 }).limit(6).toArray(),
    ]);
    const liveSlugs = new Set(withOffers.map((x) => x._id));
    const buckets = new Map();
    for (let i = 13; i >= 0; i--) buckets.set(new Date(Date.now() - i * 86400000).toISOString().slice(0, 10), 0);
    for (const u of signupRows) { const k = iso(u.createdAt)?.slice(0, 10); if (buckets.has(k)) buckets.set(k, buckets.get(k) + 1); }
    res.json({
      success: true,
      counts: { products, offers, users, activeToday, newWeek, live: liveSlugs.size, hidden: Math.max(0, products - liveSlugs.size), noImage, unread, outOfStock, priceChanges },
      categories: cats.map((c) => ({ name: c._id ?? "—", count: c.n })),
      stores: stores.map((s) => ({ name: s._id ?? "—", count: s.n })),
      signups: [...buckets].map(([date, count]) => ({ date, count })),
      recentProducts: recentProducts.map((p) => ({ slug: p.slug, name: p.name, image: p.image ?? "", category: p.category ?? "", createdAt: iso(p.createdAt) })),
      recentUsers: recentUsers.map(userRow),
      recentActivity: recentActivity.map(activityRow),
      database: process.env.MONGODB_DB_NAME || "narxitop",
    });
  }));

  /* ---------------------------- products ---------------------------- */
  app.post("/api/admin/translate-product", ...catalogManager, wrap(async (req, res) => {
    const source = String(req.body?.source ?? "");
    const targets = [...new Set((Array.isArray(req.body?.targets) ? req.body.targets : []).map(String))];
    const name = String(req.body?.name ?? "").trim().slice(0, 120);
    const description = String(req.body?.description ?? "").trim().slice(0, 600);
    if (!["uz", "ru", "en"].includes(source) || !targets.length || targets.some((lang) => !["uz", "ru", "en"].includes(lang) || lang === source)) {
      return res.status(400).json({ success: false, message: "Choose a valid source language and target language." });
    }
    const translations = Object.fromEntries(await Promise.all(targets.map(async (target) => [target, {
      name: name ? await translate(name, target, { source }) : "",
      description: description ? await translate(description, target, { source }) : "",
    }])));
    if (targets.some((target) => (name && !translations[target].name) || (description && !translations[target].description))) {
      return res.status(503).json({ success: false, message: "Automatic translation is temporarily unavailable. Check the translation service settings and try again." });
    }
    res.json({ success: true, translations });
  }));

  app.get("/api/admin/products", ...catalogManager, wrap(async (req, res) => {
    await seedIfEmpty(db()); // only ever fills a brand-new database (see seed.js)
    const [products, offers] = await Promise.all([db().collection("products").find({}).limit(5000).toArray(), db().collection("offers").find({}).limit(50000).toArray()]);
    const by = new Map();
    for (const o of offers) (by.get(o.slug) ?? by.set(o.slug, []).get(o.slug)).push(o);
    res.json({ success: true, products: products.map((p) => productView(p, by.get(p.slug) ?? [])).sort((a, b) => String(a.name).localeCompare(String(b.name))) });
  }));

  app.post("/api/admin/products", ...catalogManager, wrap(async (req, res) => {
    const v = validateProduct(req.body);
    if (!v.ok) return res.status(400).json({ success: false, message: v.errors[0], errors: v.errors });
    const col = db().collection("products");
    const slug = await uniqueSlug(col, v.value.name);
    const d = describeProduct(v.value.name, v.value.unit);
    const now = new Date();
    const sourceLanguage = v.value.sourceLanguage;
    const hasNameI18n = Object.prototype.hasOwnProperty.call(req.body ?? {}, "nameI18n");
    const hasDescriptionI18n = Object.prototype.hasOwnProperty.call(req.body ?? {}, "descriptionI18n");
    const nameI18n = hasNameI18n ? cleanProductI18n(v.value.nameI18n, 120) : { uz: "", ru: "", en: "" };
    const descriptionI18n = hasDescriptionI18n
      ? cleanProductI18n(v.value.descriptionI18n)
      : await buildDescriptionI18n(v.value.description, null, { translate, source: sourceLanguage });
    nameI18n[sourceLanguage] = v.value.name;
    descriptionI18n[sourceLanguage] = v.value.description;
    const createdProduct = { _id: slug, slug, name: v.value.name, nameI18n, brand: v.value.brand || d.brand || null, category: v.value.category, categories: v.value.categories, mealType: v.value.mealType, mealTypes: v.value.mealTypes, unit: v.value.unit, size: d.size ?? null, canonicalKey: d.canonicalKey, image: v.value.image, description: v.value.description, descriptionI18n, sourceLanguage, source: "admin", createdBy: req.admin.email, createdAt: now, updatedAt: now };
    await col.insertOne(createdProduct);
    await Promise.all([
      attachProductImage(db(), v.value.image, slug),
      applyOffers(db(), slug, v.value.offers),
      logAction(db(), req.admin, "product.create", slug, v.value.name),
    ]);
    invalidate();
    const offers = await db().collection("offers").find({ slug }).toArray();
    res.status(201).json({ success: true, product: productView(createdProduct, offers) });
  }));

  /* bulk + duplicate are registered BEFORE the ":slug" routes so "bulk" is never taken for a slug */
  app.post("/api/admin/products/bulk", ...catalogManager, wrap(async (req, res) => {
    const v = validateBulk(req.body);
    if (!v.ok) return res.status(400).json({ success: false, message: v.error });
    const { action, slugs, category, inStock } = v.value;
    const found = (await db().collection("products").find({ _id: { $in: slugs } }).toArray()).map((p) => p._id);
    if (!found.length) return res.status(404).json({ success: false, message: "Tanlangan mahsulotlar topilmadi." });
    const now = new Date();
    if (action === "delete") {
      await removeProducts(db(), found);
    } else if (action === "category") {
      await db().collection("products").updateMany({ _id: { $in: found } }, { $set: { category, updatedAt: now, updatedBy: req.admin.email } });
    } else {
      const mine = (await db().collection("offers").find({ slug: { $in: found } }).toArray()).filter(isManagedOffer).map((o) => o._id);
      if (mine.length) await db().collection("offers").updateMany({ _id: { $in: mine } }, { $set: { inStock, updatedAt: now } });
      await db().collection("products").updateMany({ _id: { $in: found } }, { $set: { updatedAt: now, updatedBy: req.admin.email } });
    }
    await logAction(db(), req.admin, `bulk.${action}`, null, `${found.length} ta mahsulot${action === "category" ? ` → ${category}` : action === "stock" ? ` → ${inStock ? "mavjud" : "tugagan"}` : ""}`);
    invalidate();
    res.json({ success: true, affected: found.length, missing: slugs.length - found.length });
  }));

  app.post("/api/admin/products/:slug/duplicate", ...catalogManager, wrap(async (req, res) => {
    const from = String(req.params.slug);
    const col = db().collection("products");
    const cur = await col.findOne({ _id: from });
    if (!cur) return res.status(404).json({ success: false, message: "Mahsulot topilmadi." });
    const name = `${cur.name} (nusxa)`.slice(0, 120);
    const slug = await uniqueSlug(col, name);
    const now = new Date();
    const rest = { ...cur };
    for (const k of ["_id", "slug", "createdAt", "updatedAt", "createdBy", "updatedBy"]) delete rest[k];
    const sourceLanguage = cur.sourceLanguage || ["uz", "ru", "en"].find((lang) => cur.nameI18n?.[lang] === cur.name) || "uz";
    rest.nameI18n = { uz: "", ru: "", en: "", ...(cur.nameI18n ?? {}), [sourceLanguage]: name };
    for (const lang of ["uz", "ru", "en"]) if (lang !== sourceLanguage) rest.nameI18n[lang] = "";
    await col.insertOne({ ...rest, _id: slug, slug, name, source: "admin", createdBy: req.admin.email, createdAt: now, updatedAt: now });
    const copied = (await db().collection("offers").find({ slug: from }).toArray()).filter(isManagedOffer)
      .map((o) => ({ store: o.store, price: o.price, oldPrice: o.oldPrice ?? undefined, inStock: o.inStock !== false }));
    await applyOffers(db(), slug, copied);
    await logAction(db(), req.admin, "product.duplicate", slug, `${cur.name} dan nusxa`);
    invalidate();
    const offers = await db().collection("offers").find({ slug }).toArray();
    res.status(201).json({ success: true, product: productView(await col.findOne({ _id: slug }), offers) });
  }));

  app.put("/api/admin/products/:slug", ...catalogManager, wrap(async (req, res) => {
    const slug = String(req.params.slug);
    const col = db().collection("products");
    const cur = await col.findOne({ _id: slug });
    if (!cur) return res.status(404).json({ success: false, message: "Mahsulot topilmadi." });
    const v = validateProduct(req.body);
    if (!v.ok) return res.status(400).json({ success: false, message: v.errors[0], errors: v.errors });
    const d = describeProduct(v.value.name, v.value.unit);
    const sourceLanguage = ["uz", "ru", "en"].includes(req.body?.sourceLanguage) ? v.value.sourceLanguage : cur.sourceLanguage || "uz";
    const hasNameI18n = Object.prototype.hasOwnProperty.call(req.body ?? {}, "nameI18n");
    const hasDescriptionI18n = Object.prototype.hasOwnProperty.call(req.body ?? {}, "descriptionI18n");
    const nameI18n = hasNameI18n ? cleanProductI18n(v.value.nameI18n, 120) : cleanProductI18n(cur.nameI18n, 120);
    if (!hasNameI18n && cur.name !== v.value.name) {
      for (const lang of ["uz", "ru", "en"]) nameI18n[lang] = "";
    }
    const descriptionI18n = hasDescriptionI18n
      ? cleanProductI18n(v.value.descriptionI18n)
      : await buildDescriptionI18n(v.value.description, cur.descriptionI18n, { translate, source: sourceLanguage });
    nameI18n[sourceLanguage] = v.value.name;
    descriptionI18n[sourceLanguage] = v.value.description;
    await col.updateOne({ _id: slug }, { $set: { name: v.value.name, nameI18n, brand: v.value.brand || d.brand || null, category: v.value.category, categories: v.value.categories, mealType: v.value.mealType, mealTypes: v.value.mealTypes, unit: v.value.unit, size: d.size ?? null, canonicalKey: d.canonicalKey, image: v.value.image, description: v.value.description, descriptionI18n, sourceLanguage, updatedAt: new Date(), updatedBy: req.admin.email } });
    await Promise.all([
      attachProductImage(db(), v.value.image, slug),
      applyOffers(db(), slug, v.value.offers),
      logAction(db(), req.admin, "product.update", slug, v.value.name),
    ]);
    invalidate();
    const [savedProduct, offers] = await Promise.all([
      col.findOne({ _id: slug }),
      db().collection("offers").find({ slug }).toArray(),
    ]);
    res.json({ success: true, product: productView(savedProduct, offers) });
  }));

  app.delete("/api/admin/products/:slug", ...catalogManager, wrap(async (req, res) => {
    const slug = String(req.params.slug);
    const cur = await db().collection("products").findOne({ _id: slug });
    if (!cur) return res.status(404).json({ success: false, message: "Mahsulot topilmadi." });
    await removeProducts(db(), [slug]);
    await logAction(db(), req.admin, "product.delete", slug, cur.name);
    invalidate();
    res.json({ success: true });
  }));

  app.post("/api/admin/seed", ...catalogManager, wrap(async (req, res) => {
    const overwrite = req.body?.overwrite === true;
    if (req.adminRole === "worker" && overwrite) return res.status(403).json({ success: false, message: "Workers may add missing products but cannot replace the full catalog." });
    const result = await seedProducts(db(), { overwrite });
    await logAction(db(), req.admin, overwrite ? "seed.overwrite" : "seed.import", null, `${result.productsAdded} ta mahsulot, ${result.offersAdded} ta narx`);
    invalidate();
    backfillDescriptionTranslations(db(), { translate, invalidate }).catch((e) => console.warn("description translation backfill failed:", e.message)); // runs in the background
    res.json({ success: true, result });
  }));

  /* ------------------------------ images ------------------------------ */
  app.post("/api/admin/images/check", ...catalogManager, wrap(async (req, res) => {
    const only = Array.isArray(req.body?.slugs) ? new Set(req.body.slugs.filter((s) => typeof s === "string")) : null;
    const offset = Math.max(0, Math.floor(Number(req.body?.offset) || 0));
    const all = (await db().collection("products").find({}).limit(5000).toArray())
      .filter((p) => typeof p.image === "string" && /^https?:\/\//i.test(p.image) && (!only || only.has(p.slug)))
      .sort((a, b) => String(a.slug).localeCompare(String(b.slug)));
    const batch = all.slice(offset, offset + IMAGE_CHECK_BATCH);
    const results = await pool(batch, 8, async (p) => ({ p, r: await probeImage(p.image, { fetchImpl: deps.fetchImpl }) }));
    const row = ({ p, r }) => ({ slug: p.slug, name: p.name, image: p.image, status: r.status, reason: r.reason ?? "" });
    res.json({
      success: true, total: all.length, checked: batch.length, next: offset + batch.length < all.length ? offset + batch.length : null,
      okCount: results.filter(({ r }) => r.ok).length,
      broken: results.filter(({ r }) => !r.ok && ["broken", "not-image", "blocked"].includes(r.reason)).map(row),
      unreachable: results.filter(({ r }) => !r.ok && r.reason === "unreachable").map(row),
    });
  }));

  app.post("/api/admin/images/clear", ...catalogManager, wrap(async (req, res) => {
    const slugs = Array.isArray(req.body?.slugs) ? [...new Set(req.body.slugs.filter((s) => typeof s === "string" && s))].slice(0, 500) : [];
    if (!slugs.length) return res.status(400).json({ success: false, message: "Hech narsa tanlanmagan." });
    const r = await db().collection("products").updateMany({ _id: { $in: slugs } }, { $set: { image: "", updatedAt: new Date(), updatedBy: req.admin.email } });
    const cleared = r.modifiedCount ?? slugs.length;
    await logAction(db(), req.admin, "images.clear", null, `${cleared} ta rasm manzili olib tashlandi`);
    invalidate();
    res.json({ success: true, cleared });
  }));

  /* ------------------------------ users ------------------------------ */
  app.get("/api/admin/users", ...admin, wrap(async (req, res) => {
    const col = db().collection("users");
    const rows = await col.find({}).sort({ lastSeenAt: -1 }).limit(5000).toArray();
    res.json({ success: true, users: rows.map(userRow) });
  }));

  app.get("/api/admin/users/:id", ...admin, wrap(async (req, res) => {
    const id = String(req.params.id ?? "");
    if (!/^[a-f\d-]{16,64}$/i.test(id)) return res.status(400).json({ success: false, message: "Foydalanuvchi ID noto‘g‘ri." });
    const user = await db().collection("users").findOne({ _id: id });
    if (!user) return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi." });
    const row = userRow(user);
    const avatar = await db().collection("avatars").findOne({ _id: id });
    if (avatar?.data) row.avatar = `data:${avatar.contentType};base64,${Buffer.from(avatar.data.value(true)).toString("base64")}`;
    res.set("Cache-Control", "no-store");
    res.json({ success: true, user: { ...row, fullName: [row.name, row.secondName].filter(Boolean).join(" "), authMethods: row.providers, username: user.username ?? "", googlePicture: user.googlePicture ?? null, createdAt: iso(user.createdAt), lastSeenAt: iso(user.lastSeenAt), adminUpdatedAt: iso(user.adminUpdatedAt) } });
  }));

  const changeUserRole = wrap(async (req, res) => {
    const userId = String(req.params.id ?? "");
    const role = req.body?.role ?? (typeof req.body?.admin === "boolean" ? (req.body.admin ? "admin" : "user") : null);
    if (!/^[a-f\d-]{16,64}$/i.test(userId) || !["user", "admin", "superadmin", "worker"].includes(role)) {
      return res.status(400).json({ success: false, message: "Foydalanuvchi yoki ruxsat darajasi noto‘g‘ri." });
    }
    const users = db().collection("users");
    const target = await users.findOne({ _id: userId });
    if (!target) return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi." });
    if (roleForUserRecord(target) === "superadmin" && !req.adminIsCeo && role !== "superadmin") {
      return res.status(403).json({ success: false, message: "Superadmin ruxsatini faqat CEO olib tashlashi mumkin." });
    }
    if ((role === "ceo" || adminEmails().includes(String(target.email ?? "").trim().toLowerCase())) && !req.adminIsCeo) {
      return res.status(403).json({ success: false, message: "Faqat CEO CEO ruxsatlarini boshqarishi mumkin." });
    }
    if (adminEmails().includes(String(target.email ?? "").trim().toLowerCase())) {
      return res.status(409).json({ success: false, message: "Asosiy adminni bu sahifadan o‘zgartirib bo‘lmaydi." });
    }
    if (role === "ceo") return res.status(400).json({ success: false, message: "CEO roli faqat server allow-list orqali beriladi." });
    await users.updateOne({ _id: userId }, { $set: { adminRole: role, isAdmin: role === "admin" || role === "superadmin", adminUpdatedAt: new Date(), adminUpdatedBy: String(req.admin?.email ?? "") } });
    if (role === "user") deps.closeChatUser?.(userId, "Staff access removed");
    await logAction(db(), req.admin, `role.${role}`, userId, target.email ?? target.username ?? null);
    res.json({ success: true, user: userRow({ ...target, adminRole: role, isAdmin: role === "admin" || role === "superadmin" }) });
  });
  app.put("/api/admin/users/:id/role", ...ceo, changeUserRole);
  app.put("/api/admin/users/:id/admin", ...ceo, changeUserRole); // compatibility for older clients

  /* Permanently removes an account and its private data from MongoDB.
   * Guards: the caller must type the account's email / username (`confirm`); CEOs and configured CEO emails are protected,
   * and only a CEO may delete an Admin. */
  app.delete("/api/admin/users/:id", ...admin, wrap(async (req, res) => {
    const userId = String(req.params.id ?? "");
    if (!/^[a-f\d-]{16,64}$/i.test(userId)) return res.status(400).json({ success: false, message: "Foydalanuvchi noto‘g‘ri." });
    const users = db().collection("users");
    const target = await users.findOne({ _id: userId });
    if (!target) return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi." });
    const targetRole = roleForUserRecord(target);
    const callerEmail = String(req.admin?.email ?? "").trim().toLowerCase();
    if (targetRole === "ceo" || isCeoEmail(target.email)) {
      return res.status(403).json({ success: false, message: "CEO akkauntini o‘chirib bo‘lmaydi." });
    }
    if (String(req.admin?.id ?? "") === userId || (callerEmail && callerEmail === String(target.email ?? "").trim().toLowerCase())) {
      return res.status(409).json({ success: false, message: "O‘z akkauntingizni bu yerdan o‘chira olmaysiz." });
    }
    if (targetRole === "superadmin" && !req.adminIsCeo) {
      return res.status(403).json({ success: false, message: "Superadminni faqat CEO o‘chira oladi." });
    }
    if (targetRole === "admin" && !["ceo", "superadmin"].includes(req.adminRole)) {
      return res.status(403).json({ success: false, message: "Bu akkauntni faqat superadmin yoki CEO o‘chira oladi." });
    }
    const expected = [target.email, target.username].map((v) => String(v ?? "").trim().toLowerCase()).filter(Boolean);
    const typed = String(req.body?.confirm ?? "").trim().toLowerCase();
    if (!typed || (expected.length && !expected.includes(typed))) {
      return res.status(400).json({ success: false, message: "Tasdiqlash matni mos kelmadi." });
    }
    const removed = await purgeUserData(db(), userId, { withMessages: true });
    deps.closeChatUser?.(userId, "Account removed");
    await logAction(db(), req.admin, "user.delete", userId, `${target.email ?? target.username ?? ""} (${targetRole})`);
    res.json({ success: true, removed });
  }));

  /* ----------------------------- messages ----------------------------- */
  const loadMessages = () => db().collection("contact_messages").find({}).sort({ createdAt: -1 }).limit(2000).toArray();
  /* ids are matched as strings against the stored _id (an ObjectId), so no ObjectId import is needed here */
  const findMessage = async (id) => (await loadMessages()).find((m) => String(m._id) === String(id));

  app.get("/api/admin/messages", ...ceoOnly, wrap(async (req, res) => {
    res.json({ success: true, messages: (await loadMessages()).map(messageRow) });
  }));

  app.post("/api/admin/messages/read-all", ...ceoOnly, wrap(async (req, res) => {
    const r = await db().collection("contact_messages").updateMany({ read: { $ne: true } }, { $set: { read: true } });
    res.json({ success: true, updated: r.modifiedCount ?? 0 });
  }));

  app.put("/api/admin/messages/:id", ...ceoOnly, wrap(async (req, res) => {
    if (typeof req.body?.read !== "boolean") return res.status(400).json({ success: false, message: "read: true yoki false bo‘lishi kerak." });
    const m = await findMessage(req.params.id);
    if (!m) return res.status(404).json({ success: false, message: "Xabar topilmadi." });
    await db().collection("contact_messages").updateOne({ _id: m._id }, { $set: { read: req.body.read } });
    res.json({ success: true });
  }));

  app.delete("/api/admin/messages/:id", ...ceoOnly, wrap(async (req, res) => {
    const m = await findMessage(req.params.id);
    if (!m) return res.status(404).json({ success: false, message: "Xabar topilmadi." });
    await db().collection("contact_messages").deleteOne({ _id: m._id });
    await logAction(db(), req.admin, "message.delete", String(m._id), m.email ?? null);
    res.json({ success: true });
  }));

  /* ----------------------------- activity ----------------------------- */
  app.get("/api/admin/activity", ...admin, wrap(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const rows = await db().collection("admin_log").find({}).sort({ ts: -1 }).limit(limit).toArray();
    res.json({ success: true, items: rows.map(activityRow) });
  }));

  /* ------------------------------ export ------------------------------ */
  app.get("/api/admin/export/:what", (req, res, next) => {
    const guard = req.params.what === "products" ? requireCatalogManager : req.params.what === "messages" ? requireCeo : requireAdmin;
    guard(req, res, next);
  }, wrap(async (req, res) => {
    const what = String(req.params.what);
    let csv;
    if (what === "products") {
      const [products, offers] = await Promise.all([db().collection("products").find({}).limit(5000).toArray(), db().collection("offers").find({}).limit(50000).toArray()]);
      const by = new Map();
      for (const o of offers) (by.get(o.slug) ?? by.set(o.slug, []).get(o.slug)).push(o);
      const rows = products.map((p) => productView(p, by.get(p.slug) ?? [])).sort((a, b) => String(a.name).localeCompare(String(b.name)));
      csv = toCsv(rows, [
        ["slug", "slug"], ["name", "Nomi"], ["brand", "Brend"], ["category", "Kategoriya"], ["unit", "O‘lchov"],
        [(r) => r.offers.map((o) => `${o.store}: ${o.price}${o.inStock ? "" : " (tugagan)"}`).join("; "), "Narxlar (UZS)"],
        [(r) => r.offers.find((o) => o.inStock)?.price ?? "", "Eng arzon (UZS)"],
        ["image", "Rasm"], ["description", "Tavsif"], ["updatedAt", "Yangilangan"],
      ]);
    } else if (what === "users") {
      const rows = (await db().collection("users").find({}).sort({ lastSeenAt: -1 }).limit(5000).toArray()).map(userRow);
      csv = toCsv(rows, [["id", "ID"], ["email", "Gmail"], ["name", "Ism"], ["phone", "Telefon"], ["phoneCountry", "Davlat"], ["provider", "Usul"], ["createdAt", "Qo‘shilgan"], ["lastSeenAt", "Oxirgi faollik"], ["signIns", "Kirishlar"]]);
    } else if (what === "messages") {
      const rows = (await loadMessages()).map(messageRow);
      csv = toCsv(rows, [["createdAt", "Sana"], ["name", "Ism"], ["email", "Gmail"], ["message", "Xabar"], ["page", "Sahifa"], ["lang", "Til"], ["read", "O‘qilgan"], ["emailStatus", "Email holati"]]);
    } else {
      return res.status(404).json({ success: false, message: "Noma’lum eksport turi." });
    }
    res.set("Content-Type", "text/csv; charset=utf-8");
    res.set("Content-Disposition", `attachment; filename="narxtop-${what}-${today()}.csv"`);
    res.set("Cache-Control", "no-store");
    res.send(csv);
  }));
}
