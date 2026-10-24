/* NarxTop Plus API.
 *
 *   GET  /api/plus/plan                       public: plan name/price/benefits + whether payments are live
 *   GET  /api/plus/me                         signed-in: my subscription + my gift records
 *   POST /api/plus/trial                      signed-in: claim the one-time launch trial (once per account)
 *   POST /api/plus/checkout                   signed-in: closed (503) until a Click merchant account is connected
 *
 *   GET  /api/plus/admin/overview             admin: plan, every subscription, user directory, gift records
 *   PUT  /api/plus/admin/plan                 admin: { price, description, features[] }
 *   POST /api/plus/admin/gift                 admin: { userId, unit: days|months, amount } — grant or extend access
 *   POST /api/plus/admin/gifts/:id/issue      admin: mark a supermarket gift as handed out
 *   DELETE /api/admin/subscriptions/revoke    admin: { userId } — revoke NarxTop Plus access
 *
 * Premium administration is reserved for the configured CEO; server/auth.js checks the role on each request.
 * Collections: plus_subscriptions (one row per user), plus_settings ({key:"plan"}), plus_gift_events.
 * Business rules (month maths, gift planning, validation) are pure functions in shared/core/plus.js.
 *
 * Errors carry a stable `code` so the UI can show them in the visitor's language. */
import { requireCeo as defaultRequireCeo, verifyUser as defaultVerifyUser } from "./auth.js";
import { logAction } from "./admin.js";
import { DEFAULT_PLAN, extendExpiry, isPlusActive, planGiftEvents, remainingDays, validateGiftInput, validatePlanInput } from "../shared/core/plus.js";
import { randomUUID } from "node:crypto";
import { ObjectId } from "mongodb";

const wrap = (fn) => async (req, res) => {
  try { await fn(req, res); } catch (e) { console.error(e); if (!res.headersSent) res.status(500).json({ success: false, code: "SERVER", message: "Premium service error" }); }
};
const fail = (res, status, code, message, extra = {}) => res.status(status).json({ success: false, code, message, ...extra });

const iso = (d) => (d instanceof Date ? d.toISOString() : d ?? null);
const subRow = (s, now = Date.now()) => s ? {
  userId: s.userId, email: s.email ?? "", name: s.name ?? "", username: s.username ?? "", status: s.status, source: s.source ?? "", trialUsed: s.trialUsed === true,
  startedAt: iso(s.startedAt), expiresAt: iso(s.expiresAt), updatedAt: iso(s.updatedAt),
  revokedAt: iso(s.revokedAt), revokedBy: s.revokedBy ?? null,
  active: isPlusActive(s, now), daysLeft: remainingDays(s, now),
} : null;
const giftRow = (g) => ({
  id: String(g._id), userId: g.userId, email: g.email ?? "", name: g.name ?? "", period: g.period, store: g.store, status: g.status,
  createdAt: iso(g.createdAt), dueAt: iso(g.dueAt), issuedAt: iso(g.issuedAt), issuedBy: g.issuedBy ?? null,
});

export async function ensurePlusIndexes(db) {
  await db.collection("plus_subscriptions").createIndex({ userId: 1 }, { unique: true });
  await db.collection("plus_gift_events").createIndex({ userId: 1, createdAt: -1 });
  await db.collection("plus_gift_events").createIndex({ issuedAt: 1, createdAt: -1, _id: -1 });
  await db.collection("user_notifications").createIndex({ id: 1 }, { unique: true });
  await db.collection("user_notifications").createIndex({ userId: 1, createdAt: -1 });
}

/**
 * @param deps optional overrides (used by tests): { requireCeo, requireAdmin, verifyUser, rand, now }
 */
