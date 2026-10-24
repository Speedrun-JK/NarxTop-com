/* Admin API client. Every call carries the signed-in user's NarxTop session cookie; the server verifies it.
 * Errors are turned into plain sentences: "server not running" and "server older than this panel"
 * (the usual cause of 404s on /api/admin/*) are told apart from normal API errors. */
import { ADMIN_API_VERSION } from "../../shared/adminVersion.js";
import { apiFetch, apiUrl } from "../lib/api";

export const MSG = {
  offline: "Server bilan aloqa yo‘q. Terminalda `npm run server` ishlayotganini tekshiring.",
  stale: "Server eski versiyada ishlayapti (admin API topilmadi). Terminalda `npm run server` ni to‘xtating (Ctrl+C) va qayta ishga tushiring.",
  db: "Server ishlayapti, lekin MongoDB ulanmagan. MONGODB_URI ni tekshiring.",
};

const fail = (message, status, kind = "") => Object.assign(new Error(message), { status, kind });
const parseJson = (text) => { try { return text ? JSON.parse(text) : null; } catch { return null; } };

/* `root` lets sibling admin APIs share this client: "/api/admin" (default) and "/api/plus/admin". */
async function request(path, { method = "GET", body, raw = false, root = "/api/admin" } = {}) {
  let res;
  try {
    res = await apiFetch(`${root}${path}`, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw fail(MSG.offline, 0, "offline");
  }
  if (raw && res.ok) return res;

  const text = await res.text().catch(() => "");
  const json = parseJson(text);

  if (!json) { // not JSON: the dev proxy could not reach the server, or an old server answered with an HTML 404 page
    if (res.status === 404) throw fail(MSG.stale, 404, "stale");
    if (res.status >= 500) throw fail(MSG.offline, res.status, "offline");
    throw fail(`Xatolik ${res.status}`, res.status);
  }
  if (json.code === "api_not_found") throw fail(MSG.stale, 404, "stale");
  if (!res.ok || json.success === false) throw fail(json.message || `Xatolik ${res.status}`, res.status);
  return json;
}

/* Public health probe -> { state: "ok" | "stale" | "offline" | "db", message?, database?, version? } */
export async function checkServer() {
  let res;
  try { res = await apiFetch("/api/health", { cache: "no-store" }); } catch { return { state: "offline", message: MSG.offline }; }
  const json = await res.json().catch(() => null);
  if (!json) return { state: res.status === 404 ? "stale" : "offline", message: res.status === 404 ? MSG.stale : MSG.offline };
  if (res.status === 503 || json.success === false) return { state: "db", message: MSG.db, version: json.adminApi ?? null };
  if (json.adminApi !== ADMIN_API_VERSION) return { state: "stale", message: MSG.stale, version: json.adminApi ?? null };
  return { state: "ok", database: json.database ?? "", version: json.adminApi };
}

/* Saves a CSV the server generated (products | users | messages). */
async function download(what) {
  const res = await request(`/export/${encodeURIComponent(what)}`, { raw: true });
  const blob = await res.blob();
  const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") || "")?.[1] || `narxtop-${what}.csv`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return name;
}

/* Public price history (same route the product page uses). Failure is not an error for the editor. */
async function history(slug, days = 180) {
  try {
    const res = await fetch(apiUrl(`/api/products/${encodeURIComponent(slug)}/history?days=${days}`));
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json.history) ? json.history : [];
  } catch { return []; }
}

const enc = encodeURIComponent;
const PLUS = "/api/plus/admin";

export const adminApi = {
  me: () => request("/me"),
  stats: () => request("/stats"),
  products: () => request("/products").then((r) => r.products),
  translateProduct: (data) => request("/translate-product", { method: "POST", body: data }).then((r) => r.translations),
  uploadProductImage: (image) => request("/product-images", { method: "POST", body: { image } }).then((r) => r.image),
  createProduct: (p) => request("/products", { method: "POST", body: p }).then((r) => r.product),
  updateProduct: (slug, p) => request(`/products/${enc(slug)}`, { method: "PUT", body: p }).then((r) => r.product),
  deleteProduct: (slug) => request(`/products/${enc(slug)}`, { method: "DELETE" }),
  duplicateProduct: (slug) => request(`/products/${enc(slug)}/duplicate`, { method: "POST", body: {} }).then((r) => r.product),
  bulk: (action, slugs, extra = {}) => request("/products/bulk", { method: "POST", body: { action, slugs, ...extra } }),
  seed: (overwrite = false) => request("/seed", { method: "POST", body: { overwrite } }).then((r) => r.result),
  checkImages: ({ slugs, offset = 0 } = {}) => request("/images/check", { method: "POST", body: { slugs, offset } }),
  clearImages: (slugs) => request("/images/clear", { method: "POST", body: { slugs } }).then((r) => r.cleared),
  users: () => request("/users").then((r) => r.users),
  userProfile: (userId) => request(`/users/${enc(userId)}`).then((r) => r.user),
  deleteUser: (userId, confirm) => request(`/users/${enc(userId)}`, { method: "DELETE", body: { confirm } }),
  setUserRole: (userId, role) => request(`/users/${enc(userId)}/role`, { method: "PUT", body: { role } }).then((r) => r.user),
  messages: () => request("/messages").then((r) => r.messages),
  setMessageRead: (id, read) => request(`/messages/${enc(id)}`, { method: "PUT", body: { read } }),
  readAllMessages: () => request("/messages/read-all", { method: "POST", body: {} }).then((r) => r.updated),
  deleteMessage: (id) => request(`/messages/${enc(id)}`, { method: "DELETE" }),
  activity: (limit = 100) => request(`/activity?limit=${limit}`).then((r) => r.items),
  receipts: (filters = {}) => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value != null && value !== "").map(([key, value]) => [key, String(value)]));
    return request(`/receipts${params.size ? `?${params}` : ""}`);
  },
  purchases: (filters = {}) => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, v]) => v !== "" && v != null && v !== "all"));
    return request(`/purchases${params.size ? `?${params}` : ""}`);
  },
  leaderboard: (search = "") => request(`/leaderboard${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  receiptImage: (id) => request(`/receipts/${enc(id)}/image`, { raw: true }).then((res) => res.blob()),
  reviewReceipt: (id, status, note = "") => request(`/receipts/${enc(id)}/review`, { method: "POST", body: { status, note } }),
  // NarxTop Plus (server/plus.js)
  plusOverview: () => request("/overview", { root: PLUS }),
  revokePlus: (userId) => request("/subscriptions/revoke", { method: "DELETE", body: { userId } }),
  plusGifts: (filters = {}) => {
    const params = new URLSearchParams(Object.entries(filters).filter(([, value]) => value != null && value !== "").map(([key, value]) => [key, String(value)]));
    return request(`/gifts${params.size ? `?${params}` : ""}`, { root: PLUS });
  },
  plusSavePlan: (plan) => request("/plan", { method: "PUT", body: plan, root: PLUS }).then((r) => r.plan),
  plusGift: (gift) => request("/gift", { method: "POST", body: gift, root: PLUS }),
  plusIssueGift: (id) => request(`/gifts/${enc(id)}/issue`, { method: "POST", body: {}, root: PLUS }).then((r) => r.gift),
  // store logos shown next to prices (server/storeLogos.js)
  setStoreLogo: (chain, dataUrl) => request(`/store-logos/${enc(chain)}`, { method: "PUT", body: { dataUrl } }),
  removeStoreLogo: (chain) => request(`/store-logos/${enc(chain)}`, { method: "DELETE" }),
  download,
  history,
};
