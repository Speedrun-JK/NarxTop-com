/* NarxTop-owned sessions. Google proves identity; this server issues its own
 * signed session cookie and loads authorization state from MongoDB. */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { normalizePhone } from "../shared/core/phone.js";

export const SESSION_COOKIE = "narxtop_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const ISSUER = "narxtop";

const b64 = (value) => Buffer.from(value).toString("base64url");
const unb64 = (value) => Buffer.from(value, "base64url").toString("utf8");
const sessionSecret = () => String(process.env.AUTH_SESSION_SECRET ?? "");

function cookieSettings() {
  const sameSiteRaw = String(process.env.AUTH_COOKIE_SAME_SITE || "Lax").toLowerCase();
  const sameSite = ["lax", "strict", "none"].includes(sameSiteRaw) ? sameSiteRaw : "lax";
  const secure = sameSite === "none" || process.env.AUTH_COOKIE_SECURE === "true" || process.env.NODE_ENV === "production";
  return { sameSite, secure };
}

function sign(value) {
  const secret = sessionSecret();
  if (secret.length < 32) throw new Error("AUTH_SESSION_SECRET must contain at least 32 characters.");
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createSessionToken(user, sessionId = randomUUID()) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64(JSON.stringify({
    iss: ISSUER,
    sub: String(user._id),
    sid: String(sessionId),
    ver: Number(user.sessionVersion ?? 0),
    iat: now,
    exp: now + SESSION_MAX_AGE_SECONDS,
  }));
  const unsigned = head + "." + body;
  return unsigned + "." + sign(unsigned);
}

function verifySessionToken(token) {
  if (typeof token !== "string" || token.length > 4096) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const unsigned = parts[0] + "." + parts[1];
  let provided;
  try { provided = Buffer.from(parts[2], "base64url"); } catch { return null; }
  let expected;
  try { expected = Buffer.from(sign(unsigned), "base64url"); } catch { return null; }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  try {
    const header = JSON.parse(unb64(parts[0]));
    const payload = JSON.parse(unb64(parts[1]));
    if (header.alg !== "HS256" || payload.iss !== ISSUER || !payload.sub || !Number.isFinite(payload.exp) || payload.exp <= Date.now() / 1000) return null;
    return payload;
  } catch { return null; }
}

function readCookie(req, name) {
  const header = String(req.headers?.cookie ?? "");
  for (const item of header.split(";")) {
    const index = item.indexOf("=");
    if (index < 0 || item.slice(0, index).trim() !== name) continue;
    try { return decodeURIComponent(item.slice(index + 1).trim()); } catch { return ""; }
  }
  return "";
}

export function requestToken(req) {
  const authorization = String(req.get?.("authorization") ?? req.headers?.authorization ?? "");
  const bearer = /^Bearer\s+(.+)$/i.exec(authorization)?.[1];
  return bearer || readCookie(req, SESSION_COOKIE);
}

export function setSessionCookie(res, user, sessionId = randomUUID()) {
  const settings = cookieSettings();
  const fields = [
    SESSION_COOKIE + "=" + encodeURIComponent(createSessionToken(user, sessionId)),
    "Path=/",
    "HttpOnly",
    "SameSite=" + settings.sameSite[0].toUpperCase() + settings.sameSite.slice(1),
    "Max-Age=" + SESSION_MAX_AGE_SECONDS,
  ];
  if (settings.secure) fields.push("Secure");
  res.append("Set-Cookie", fields.join("; "));
  return sessionId;
}

export function clearSessionCookie(res) {
  const settings = cookieSettings();
  const fields = [SESSION_COOKIE + "=", "Path=/", "HttpOnly", "SameSite=" + settings.sameSite[0].toUpperCase() + settings.sameSite.slice(1), "Max-Age=0"];
  if (settings.secure) fields.push("Secure");
  res.append("Set-Cookie", fields.join("; "));
}

export function publicUser(row) {
  if (!row) return null;
  const providers = [...new Set(Array.isArray(row.providers) ? row.providers : [row.provider || (row.googleSub ? "google" : "email")])];
  const name = String(row.name ?? "");
  const fullName = [name, row.secondName].filter(Boolean).join(" ");
  const confirmed = row.emailConfirmedAt ? new Date(row.emailConfirmedAt).toISOString() : null;
  const phone = normalizePhone(row.phone);
  return {
    id: String(row._id),
    email: String(row.email ?? ""),
    email_confirmed_at: confirmed,
    confirmed_at: confirmed,
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    last_sign_in_at: row.lastSeenAt ? new Date(row.lastSeenAt).toISOString() : null,
    user_metadata: {
      name,
      second_name: String(row.secondName ?? ""),
      full_name: fullName,
      phone: String(row.phone ?? ""),
      avatar_url: row.googlePicture || null,
      avatar_color: row.avatarColor || null,
      username: String(row.username ?? ""),
    },
    app_metadata: { provider: row.provider || providers[0] || "email", providers },
    identities: providers.map((provider) => ({ provider, identity_id: String(row._id) + ":" + provider })),
  };
}

