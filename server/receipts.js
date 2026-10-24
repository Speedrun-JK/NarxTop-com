/* Private purchase receipts. Images are stored separately from metadata and are never public. */
import { randomUUID } from "node:crypto";
import { requireAdmin as defaultRequireAdmin, verifyUser as defaultVerifyUser } from "./auth.js";
import { logAction } from "./admin.js";

const STORES = new Set(["Korzinka", "Havas", "Makro"]);
const LEADERBOARD_STORES = ["Havas", "Korzinka", "Makro"];
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const fail = (res, status, code, message) => res.status(status).json({ success: false, code, message });
const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) { console.error("receipt route failed:", e); if (!res.headersSent) fail(res, 500, "SERVER", "Receipt service error."); }
};

export async function ensureReceiptIndexes(db) {
  await db.collection("receipts").createIndex({ id: 1 }, { unique: true });
  await db.collection("receipts").createIndex({ userId: 1, orderId: 1 }, { unique: true });
  await db.collection("receipts").createIndex({ createdAt: -1, id: -1 });
  await db.collection("receipt_images").createIndex({ receiptId: 1 }, { unique: true });
  await db.collection("user_notifications").createIndex({ userId: 1, createdAt: -1 });
}

export function validateReceiptInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Invalid receipt." };
  const orderId = String(body.orderId ?? "");
  const store = String(body.store ?? "");
  const items = body.items;
  const total = Number(body.total);
  if (!/^[\w-]{8,100}$/.test(orderId)) return { ok: false, error: "Invalid order id." };
  if (!STORES.has(store)) return { ok: false, error: "Choose a supported store." };
  if (!Array.isArray(items) || items.length < 1 || items.length > 100) return { ok: false, error: "Invalid order items." };
  const cleanItems = [];
  for (const item of items) {
    const slug = String(item?.slug ?? "");
    const qty = Number(item?.qty);
    const price = Number(item?.price);
    if (!/^[a-z0-9][a-z0-9-]{0,119}$/i.test(slug) || !Number.isInteger(qty) || qty < 1 || qty > 99 || !Number.isFinite(price) || price < 0 || price > 1_000_000_000) return { ok: false, error: "Invalid order item." };
    /* `cost` is what the line really costs after promotions (multi-buy, bundle, % off). It can only be lower than
     * qty × price; without it the line costs qty × price. */
    const hasCost = item?.cost !== undefined && item?.cost !== null && item?.cost !== "";
    const cost = hasCost ? Number(item.cost) : qty * price;
    if (!Number.isFinite(cost) || cost < 0 || cost > qty * price + 0.01) return { ok: false, error: "Invalid order item." };
    cleanItems.push(hasCost && Math.abs(cost - qty * price) > 0.01 ? { slug, qty, price, cost } : { slug, qty, price });
  }
  const calculated = cleanItems.reduce((sum, item) => sum + lineCost(item), 0);
  if (!Number.isFinite(total) || total < 0 || total > 1_000_000_000 || Math.abs(calculated - total) > 0.01) return { ok: false, error: "Receipt total does not match its items." };

  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(body.image ?? ""));
  if (!match || match[2].length % 4 !== 0) return { ok: false, error: "Upload a JPEG, PNG or WebP receipt image." };
  const bytes = Buffer.from(match[2], "base64");
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString("base64") !== match[2]) return { ok: false, error: "Receipt image must be under 2 MB." };
  const mime = match[1];
  const validMagic = mime === "image/jpeg" ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : mime === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!validMagic) return { ok: false, error: "Receipt image content does not match its file type." };
  return { ok: true, value: { orderId, store, items: cleanItems, total, image: { mime, bytes } } };
}