export function registerPlusRoutes(app, getDb, deps = {}) {
  const db = () => getDb();
  const requireAdmin = deps.requireCeo ?? deps.requireAdmin ?? defaultRequireCeo;
  const verifyUser = deps.verifyUser ?? defaultVerifyUser;
  const clock = deps.now ?? (() => new Date());
  const subs = () => db().collection("plus_subscriptions");
  const settings = () => db().collection("plus_settings");
  const gifts = () => db().collection("plus_gift_events");
  const notices = () => db().collection("user_notifications");

  const getPlan = async () => ({ ...DEFAULT_PLAN, ...((await settings().findOne({ key: "plan" }))?.value ?? {}), name: "NarxTop Premium" });

  const requireUser = async (req, res, next) => {
    try {
      const r = await verifyUser(req);
      if (!r.user?.id) return fail(res, r.status ?? 401, "AUTH", r.message ?? "Sign in to continue.");
      req.user = r.user;
      next();
    } catch (e) {
      console.error("plus auth failed:", e.message);
      fail(res, 500, "SERVER", "Premium service error");
    }
  };
  const admin = [requireAdmin];

  /* ------------------------------- public ------------------------------- */
  app.get("/api/plus/plan", wrap(async (req, res) => {
    res.json({ success: true, plan: await getPlan(), paymentsReady: false });
  }));

  /* ------------------------------ signed-in ----------------------------- */
  app.get("/api/plus/me", requireUser, wrap(async (req, res) => {
    const [sub, mine, plan, myNotices] = await Promise.all([
      subs().findOne({ userId: req.user.id }),
      gifts().find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(24).toArray(),
      getPlan(),
      notices().find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50).toArray(),
    ]);
    res.json({ success: true, subscription: subRow(sub, +clock()), gifts: mine.map(giftRow).sort((a, b) => a.period - b.period), notifications: myNotices, trialMonths: plan.trialMonths, paymentsReady: false });
  }));

  /* User-owned notification endpoints. Only this caller's notification can be marked read. */
  const readLimit = new Map();
  app.get("/api/notifications/mine", requireUser, wrap(async (req, res) => {
    const rows = await notices().find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50).toArray();
    res.json({ success: true, notifications: rows });
  }));
  app.post("/api/notifications/:id/read", requireUser, wrap(async (req, res) => {
    const nowMs = +clock();
    const key = String(req.user.id);
    const bucket = readLimit.get(key) ?? { at: nowMs, count: 0 };
    if (nowMs - bucket.at > 60_000) { bucket.at = nowMs; bucket.count = 0; }
    bucket.count += 1; readLimit.set(key, bucket);
    if (bucket.count > 60) return fail(res, 429, "RATE_LIMIT", "Please wait before updating more notifications.");
    const updated = await notices().updateOne({ id: req.params.id, userId: req.user.id, readAt: null }, { $set: { readAt: clock() } });
    if (!updated.modifiedCount) {
      const existing = await notices().findOne({ id: req.params.id, userId: req.user.id });
      if (!existing) return fail(res, 404, "NOT_FOUND", "Notification not found.");
    }
    res.json({ success: true });
  }));

  app.post("/api/plus/trial", requireUser, wrap(async (req, res) => {
    const plan = await getPlan();
    const prior = await subs().findOne({ userId: req.user.id });
    if (prior?.status === "revoked") return fail(res, 409, "SUBSCRIPTION_REVOKED", "NarxTop Premium was revoked by an administrator.", { subscription: subRow(prior, +clock()) });
    if (prior?.trialUsed) return fail(res, 409, "TRIAL_USED", "The launch trial has already been used on this account.", { subscription: subRow(prior, +clock()) });

    const now = clock();
    const meta = req.user.user_metadata ?? {};
    const expiresAt = extendExpiry(prior?.expiresAt, { unit: "months", amount: plan.trialMonths }, now);
    const row = {
      userId: req.user.id, email: String(req.user.email ?? "").toLowerCase(), name: meta.full_name || meta.name || prior?.name || "", username: meta.username || meta.user_name || meta.preferred_username || meta.nickname || prior?.username || "",
      status: "active", source: prior && isPlusActive(prior, +now) ? prior.source ?? "launch-trial" : "launch-trial", trialUsed: true,
      startedAt: isPlusActive(prior, +now) ? prior.startedAt ?? now : now, expiresAt, updatedAt: now,
    };
    try {
      // the filter makes "claim once" atomic: a second concurrent claim cannot match, tries to insert,
      // and hits the unique userId index (duplicate key) instead of granting another trial
      await subs().updateOne({ userId: req.user.id, trialUsed: { $ne: true } }, { $set: row, $setOnInsert: { createdAt: now } }, { upsert: true });
    } catch (e) {
      if (e?.code === 11000) return fail(res, 409, "TRIAL_USED", "The launch trial has already been used on this account.");
      throw e;
    }
    await gifts().insertMany(planGiftEvents({ userId: row.userId, email: row.email, name: row.name, months: plan.trialMonths, now, expiresAt, rand: deps.rand }));
    res.status(201).json({ success: true, subscription: subRow(await subs().findOne({ userId: req.user.id }), +now) });
  }));

  // Deliberately closed until Click approves the merchant and issues credentials. No card data ever touches this server.
  app.post("/api/plus/checkout", requireUser, (req, res) => fail(res, 503, "PAYMENTS_NOT_CONFIGURED", "Click checkout is not connected yet. No payment was made."));

  /* -------------------------------- admin -------------------------------- */
  app.get("/api/plus/admin/overview", ...admin, wrap(async (req, res) => {
    const now = +clock();
    const [plan, rows, pendingGifts, userRows] = await Promise.all([
      getPlan(),
      subs().find({}).sort({ updatedAt: -1 }).limit(2000).toArray(),
      gifts().countDocuments({ issuedAt: null }),
      db().collection("users").find({}).sort({ lastSeenAt: -1 }).limit(2000).toArray(), // everyone who ever signed in (NarxTop's own directory)
    ]);
    const byUser = new Map(rows.map((s) => [s.userId, subRow(s, now)]));
    const directory = userRows.map((u) => ({ id: u._id, email: u.email ?? "", name: u.name ?? "", username: u.username ?? "", subscription: byUser.get(u._id) ?? null }));
    const known = new Set(directory.map((u) => u.id));
    for (const s of rows) if (!known.has(s.userId)) directory.push({ id: s.userId, email: s.email ?? "", name: s.name ?? "", username: s.username ?? "", subscription: byUser.get(s.userId) });
    const subscriptions = [...byUser.values()];
    res.json({
      success: true, plan, subscriptions, users: directory, usersDirectoryReady: userRows.length > 0, paymentsReady: false,
      stats: { active: subscriptions.filter((s) => s.active).length, total: subscriptions.length, giftsPending: pendingGifts },
    });
  }));

  app.get("/api/plus/admin/gifts", ...admin, wrap(async (req, res) => {
    const limit = Math.min(100, Math.max(1, Math.floor(Number(req.query.limit) || 20)));
    const offset = Math.min(1_000_000, Math.max(0, Math.floor(Number(req.query.offset) || 0)));
    const query = String(req.query.q ?? "").trim().slice(0, 100);
    const filter = {};
    if (req.query.pending === "true") filter.issuedAt = null;
    if (query) {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filter.$or = [{ name: regex }, { email: regex }, { userId: regex }, { store: regex }];
    }
    const [total, pending, rows] = await Promise.all([
      gifts().countDocuments(filter),
      gifts().countDocuments({ issuedAt: null }),
      gifts().find(filter).sort({ createdAt: -1, _id: -1 }).skip(offset).limit(limit).toArray(),
    ]);
    res.json({ success: true, gifts: rows.map(giftRow), total, pending, offset, limit, hasMore: offset + rows.length < total });
  }));

  app.put("/api/plus/admin/plan", ...admin, wrap(async (req, res) => {
    const v = validatePlanInput(req.body, await getPlan());
    if (!v.ok) return fail(res, 400, "BAD_PLAN", v.error);
    await settings().updateOne({ key: "plan" }, { $set: { value: v.value, updatedAt: clock() } }, { upsert: true });
    await logAction(db(), req.admin, "plus.plan", null, `${v.value.price.toLocaleString("en-US")} UZS`);
    res.json({ success: true, plan: v.value });
  }));

  app.delete("/api/admin/subscriptions/revoke", ...admin, wrap(async (req, res) => {
    const userId = String(req.body?.userId ?? "").trim().slice(0, 128);
    if (!userId) return fail(res, 400, "BAD_USER", "Choose a user first.");
    const prior = await subs().findOne({ userId });
    if (!prior) return fail(res, 404, "NOT_FOUND", "This user has no NarxTop Premium subscription.");
    if (prior.status !== "revoked") {
      const now = clock();
      await subs().updateOne({ userId }, { $set: { status: "revoked", revokedAt: now, revokedBy: String(req.admin?.email ?? ""), updatedAt: now } });
      await logAction(db(), req.admin, "plus.revoke", userId, `NarxTop Premium revoked → ${prior.email || userId}`);
    }
    res.json({ success: true, subscription: subRow(await subs().findOne({ userId }), +clock()) });
  }));

  app.post("/api/plus/admin/gift", ...admin, wrap(async (req, res) => {
    const v = validateGiftInput(req.body);
    if (!v.ok) return fail(res, 400, "BAD_GIFT", v.error);
    const { userId, unit, amount, message } = v.value;
    const known = await db().collection("users").findOne({ _id: userId });
    const email = String(known?.email ?? v.value.email).toLowerCase(), name = known?.name || v.value.name, username = known?.username || "";
    const prior = await subs().findOne({ userId });
    const now = clock();
    const expiresAt = extendExpiry(isPlusActive(prior, +now) ? prior.expiresAt : null, { unit, amount }, now);
    await subs().updateOne(
      { userId },
      { $set: { userId, email, name, username, status: "active", source: "admin-gift", startedAt: isPlusActive(prior, +now) ? prior.startedAt ?? now : now, expiresAt, updatedAt: now }, $setOnInsert: { createdAt: now } },
      { upsert: true }
    );
    const extended = isPlusActive(prior, +now);
    await notices().insertOne({
      id: randomUUID(), userId, kind: "plus_gift", amount, unit,
      expiresAt, createdAt: now, readAt: null, extended, ...(message ? { message } : {}),
    });
    let created = [];
    if (unit === "months") {
      created = planGiftEvents({ userId, email, name, months: amount, now, expiresAt, rand: deps.rand });
      await gifts().insertMany(created);
    }
    await logAction(db(), req.admin, "plus.gift", userId, `${amount} ${unit === "months" ? "oy" : "kun"} → ${email || userId}`);
    res.status(201).json({ success: true, subscription: subRow(await subs().findOne({ userId }), +now), gifts: created.map((g) => ({ ...g, id: "", dueAt: iso(g.dueAt), createdAt: iso(g.createdAt) })) });
  }));

  /* ids are matched as strings against the stored _id (an ObjectId) — same approach as the messages routes in admin.js */
  app.post("/api/plus/admin/gifts/:id/issue", ...admin, wrap(async (req, res) => {
    if (!ObjectId.isValid(String(req.params.id))) return fail(res, 404, "NOT_FOUND", "Gift record not found.");
    const g = await gifts().findOne({ _id: new ObjectId(String(req.params.id)) });
    if (!g) return fail(res, 404, "NOT_FOUND", "Gift record not found.");
    if (g.issuedAt) return fail(res, 409, "ALREADY_ISSUED", "This gift is already marked as issued.");
    const issuedAt = clock();
    const issued = await gifts().updateOne(
      { _id: g._id, issuedAt: null },
      { $set: { issuedAt, issuedBy: String(req.admin?.email ?? ""), status: "issued" } },
    );
    if (!issued.modifiedCount) return fail(res, 409, "ALREADY_ISSUED", "This gift is already marked as issued.");
    await logAction(db(), req.admin, "plus.giftIssued", String(g._id), `${g.store} → ${g.email || g.userId}`);
    res.json({ success: true, gift: giftRow({ ...g, issuedAt, issuedBy: req.admin?.email, status: "issued" }) });
  }));
}