/* Returns { user } or { status, message }. Always checks that the account and
 * session version are still valid, so logout-all/password changes revoke older cookies. */
export async function verifyUser(req) {
  const claims = verifySessionToken(requestToken(req));
  if (!claims) return { status: 401, message: "Unauthorized" };
  const db = req.app?.locals?.getDb?.();
  if (!db) return { status: 503, message: "Database is not connected." };
  const row = await db.collection("users").findOne({ _id: claims.sub });
  if (!row || Number(row.sessionVersion ?? 0) !== Number(claims.ver ?? 0) || !row.emailConfirmedAt) {
    return { status: 401, message: "Session expired. Please sign in again." };
  }
  if (claims.sid) {
    const activeSession = await db.collection("auth_sessions").findOne({
      _id: String(claims.sid), userId: String(claims.sub), expiresAt: { $gt: new Date() }, revokedAt: null,
    });
    if (!activeSession) return { status: 401, message: "Session expired. Please sign in again." };
  }
  const user = publicUser(row);
  const sessionId = claims.sid ? String(claims.sid) : null;
  return { user, row, sessionId };
}

/* Admin allow-list is configured only on the server. Delegated admins are stored
 * in the MongoDB users collection and may not grant themselves access. */
export const ADMIN_ENV_NAMES = ["ADMIN_GMAIL", "ADMIN_EMAILS"];
export const adminEmails = () => [...new Set(
  ADMIN_ENV_NAMES.flatMap((name) => String(process.env[name] ?? "").split(",")).map((s) => s.trim().toLowerCase()).filter(Boolean)
)];

export function isAdminUser(user) {
  const email = String(user?.email ?? "").toLowerCase();
  const confirmed = Boolean(user?.email_confirmed_at || user?.confirmed_at);
  return Boolean(email) && confirmed && adminEmails().includes(email);
}

export function isCeoEmail(email) {
  return adminEmails().includes(String(email ?? "").trim().toLowerCase());
}

export function roleForUserRecord(row) {
  if (isCeoEmail(row?.email)) return "ceo";
  if (row?.adminRole === "worker") return "worker";
  if (row?.adminRole === "superadmin") return "superadmin";
  if (row?.adminRole === "admin" || row?.isAdmin === true) return "admin"; // legacy delegated admin rows remain admins
  return "user";
}

export async function resolveAdminRole(user, db) {
  if (isAdminUser(user)) return "ceo";
  if (!user?.id || !(user.email_confirmed_at || user.confirmed_at) || !db) return "user";
  const row = await db.collection("users").findOne({ _id: user.id }, { projection: { adminRole: 1, isAdmin: 1, email: 1 } });
  return roleForUserRecord(row);
}

async function requireRole(req, res, next, allowed) {
  try {
    if (!adminEmails().length) return res.status(501).json({ success: false, message: "ADMIN_GMAIL (or ADMIN_EMAILS) is not set in .env.local" });
    const result = await verifyUser(req);
    if (!result.user) return res.status(result.status).json({ success: false, ...(result.code ? { code: result.code } : {}), message: result.message });
    const role = await resolveAdminRole(result.user, req.app?.locals?.getDb?.());
    if (!allowed.includes(role)) return res.status(403).json({ success: false, message: "Forbidden" });
    req.admin = result.user;
    req.adminRole = role;
    req.adminIsCeo = role === "ceo";
    next();
  } catch (error) {
    console.error("admin auth failed:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function requireUser(req, res, next) {
  try {
    const result = await verifyUser(req);
    if (!result.user) return res.status(result.status).json({ success: false, code: result.code || "AUTH", message: result.message });
    req.user = result.user;
    next();
  } catch (error) {
    console.error("auth check failed:", error.message);
    res.status(500).json({ success: false, code: "SERVER", message: "Server error" });
  }
}

export async function requireAdmin(req, res, next) {
  return requireRole(req, res, next, ["ceo", "superadmin", "admin"]);
}

export async function requireCatalogManager(req, res, next) {
  return requireRole(req, res, next, ["ceo", "superadmin", "admin", "worker"]);
}

export async function requireCeo(req, res, next) {
  return requireRole(req, res, next, ["ceo", "superadmin"]);
}