export function registerReceiptRoutes(app, getDb, deps = {}) {
  const verifyUser = deps.verifyUser ?? defaultVerifyUser;
  const requireAdmin = deps.requireAdmin ?? defaultRequireAdmin;
  const clock = deps.now ?? (() => new Date());
  const receipts = () => getDb().collection("receipts");
  const images = () => getDb().collection("receipt_images");
  const notifications = () => getDb().collection("user_notifications");
  const limit = new Map();
  const reviewLimit = new Map();

  const requireUser = async (req, res, next) => {
    try {
      const r = await verifyUser(req);
      if (!r.user?.id) return fail(res, r.status ?? 401, "AUTH", r.message ?? "Sign in to continue.");
      req.user = r.user; next();
    } catch { fail(res, 500, "SERVER", "Receipt service error."); }
  };

  app.post("/api/receipts", requireUser, wrap(async (req, res) => {
    const valid = validateReceiptInput(req.body);
    if (!valid.ok) return fail(res, 400, "BAD_RECEIPT", valid.error);
    const { orderId, store, items, total, image } = valid.value;
    const userId = String(req.user.id);
    const existing = await receipts().findOne({ userId, orderId });
    if (existing) return res.json({ success: true, receipt: publicReceipt(existing), duplicate: true });
    const nowMs = +clock();
    const bucket = limit.get(userId) ?? { at: nowMs, count: 0 };
    if (nowMs - bucket.at >= 60 * 60 * 1000) { bucket.at = nowMs; bucket.count = 0; }
    if (bucket.count >= 5) return fail(res, 429, "RATE_LIMIT", "Too many receipt uploads. Try again later.");
    bucket.count += 1; limit.set(userId, bucket);

    const id = randomUUID(), imageId = randomUUID(), now = clock();
    const names = await productNames(getDb, items.map((i) => i.slug));
    const namedItems = items.map((i) => (names.get(i.slug) ? { ...i, name: names.get(i.slug) } : i));
    const meta = req.user.user_metadata ?? {};
    const row = {
      id, userId, email: String(req.user.email ?? "").toLowerCase(), name: String(meta.full_name ?? meta.name ?? "").slice(0, 120),
      store, items: namedItems, total, createdAt: now, status: "pending", reviewedBy: null, reviewedAt: null, note: "", imageId, orderId,
    };
    await images().insertOne({ _id: imageId, receiptId: id, userId, contentType: image.mime, bytes: image.bytes, createdAt: now });
    try {
      await receipts().insertOne(row);
    } catch (e) {
      await images().deleteOne({ _id: imageId });
      if (e?.code === 11000) {
        const prior = await receipts().findOne({ userId, orderId });
        if (prior) return res.json({ success: true, receipt: publicReceipt(prior), duplicate: true });
      }
      throw e;
    }
    res.status(201).json({ success: true, receipt: publicReceipt(row), duplicate: false });
  }));

  app.get("/api/receipts/mine", requireUser, wrap(async (req, res) => {
    const mine = await receipts().find({ userId: String(req.user.id) }).sort({ createdAt: -1 }).limit(100).toArray();
    res.json({ success: true, receipts: mine.map(publicReceipt) });
  }));

  app.get("/api/admin/receipts", requireAdmin, wrap(async (req, res) => {
    const status = ["pending", "approved", "rejected"].includes(req.query.status) ? req.query.status : "all";
    const store = STORES.has(req.query.store) ? req.query.store : "all";
    const since = validDate(req.query.since), until = validDate(req.query.until, true);
    const search = String(req.query.search ?? "").trim().toLowerCase().slice(0, 120);
    const pageSize = Math.max(1, Math.min(50, Number(req.query.limit) || 25));
    // Keep cursor traversal lossless even when multiple receipts share a timestamp; rows remain metadata-only.
    let rows = await receipts().find({}).sort({ createdAt: -1, id: -1 }).toArray();
    rows = rows.filter((r) => (status === "all" || r.status === status) && (store === "all" || r.store === store)
      && (!since || +new Date(r.createdAt) >= +since) && (!until || +new Date(r.createdAt) <= +until)
      && (!search || `${r.email ?? ""} ${r.name ?? ""} ${r.userId ?? ""}`.toLowerCase().includes(search)));
    const total = rows.length;
    const cursor = String(req.query.cursor ?? "");
    if (cursor) { const index = rows.findIndex((r) => r.id === cursor); if (index >= 0) rows = rows.slice(index + 1); }
    const page = rows.slice(0, pageSize);
    res.json({ success: true, receipts: page.map(publicReceipt), total, nextCursor: rows.length > pageSize ? page.at(-1)?.id ?? null : null });
  }));

  /* Purchase history for the admin: every saved check (receipt) with who bought it and what was in it, plus per-buyer and
   * per-product roll-ups. Rejected checks are left out of the roll-ups unless the status filter asks for them. */
  app.get("/api/admin/purchases", requireAdmin, wrap(async (req, res) => {
    const status = ["pending", "approved", "rejected"].includes(req.query.status) ? req.query.status : "all";
    const store = STORES.has(req.query.store) ? req.query.store : "all";
    const since = validDate(req.query.since), until = validDate(req.query.until, true);
    const search = String(req.query.search ?? "").trim().toLowerCase().slice(0, 120);
    const pageSize = Math.max(1, Math.min(100, Number(req.query.limit) || 30));
    const all = await receipts().find({}).sort({ createdAt: -1, id: -1 }).toArray();
    const names = await productNames(getDb, [...new Set(all.flatMap((r) => (r.items ?? []).map((i) => i.slug)))]);
    const itemName = (i) => i.name || names.get(i.slug) || i.slug;
    let rows = all.filter((r) => (status === "all" ? r.status !== "rejected" : r.status === status) && (store === "all" || r.store === store)
      && (!since || +new Date(r.createdAt) >= +since) && (!until || +new Date(r.createdAt) <= +until)
      && (!search || `${r.email ?? ""} ${r.name ?? ""} ${r.userId ?? ""} ${(r.items ?? []).map(itemName).join(" ")}`.toLowerCase().includes(search)));

    const buyers = new Map(), products = new Map();
    let spent = 0, units = 0;
    for (const r of rows) {
      spent += r.total;
      const b = buyers.get(r.userId) ?? { userId: r.userId, email: r.email ?? "", name: r.name ?? "", orders: 0, spent: 0, units: 0, lastAt: r.createdAt, stores: new Set(), items: new Map() };
      b.orders += 1; b.spent += r.total; b.stores.add(r.store);
      if (+new Date(r.createdAt) > +new Date(b.lastAt)) b.lastAt = r.createdAt;
      for (const i of r.items ?? []) {
        units += i.qty; b.units += i.qty;
        const bi = b.items.get(i.slug) ?? { slug: i.slug, name: itemName(i), qty: 0, spent: 0 };
        bi.qty += i.qty; bi.spent += lineCost(i); b.items.set(i.slug, bi);
        const p = products.get(i.slug) ?? { slug: i.slug, name: itemName(i), qty: 0, spent: 0, buyers: new Set(), stores: new Map() };
        p.qty += i.qty; p.spent += lineCost(i); p.buyers.add(r.userId); p.stores.set(r.store, (p.stores.get(r.store) ?? 0) + i.qty); products.set(i.slug, p);
      }
      buyers.set(r.userId, b);
    }
    const total = rows.length;
    const cursor = String(req.query.cursor ?? "");
    if (cursor) { const index = rows.findIndex((r) => r.id === cursor); if (index >= 0) rows = rows.slice(index + 1); }
    const page = rows.slice(0, pageSize);
    res.json({
      success: true, total, nextCursor: rows.length > pageSize ? page.at(-1)?.id ?? null : null,
      summary: { orders: total, spent, units, buyers: buyers.size, products: products.size, avgOrder: total ? Math.round(spent / total) : 0 },
      orders: page.map((r) => ({ ...publicReceipt(r), items: (r.items ?? []).map((i) => ({ ...i, name: itemName(i) })) })),
      buyers: [...buyers.values()].sort((a, b) => b.spent - a.spent).slice(0, 100).map((b) => ({ ...b, stores: [...b.stores], items: [...b.items.values()].sort((x, y) => y.spent - x.spent).slice(0, 12) })),
      products: [...products.values()].sort((a, b) => b.qty - a.qty).slice(0, 100).map((p) => ({ slug: p.slug, name: p.name, qty: p.qty, spent: p.spent, buyers: p.buyers.size, stores: Object.fromEntries(p.stores) })),
    });
  }));

  app.get("/api/admin/leaderboard", requireAdmin, wrap(async (req, res) => {
    const search = String(req.query.search ?? "").trim().toLowerCase().slice(0, 120);
    const rows = await receipts().find({}).sort({ createdAt: -1 }).toArray();
    const buyers = new Map();
    for (const receipt of rows) {
      if (receipt.status === "rejected" || !receipt.userId || !STORES.has(receipt.store)) continue;
      const userId = String(receipt.userId);
      const buyer = buyers.get(userId) ?? {
        userId, email: String(receipt.email ?? ""), name: String(receipt.name ?? ""), orders: 0, spent: 0,
        lastAt: receipt.createdAt,
        stores: Object.fromEntries(LEADERBOARD_STORES.map((store) => [store, { orders: 0, spent: 0 }])),
      };
      if (!buyer.email && receipt.email) buyer.email = String(receipt.email);
      if (!buyer.name && receipt.name) buyer.name = String(receipt.name);
      buyer.orders += 1;
      buyer.spent += Number(receipt.total) || 0;
      buyer.stores[receipt.store].orders += 1;
      buyer.stores[receipt.store].spent += Number(receipt.total) || 0;
      if (+new Date(receipt.createdAt) > +new Date(buyer.lastAt)) buyer.lastAt = receipt.createdAt;
      buyers.set(userId, buyer);
    }
    const ids = [...buyers.keys()];
    if (ids.length) {
      const users = await getDb().collection("users").find({ _id: { $in: ids } }).toArray();
      for (const user of users) {
        const buyer = buyers.get(String(user._id));
        if (!buyer) continue;
        buyer.email = String(user.email ?? buyer.email);
        buyer.name = [user.name, user.secondName].filter(Boolean).join(" ") || String(user.username ?? buyer.name);
      }
    }
    const leaderboard = [...buyers.values()].map((buyer) => ({
      ...buyer,
      name: buyer.name || buyer.email.split("@")[0] || buyer.userId,
      storeCount: LEADERBOARD_STORES.filter((store) => buyer.stores[store].orders > 0).length,
    })).filter((buyer) => !search || `${buyer.name} ${buyer.email}`.toLowerCase().includes(search))
      .sort((a, b) => b.storeCount - a.storeCount || b.orders - a.orders || b.spent - a.spent || a.name.localeCompare(b.name));
    res.set("Cache-Control", "private, no-store");
    res.json({ success: true, stores: LEADERBOARD_STORES, leaderboard });
  }));

  app.get("/api/admin/receipts/:id/image", requireAdmin, wrap(async (req, res) => {
    const receipt = await receipts().findOne({ id: req.params.id });
    if (!receipt) return fail(res, 404, "NOT_FOUND", "Receipt not found.");
    const image = await images().findOne({ _id: receipt.imageId });
    if (!image) return fail(res, 404, "IMAGE_NOT_FOUND", "Receipt image not found.");
    res.set("Cache-Control", "private, no-store");
    res.set("Content-Type", image.contentType);
    const bytes = toBuffer(image.bytes);
    if (!bytes.length) return fail(res, 404, "IMAGE_NOT_FOUND", "Receipt image not found.");
    res.send(bytes);
  }));

  app.post("/api/admin/receipts/:id/review", requireAdmin, wrap(async (req, res) => {
    const status = req.body?.status;
    const note = String(req.body?.note ?? "").trim();
    if (!new Set(["approved", "rejected"]).has(status) || note.length > 500) return fail(res, 400, "BAD_REVIEW", "Choose approve or reject and keep the note under 500 characters.");
    const row = await receipts().findOne({ id: req.params.id });
    if (!row) return fail(res, 404, "NOT_FOUND", "Receipt not found.");
    if (row.status !== "pending") return fail(res, 409, "ALREADY_REVIEWED", "This receipt has already been reviewed.");
    const nowMs = +clock(), adminId = String(req.admin?.id ?? req.admin?.email ?? "admin");
    const bucket = reviewLimit.get(adminId) ?? { at: nowMs, count: 0 };
    if (nowMs - bucket.at >= 60_000) { bucket.at = nowMs; bucket.count = 0; }
    if (bucket.count >= 120) return fail(res, 429, "RATE_LIMIT", "Please wait before reviewing more receipts.");
    bucket.count += 1; reviewLimit.set(adminId, bucket);
    const now = clock();
    const reviewedBy = String(req.admin?.email ?? "admin");
    const changed = await receipts().updateOne({ id: row.id, status: "pending" }, { $set: { status, reviewedBy, reviewedAt: now, note } });
    if (!changed.modifiedCount) return fail(res, 409, "ALREADY_REVIEWED", "This receipt has already been reviewed.");
    const notice = { id: randomUUID(), userId: row.userId, kind: "receipt_review", receiptId: row.id, status, note, createdAt: now, readAt: null };
    await notifications().insertOne(notice);
    await logAction(getDb(), req.admin, `receipt.${status}`, row.id, `${row.store} · ${row.email || row.userId}`);
    res.json({ success: true, receipt: publicReceipt({ ...row, status, reviewedBy, reviewedAt: now, note }) });
  }));
}

