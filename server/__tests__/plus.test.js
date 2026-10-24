import test from "node:test";
import assert from "node:assert/strict";
import { createFakeApp, createFakeDb } from "./helpers/fakes.js";
import { registerPlusRoutes, ensurePlusIndexes } from "../plus.js";
import { registerStoreLogoRoutes, validateLogo, logoKey } from "../storeLogos.js";
import { GIFT_STORES } from "../../shared/core/plus.js";

const NOW = new Date("2026-10-12T00:00:00Z");
const ADMIN = { id: "admin-1", email: "boss@gmail.com" };
const USERS = {
  "Bearer ali": { id: "u-1", email: "Ali@Mail.uz", user_metadata: { full_name: "Ali Valiyev" } },
  "Bearer vali": { id: "u-2", email: "vali@mail.uz", user_metadata: {} },
};
const requireAdmin = (req, res, next) => {
  const t = req.get("authorization");
  if (!t) return res.status(401).json({ success: false, message: "Unauthorized" });
  if (t !== "Bearer admin") return res.status(403).json({ success: false, message: "Forbidden" });
  req.admin = ADMIN; next();
};
const verifyUser = async (req) => (USERS[req.get("authorization")] ? { user: USERS[req.get("authorization")] } : { status: 401, message: "Unauthorized" });

