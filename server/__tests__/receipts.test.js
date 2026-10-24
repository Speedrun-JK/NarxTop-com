import test from "node:test";
import assert from "node:assert/strict";
import { createFakeApp, createFakeDb } from "./helpers/fakes.js";
import { ensureReceiptIndexes, registerReceiptRoutes, validateReceiptInput } from "../receipts.js";

const NOW = new Date("2026-10-14T10:00:00Z");
const USERS = {
  "Bearer ali": { id: "user-ali", email: "ali@example.test", user_metadata: { full_name: "Ali" } },
  "Bearer vali": { id: "user-vali", email: "vali@example.test", user_metadata: {} },
};
const requireAdmin = (req, res, next) => {
  if (req.get("authorization") === "Bearer admin") { req.admin = { id: "admin", email: "admin@example.test" }; return next(); }
  return res.status(403).json({ success: false, message: "Forbidden" });
};
const verifyUser = async (req) => USERS[req.get("authorization")] ? { user: USERS[req.get("authorization")] } : { status: 401, message: "Unauthorized" };
const jpg = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff]).toString("base64")}`;
const order = (orderId = "order-12345678") => ({ orderId, store: "Korzinka", items: [{ slug: "milk-1l", qty: 2, price: 100 }], total: 200, image: jpg });

async function setup() {
  const app = createFakeApp(), db = createFakeDb();
  await ensureReceiptIndexes(db);
  registerReceiptRoutes(app, () => db, { requireAdmin, verifyUser, now: () => new Date(NOW) });
  const api = (method, url, body, token) => app.call(method, url, { body, headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { api, db };
}

test("receipt validation checks the order and image magic bytes", () => {
  assert.equal(validateReceiptInput(order()).ok, true);
  assert.equal(validateReceiptInput({ ...order(), total: 201 }).ok, false);
  assert.equal(validateReceiptInput({ ...order(), image: "data:image/jpeg;base64,aGVsbG8=" }).ok, false);
  assert.equal(validateReceiptInput({ ...order(), image: `data:image/png;base64,${Buffer.from([0xff, 0xd8, 0xff]).toString("base64")}` }).ok, false);
  assert.equal(validateReceiptInput({ ...order(), store: "Other Market" }).ok, false);
});

test("receipt upload is authenticated, private, and idempotent per user order", async () => {
  const { api, db } = await setup();
  assert.equal((await api("POST", "/api/receipts", order())).status, 401);
  const first = await api("POST", "/api/receipts", order(), "ali");
  assert.equal(first.status, 201);
  assert.equal(first.body.receipt.status, "pending");
  assert.equal(first.body.receipt.email, "ali@example.test");
  assert.equal(Object.hasOwn(first.body.receipt, "imageId"), false, "the user endpoint exposes no image storage id");
  const again = await api("POST", "/api/receipts", order(), "ali");
  assert.equal(again.body.duplicate, true);
  assert.equal(again.body.receipt.id, first.body.receipt.id);
  assert.equal(db.collection("receipts").docs.length, 1);
  assert.equal(db.collection("receipt_images").docs.length, 1);
  assert.equal((await api("GET", "/api/receipts/mine", undefined, "vali")).body.receipts.length, 0);
  assert.equal((await api("GET", "/api/receipts/mine", undefined, "ali")).body.receipts.length, 1);
});

test("admin can paginate metadata, read private images, and review once with an audit log", async () => {
  const { api, db } = await setup();
  const upload = await api("POST", "/api/receipts", order(), "ali");
  const id = upload.body.receipt.id;
  assert.equal((await api("GET", "/api/admin/receipts")).status, 403);
  const list = await api("GET", "/api/admin/receipts?status=pending&limit=1", undefined, "admin");
  assert.equal(list.body.total, 1);
  assert.equal(list.body.receipts[0].id, id);
  const image = await api("GET", `/api/admin/receipts/${id}/image`, undefined, "admin");
  assert.equal(image.headers["cache-control"], "private, no-store");
  assert.ok(Buffer.isBuffer(image.text));
  assert.equal((await api("POST", `/api/admin/receipts/${id}/review`, { status: "approved", note: "Looks good" }, "admin")).status, 200);
  assert.equal((await api("POST", `/api/admin/receipts/${id}/review`, { status: "rejected" }, "admin")).body.code, "ALREADY_REVIEWED");
  assert.equal(db.collection("receipts").docs[0].reviewedBy, "admin@example.test");
  assert.equal(db.collection("user_notifications").docs[0].kind, "receipt_review");
  assert.equal(db.collection("admin_log").docs[0].action, "receipt.approved");
});

test("admin purchase history lists who bought what and rolls up buyers and products", async () => {
  const { api } = await setup();
  await api("POST", "/api/receipts", order("order-aaaaaaaa"), "ali");
  await api("POST", "/api/receipts", { ...order("order-bbbbbbbb"), items: [{ slug: "milk-1l", qty: 3, price: 100 }, { slug: "bread", qty: 1, price: 50 }], total: 350 }, "vali");
  assert.equal((await api("GET", "/api/admin/purchases")).status, 403);
  const r = await api("GET", "/api/admin/purchases", undefined, "admin");
  assert.equal(r.status, 200);
  assert.equal(r.body.summary.orders, 2);
  assert.equal(r.body.summary.spent, 550);
  assert.equal(r.body.summary.buyers, 2);
  assert.equal(r.body.buyers[0].userId, "user-vali", "biggest spender first");
  const milk = r.body.products.find((p) => p.slug === "milk-1l");
  assert.equal(milk.qty, 5);
  assert.equal(milk.buyers, 2);
  const filtered = await api("GET", "/api/admin/purchases?search=bread", undefined, "admin");
  assert.equal(filtered.body.total, 1);
});

test("a cart with promotions is accepted: line cost can be lower than qty × price, never higher", async () => {
  const promo = { ...order(), items: [{ slug: "milk-1l", qty: 3, price: 100, cost: 250 }, { slug: "bread", qty: 1, price: 50 }], total: 300 };
  assert.equal(validateReceiptInput(promo).ok, true);
  assert.equal(validateReceiptInput({ ...promo, total: 350 }).ok, false, "the total must equal the discounted lines");
  assert.equal(validateReceiptInput({ ...promo, items: [{ slug: "milk-1l", qty: 3, price: 100, cost: 400 }], total: 400 }).ok, false, "a promo cannot raise the price");
  const { api } = await setup();
  const up = await api("POST", "/api/receipts", promo, "ali");
  assert.equal(up.status, 201);
  assert.equal(up.body.receipt.items[0].cost, 250);
  assert.equal(Object.hasOwn(up.body.receipt.items[1], "cost"), false);
});