/* Product names for a set of slugs, best effort: a missing catalog collection just means the slug is shown instead. */
async function productNames(getDb, slugs) {
  const out = new Map();
  if (!slugs.length) return out;
  try {
    const rows = await getDb().collection("products").find({ slug: { $in: slugs } }).toArray();
    for (const p of rows) if (p?.slug && p.name) out.set(p.slug, String(p.name).slice(0, 160));
  } catch { /* names are optional */ }
  return out;
}

function validDate(value, endOfDay = false) {
  const date = value ? new Date(value) : null;
  if (!date || !Number.isFinite(+date)) return null;
  if (endOfDay && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) date.setHours(23, 59, 59, 999);
  return date;
}
/* What a stored line cost: promo-adjusted `cost` when present, otherwise qty × price. */
const lineCost = (item) => (Number.isFinite(item?.cost) ? item.cost : item.qty * item.price);

/* MongoDB hands stored bytes back as a BSON Binary (not a Buffer); Express would send that as JSON, not as an image. */
export function toBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value && typeof value.length === "function" && value.buffer) return Buffer.from(value.buffer.subarray(0, value.length()));
  if (value && value.buffer instanceof Uint8Array) return Buffer.from(value.buffer);
  if (value && typeof value.value === "function") { const v = value.value(); if (v instanceof Uint8Array) return Buffer.from(v); }
  return Buffer.alloc(0);
}
function publicReceipt(row) {
  return {
    id: row.id, userId: row.userId, email: row.email ?? "", name: row.name ?? "", store: row.store, items: row.items,
    total: row.total, createdAt: row.createdAt, status: row.status, reviewedBy: row.reviewedBy ?? null,
    reviewedAt: row.reviewedAt ?? null, note: row.note ?? "", orderId: row.orderId,
  };
}