async function setup() {
  const app = createFakeApp(), db = createFakeDb();
  await ensurePlusIndexes(db); // unique userId index, like production
  let n = 0;
  registerPlusRoutes(app, () => db, { requireAdmin, verifyUser, now: () => new Date(NOW), rand: () => [0, 0.5, 0.99][n++ % 3] });
  registerStoreLogoRoutes(app, () => db, { requireAdmin });
  const api = (method, url, body, token) => app.call(method, url, { body, headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { app, db, api };
}

test("plan is public; personal and admin routes demand a session / admin", async () => {
  const { api } = await setup();
  const plan = await api("GET", "/api/plus/plan");
  assert.equal(plan.status, 200);
  assert.equal(plan.body.plan.name, "NarxTop Plus");
  assert.equal(plan.body.plan.trialMonths, 2);
  assert.equal(plan.body.paymentsReady, false);

  const me = await api("GET", "/api/plus/me");
  assert.equal(me.status, 401);
  assert.equal(me.body.code, "AUTH");
  assert.equal((await api("POST", "/api/plus/trial")).status, 401);
  assert.equal((await api("POST", "/api/plus/checkout")).status, 401);

  for (const [m, u] of [["GET", "/api/plus/admin/overview"], ["GET", "/api/plus/admin/gifts"], ["PUT", "/api/plus/admin/plan"], ["POST", "/api/plus/admin/gift"], ["POST", "/api/plus/admin/gifts/x/issue"]]) {
    assert.equal((await api(m, u, {})).status, 401, `${m} ${u} without a token`);
    assert.equal((await api(m, u, {}, "ali")).status, 403, `${m} ${u} as a normal user`);
  }
});

test("launch trial: granted once per account, 2 months, one gift record per month", async () => {
  const { api, db } = await setup();
  const first = await api("POST", "/api/plus/trial", {}, "ali");
  assert.equal(first.status, 201);
  assert.equal(first.body.subscription.active, true);
  assert.equal(first.body.subscription.source, "launch-trial");
  assert.equal(first.body.subscription.expiresAt, "2026-12-12T00:00:00.000Z");
  assert.equal(first.body.subscription.daysLeft, 61);
  assert.equal(first.body.subscription.email, "ali@mail.uz", "e-mail is stored lower-case from the verified account");
  assert.equal(first.body.subscription.name, "Ali Valiyev");

  const again = await api("POST", "/api/plus/trial", {}, "ali");
  assert.equal(again.status, 409);
  assert.equal(again.body.code, "TRIAL_USED");
  assert.equal(db.collection("plus_subscriptions").docs.length, 1);

  const me = await api("GET", "/api/plus/me", undefined, "ali");
  assert.equal(me.body.subscription.active, true);
  assert.deepEqual(me.body.gifts.map((g) => g.period), [1, 2]);
  assert.ok(me.body.gifts.every((g) => GIFT_STORES.includes(g.store) && !g.issuedAt));
  assert.equal(me.body.gifts.length, 2, "the rejected second claim must not create more gifts");

  // another account is independent
  assert.equal((await api("POST", "/api/plus/trial", {}, "vali")).status, 201);
  assert.equal((await api("GET", "/api/plus/me", undefined, "ali")).body.gifts.length, 2);
});

test("two simultaneous trial claims by one account: exactly one wins (duplicate-key protection)", async () => {
  const { api, db } = await setup();
  const [a, b] = await Promise.all([api("POST", "/api/plus/trial", {}, "vali"), api("POST", "/api/plus/trial", {}, "vali")]);
  assert.deepEqual([a.status, b.status].sort(), [201, 409]);
  assert.equal(db.collection("plus_subscriptions").docs.length, 1);
  assert.equal(db.collection("plus_gift_events").docs.length, 2, "gifts are only created for the winning claim");
});

test("a user with no subscription gets subscription:null; checkout stays closed", async () => {
  const { api } = await setup();
  const me = await api("GET", "/api/plus/me", undefined, "ali");
  assert.equal(me.status, 200);
  assert.equal(me.body.subscription, null);
  assert.deepEqual(me.body.gifts, []);
  const co = await api("POST", "/api/plus/checkout", {}, "ali");
  assert.equal(co.status, 503);
  assert.equal(co.body.code, "PAYMENTS_NOT_CONFIGURED");
});

test("admin edits the plan: validated, persisted, public, logged", async () => {
  const { api, db } = await setup();
  assert.equal((await api("PUT", "/api/plus/admin/plan", { price: 0 }, "admin")).status, 400);
  assert.equal((await api("PUT", "/api/plus/admin/plan", { price: "abc" }, "admin")).body.code, "BAD_PLAN");
  const ok = await api("PUT", "/api/plus/admin/plan", { price: 29900, description: "  Katta savat  ", features: ["A", " ", "B"] }, "admin");
  assert.equal(ok.status, 200);
  assert.equal(ok.body.plan.price, 29900);
  const pub = (await api("GET", "/api/plus/plan")).body.plan;
  assert.equal(pub.price, 29900);
  assert.equal(pub.description, "Katta savat");
  assert.deepEqual(pub.features, ["A", "B"]);
  assert.equal(pub.trialMonths, 2, "trial length is not editable");
  const log = db.collection("admin_log").docs;
  assert.equal(log.at(-1).action, "plus.plan");
  assert.equal(log.at(-1).by, "boss@gmail.com");
});

test("admin gifts days (extends active access) and months (adds gift records); bad input is rejected", async () => {
  const { api, db } = await setup();
  await db.collection("users").insertOne({ _id: "u-1", email: "ali@mail.uz", name: "Ali", lastSeenAt: NOW });

  assert.equal((await api("POST", "/api/plus/admin/gift", { userId: "u-1", unit: "days", amount: 0 }, "admin")).status, 400);
  assert.equal((await api("POST", "/api/plus/admin/gift", { unit: "days", amount: 3 }, "admin")).body.code, "BAD_GIFT");

  const d = await api("POST", "/api/plus/admin/gift", { userId: "u-1", unit: "days", amount: 10 }, "admin");
  assert.equal(d.status, 201);
  assert.equal(d.body.subscription.source, "admin-gift");
  assert.equal(d.body.subscription.expiresAt, "2026-10-22T00:00:00.000Z");
  assert.equal(d.body.subscription.email, "ali@mail.uz", "identity comes from the user directory");
  assert.equal(db.collection("plus_gift_events").docs.length, 0, "days do not create supermarket gifts");
  const [notice] = db.collection("user_notifications").docs;
  assert.equal(notice.userId, "u-1");
  assert.equal(notice.kind, "plus_gift");
  assert.equal(notice.amount, 10);
  assert.equal(notice.unit, "days");
  assert.equal(notice.extended, false);
  assert.equal(Object.hasOwn(notice, "adminEmail"), false, "the grantor identity is not exposed to the user");

  const m = await api("POST", "/api/plus/admin/gift", { userId: "u-1", unit: "months", amount: 3 }, "admin");
  assert.equal(m.body.subscription.expiresAt, "2027-01-22T00:00:00.000Z", "months stack on the still-active access");
  assert.equal(m.body.gifts.length, 3);
  assert.equal(db.collection("plus_gift_events").docs.length, 3);

  // a user the directory does not know yet: falls back to the e-mail sent by the panel
  const x = await api("POST", "/api/plus/admin/gift", { userId: "ghost", unit: "days", amount: 1, email: "Ghost@x.uz", name: "G" }, "admin");
  assert.equal(x.body.subscription.email, "ghost@x.uz");
  assert.ok(db.collection("admin_log").docs.some((l) => l.action === "plus.gift" && l.target === "u-1"));
});

test("Plus gift notices are private to their owner and can be marked read", async () => {
  const { api, db } = await setup();
  await db.collection("users").insertOne({ _id: "u-1", email: "ali@mail.uz" });
  await api("POST", "/api/plus/admin/gift", { userId: "u-1", unit: "months", amount: 2 }, "admin");
  const [notice] = db.collection("user_notifications").docs;
  const mine = await api("GET", "/api/notifications/mine", undefined, "ali");
  assert.equal(mine.status, 200);
  assert.equal(mine.body.notifications[0].id, notice.id);
  assert.deepEqual((await api("GET", "/api/notifications/mine", undefined, "vali")).body.notifications, []);
  assert.equal((await api("POST", `/api/notifications/${notice.id}/read`, {}, "vali")).status, 404);
  assert.equal((await api("POST", `/api/notifications/${notice.id}/read`, {}, "ali")).status, 200);
  assert.ok(notice.readAt instanceof Date);
});

test("a failed Plus subscription write does not create a gift notification", async () => {
  const { api, db } = await setup();
  db.collection("plus_subscriptions").updateOne = async () => { throw new Error("database unavailable"); };
  const r = await api("POST", "/api/plus/admin/gift", { userId: "u-1", unit: "days", amount: 3 }, "admin");
  assert.equal(r.status, 500);
  assert.equal(db.collection("user_notifications").docs.length, 0);
});

test("overview merges the user directory with subscriptions and counts what matters", async () => {
  const { api, db } = await setup();
  await db.collection("users").insertOne({ _id: "u-1", email: "ali@mail.uz", name: "Ali", lastSeenAt: NOW });
  await db.collection("users").insertOne({ _id: "u-3", email: "free@mail.uz", name: "Free", lastSeenAt: new Date(NOW - 1000) });
  await api("POST", "/api/plus/trial", {}, "ali");
  await api("POST", "/api/plus/trial", {}, "vali"); // not in the users collection (never synced)

  const o = await api("GET", "/api/plus/admin/overview", undefined, "admin");
  assert.equal(o.status, 200);
  assert.equal(o.body.usersDirectoryReady, true);
  const byId = Object.fromEntries(o.body.users.map((u) => [u.id, u]));
  assert.equal(byId["u-1"].subscription.active, true);
  assert.equal(byId["u-3"].subscription, null, "free users are listed too (so they can be gifted)");
  assert.equal(byId["u-2"].email, "vali@mail.uz", "subscribers missing from the directory are still shown");
  assert.deepEqual(o.body.stats, { active: 2, total: 2, giftsPending: 4 });
  assert.equal(Object.hasOwn(o.body, "gifts"), false, "gift records load through their paginated endpoint");
  const first = await api("GET", "/api/plus/admin/gifts?limit=2&pending=true", undefined, "admin");
  assert.equal(first.body.total, 4);
  assert.equal(first.body.gifts.length, 2);
  assert.equal(first.body.hasMore, true);
  const second = await api("GET", "/api/plus/admin/gifts?limit=2&offset=2&pending=true", undefined, "admin");
  assert.equal(second.body.gifts.length, 2);
  assert.equal(second.body.hasMore, false);
  const matching = await api("GET", "/api/plus/admin/gifts?limit=20&q=Korzinka", undefined, "admin");
  assert.ok(matching.body.gifts.every((g) => g.store === "Korzinka"));
});

test("gift fulfilment: mark issued once; unknown id is 404; audit-logged", async () => {
  const { api, db } = await setup();
  await api("POST", "/api/plus/trial", {}, "ali");
  const [g] = (await api("GET", "/api/plus/admin/gifts?pending=true&limit=20", undefined, "admin")).body.gifts;
  assert.ok(g.id && !g.issuedAt);

  const r = await api("POST", `/api/plus/admin/gifts/${g.id}/issue`, {}, "admin");
  assert.equal(r.status, 200);
  assert.equal(r.body.gift.status, "issued");
  assert.equal(r.body.gift.issuedBy, "boss@gmail.com");
  assert.equal((await api("POST", `/api/plus/admin/gifts/${g.id}/issue`, {}, "admin")).body.code, "ALREADY_ISSUED");
  assert.equal((await api("POST", "/api/plus/admin/gifts/nope/issue", {}, "admin")).status, 404);

  const after = await api("GET", "/api/plus/admin/gifts?limit=20", undefined, "admin");
  assert.equal(after.body.pending, 1);
  assert.ok(after.body.gifts.find((x) => x.id === g.id).issuedAt);
  assert.ok(db.collection("admin_log").docs.some((l) => l.action === "plus.giftIssued"));
});

/* ------------------------------ store logos ------------------------------ */
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("store logo validation accepts small raster/SVG data URLs only", () => {
  assert.equal(validateLogo(PNG).ok, true);
  assert.equal(validateLogo("data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=").ok, true);
  assert.equal(validateLogo("https://x.uz/logo.png").ok, false, "remote URLs are not accepted");
  assert.equal(validateLogo("data:text/html;base64,PGgxPg==").ok, false);
  assert.equal(validateLogo("data:image/png;base64,@@@").ok, false);
  assert.equal(validateLogo(`data:image/png;base64,${"A".repeat(300_000)}`).ok, false, "too large");
  assert.equal(validateLogo(undefined).ok, false);
  assert.equal(logoKey("Makro Cash & Carry"), "makrocashcarry");
  assert.equal(logoKey("  "), "");
});

test("store logos: public read, admin-only write/delete, keyed by lower-case chain name", async () => {
  const { api, db } = await setup();
  assert.deepEqual((await api("GET", "/api/store-logos")).body.logos, {});
  assert.equal((await api("PUT", "/api/admin/store-logos/Korzinka", { dataUrl: PNG })).status, 401);
  assert.equal((await api("PUT", "/api/admin/store-logos/Korzinka", { dataUrl: PNG }, "ali")).status, 403);
  assert.equal((await api("PUT", "/api/admin/store-logos/Korzinka", { dataUrl: "javascript:alert(1)" }, "admin")).status, 400);

  assert.equal((await api("PUT", "/api/admin/store-logos/Korzinka", { dataUrl: PNG }, "admin")).status, 200);
  const pub = await api("GET", "/api/store-logos");
  assert.deepEqual(Object.keys(pub.body.logos), ["korzinka"]);
  assert.equal(pub.body.logos.korzinka, PNG);
  assert.match(pub.headers["cache-control"], /max-age/);

  assert.equal((await api("DELETE", "/api/admin/store-logos/Havas", undefined, "admin")).status, 404);
  assert.equal((await api("DELETE", "/api/admin/store-logos/KORZINKA", undefined, "admin")).status, 200);
  assert.deepEqual((await api("GET", "/api/store-logos")).body.logos, {});
  assert.deepEqual(db.collection("admin_log").docs.map((l) => l.action), ["logo.set", "logo.remove"]);
});
