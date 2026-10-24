/* Google OAuth and NarxTop-managed email/password authentication.
 * Google verifies Google accounts; this service owns NarxTop users, email links,
 * password hashes, and the signed HttpOnly session cookie. */
import { createHash, createHmac, randomBytes, randomInt, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import nodemailer from "nodemailer";
import { clearSessionCookie, publicUser, SESSION_MAX_AGE_SECONDS, setSessionCookie, verifyUser } from "./auth.js";
import { hasValidPhone, normalizePhone, validatePhoneNumber } from "../shared/core/phone.js";

const scrypt = promisify(scryptCallback);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TOKEN_TTL = { confirm: 24 * 60 * 60 * 1000, reset: 60 * 60 * 1000 };
const RESET_CODE_TTL = 15 * 60 * 1000;
const RESET_CODE_ATTEMPTS = 5;
const FRONTEND_URL = () => String(process.env.FRONTEND_URL || "http://127.0.0.1:5173").replace(/\/+$/, "");
const clean = (v, max = 120) => String(v ?? "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, max);
const emailKey = (v) => clean(v, 254).toLowerCase();
const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[c]);
const tokenHash = (v) => createHash("sha256").update(String(v)).digest("hex");
const originForGoogle = () => process.env.GOOGLE_REDIRECT_URI || (FRONTEND_URL() + "/api/auth/google/callback");
const nextPath = (value) => typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !/^\/(auth|reset-password)(\/|\?|$)/.test(value) ? value : "/";

const authFailure = (res, status, code, message) => res.status(status).json({ success: false, code, message });

export async function ensureAuthIndexes(db) {
  const users = db.collection("users");
  const emailIndex = (await users.indexes()).find((index) => index.name === "email_1");
  if (emailIndex && !emailIndex.unique) await users.dropIndex("email_1");
  await users.createIndex({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
  await db.collection("users").createIndex({ googleSub: 1 }, { unique: true, sparse: true });
  await db.collection("auth_tokens").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("auth_oauth_states").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection("auth_oauth_states").createIndex({ createdAt: 1 }, { expireAfterSeconds: 600 });
  await db.collection("auth_sessions").createIndex({ userId: 1, lastSeenAt: -1 });
  await db.collection("auth_sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(String(password), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return "scrypt$16384$" + salt.toString("hex") + "$" + Buffer.from(derived).toString("hex");
}

async function checkPassword(password, stored) {
  const parts = String(stored ?? "").split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt" || parts[1] !== "16384") return false;
  try {
    const expected = Buffer.from(parts[3], "hex");
    const derived = Buffer.from(await scrypt(String(password), Buffer.from(parts[2], "hex"), expected.length, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }));
    return expected.length === derived.length && timingSafeEqual(expected, derived);
  } catch { return false; }
}

function smtpTransport() {
  const user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;
  const port = Number(process.env.SMTP_PORT) || 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE !== "false" : port === 465,
    auth: { user, pass },
  });
}

async function sendAccountEmail({ to, subject, heading, description, token, route }) {
  const link = FRONTEND_URL() + route + "?token=" + encodeURIComponent(token);
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || "NarxTop <no-reply@narxtop.uz>";
  const text = heading + "\n\n" + description + "\n\n" + link + "\n\nAgar bu so‘rovni siz yubormagan bo‘lsangiz, xatni e’tiborsiz qoldiring.";
  const html = "<div style=\"font:16px/1.55 Arial,sans-serif;color:#2a1d14\"><h2>" + escapeHtml(heading) + "</h2><p>" + escapeHtml(description) + "</p><p><a href=\"" + escapeHtml(link) + "\" style=\"display:inline-block;padding:12px 18px;background:#e11d48;color:white;border-radius:10px;text-decoration:none\">NarxTop’da davom etish</a></p><p style=\"color:#75675f\">Agar tugma ishlamasa, havolani brauzerga ko‘chiring:<br><a href=\"" + escapeHtml(link) + "\">" + escapeHtml(link) + "</a></p></div>";
  const transport = smtpTransport();
  if (!transport) {
    if (process.env.NODE_ENV !== "production" && process.env.EMAIL_DEV_LOG_LINKS !== "false") {
      console.warn("[NarxTop development email] " + to + " | " + subject + " | " + link);
      return;
    }
    const e = new Error("EMAIL_NOT_CONFIGURED"); e.code = "EMAIL_NOT_CONFIGURED"; throw e;
  }
  await transport.sendMail({ from, to, subject, text, html });
}

function resetCodeHash(code, userId) {
  const secret = String(process.env.AUTH_SESSION_SECRET ?? "");
  if (secret.length < 32) throw new Error("AUTH_SESSION_SECRET must contain at least 32 characters.");
  return createHmac("sha256", secret).update(String(userId) + ":" + String(code)).digest("hex");
}

async function sendPasswordResetCode(to, code) {
  const from = process.env.EMAIL_FROM || process.env.SMTP_USER || "NarxTop <no-reply@narxtop.uz>";
  const subject = "NarxTop parolini tiklash kodi";
  const text = "Parolingizni tiklash uchun quyidagi tasdiqlash kodini kiriting: " + code + "\n\nKod 15 daqiqa amal qiladi. Agar bu so‘rovni siz yubormagan bo‘lsangiz, xatni e’tiborsiz qoldiring.";
  const html = "<div style=\"font:16px/1.55 Arial,sans-serif;color:#2a1d14\"><h2>Parolni tiklash</h2><p>NarxTop hisobingiz uchun tasdiqlash kodi:</p><p style=\"font-size:30px;font-weight:700;letter-spacing:8px\">" + escapeHtml(code) + "</p><p>Kod 15 daqiqa amal qiladi. Agar bu so‘rovni siz yubormagan bo‘lsangiz, xatni e’tiborsiz qoldiring.</p></div>";
  const transport = smtpTransport();
  if (!transport) {
    if (process.env.NODE_ENV !== "production" && process.env.EMAIL_DEV_LOG_LINKS !== "false") {
      console.warn("[NarxTop development email] " + to + " | " + subject + " | code: " + code);
      return;
    }
    const e = new Error("EMAIL_NOT_CONFIGURED"); e.code = "EMAIL_NOT_CONFIGURED"; throw e;
  }
  await transport.sendMail({ from, to, subject, text, html });
}

async function issuePasswordResetCode(db, user) {
  const tokens = db.collection("auth_tokens"), code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const row = { _id: randomUUID(), userId: String(user._id), kind: "reset_code", codeHash: resetCodeHash(code, user._id), attempts: 0, createdAt: new Date(), expiresAt: new Date(Date.now() + RESET_CODE_TTL) };
  await tokens.deleteMany({ userId: String(user._id), kind: { $in: ["reset", "reset_code"] } });
  await tokens.insertOne(row);
  try { await sendPasswordResetCode(user.email, code); }
  catch (error) { await tokens.deleteOne({ _id: row._id }); throw error; }
}

function sessionDetails(req) {
  const ua = String(req.headers?.["user-agent"] ?? "").slice(0, 512);
  const isIOS = /iPhone|iPad|iPod/i.test(ua), isAndroid = /Android/i.test(ua), isWindows = /Windows/i.test(ua), isMac = /Macintosh|Mac OS/i.test(ua), isLinux = /Linux/i.test(ua);
  const platform = isIOS ? (/iPad/i.test(ua) ? "iPadOS" : "iOS") : isAndroid ? "Android" : isWindows ? "Windows" : isMac ? "macOS" : isLinux ? "Linux" : "Unknown device";
  const browser = /Edg\//i.test(ua) ? "Edge" : /Firefox\//i.test(ua) ? "Firefox" : /OPR\//i.test(ua) ? "Opera" : /Chrome\//i.test(ua) ? "Chrome" : /Safari\//i.test(ua) ? "Safari" : "Browser";
  let city = "", country = "";
  if (process.env.TRUST_PROXY) {
    city = clean(req.headers?.["cf-ipcity"] || req.headers?.["x-vercel-ip-city"] || req.headers?.["x-appengine-city"] || req.headers?.["x-geo-city"], 80);
    country = clean(req.headers?.["cf-ipcountry"] || req.headers?.["x-vercel-ip-country"] || req.headers?.["x-geo-country"], 48);
  }
  return { device: platform + " · " + browser, location: [city, country].filter(Boolean).join(", ") || "" };
}

async function saveSession(db, userId, sessionId, req, createdAt = new Date()) {
  const details = sessionDetails(req), now = new Date();
  await db.collection("auth_sessions").updateOne(
    { _id: sessionId, userId: String(userId) },
    { $set: { lastSeenAt: now }, $setOnInsert: { userId: String(userId), ...details, createdAt, expiresAt: new Date(createdAt.getTime() + SESSION_MAX_AGE_SECONDS * 1000) } },
    { upsert: true },
  );
}

async function startSession(db, res, req, user) {
  const sessionId = randomUUID();
  await saveSession(db, user._id, sessionId, req);
  setSessionCookie(res, user, sessionId);
  return sessionId;
}

async function ensureCurrentSession(db, req, res, session) {
  const sessionId = session.sessionId || randomUUID();
  if (!session.sessionId) setSessionCookie(res, session.row, sessionId);
  await saveSession(db, session.user.id, sessionId, req);
  return sessionId;
}

async function issueEmailToken(db, user, kind) {
  const raw = randomBytes(32).toString("base64url");
  await db.collection("auth_tokens").insertOne({
    _id: tokenHash(raw),
    userId: String(user._id),
    kind,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + TOKEN_TTL[kind]),
  });
  const description = kind === "confirm"
    ? "Email manzilingizni tasdiqlash uchun quyidagi tugmani bosing. Havola 24 soat amal qiladi."
    : "Parolingizni yangilash uchun quyidagi tugmani bosing. Havola 1 soat amal qiladi.";
  try {
    await sendAccountEmail({
      to: user.email,
      subject: kind === "confirm" ? "NarxTop email manzilini tasdiqlang" : "NarxTop parolini tiklash",
      heading: kind === "confirm" ? "Email manzilingizni tasdiqlang" : "Parolni tiklash",
      description,
      token: raw,
      route: kind === "confirm" ? "/auth/confirm" : "/reset-password",
    });
  } catch (error) {
    await db.collection("auth_tokens").deleteOne({ _id: tokenHash(raw) });
    throw error;
  }
}

function rateGate(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const prior = (hits.get(key) || []).filter((time) => now - time < windowMs);
    if (prior.length >= max) { hits.set(key, prior); return false; }
    prior.push(now); hits.set(key, prior);
    if (hits.size > 5000) for (const [k, values] of hits) if (!values.some((time) => now - time < windowMs)) hits.delete(k);
    return true;
  };
}

const emailGate = rateGate(4, 60 * 60 * 1000);
const codeGate = rateGate(8, 15 * 60 * 1000);
const passwordGate = rateGate(8, 15 * 60 * 1000);
const OAUTH_STATE_COOKIE = "narxtop_oauth_state";

function readOAuthStateCookie(req) {
  for (const item of String(req.headers?.cookie ?? "").split(";")) {
    const index = item.indexOf("=");
    if (index < 0 || item.slice(0, index).trim() !== OAUTH_STATE_COOKIE) continue;
    try { return decodeURIComponent(item.slice(index + 1).trim()); } catch { return ""; }
  }
  return "";
}

function setOAuthStateCookie(res, state, maxAge = 600) {
  const fields = [OAUTH_STATE_COOKIE + "=" + encodeURIComponent(state), "Path=/api/auth/google", "HttpOnly", "SameSite=Lax", "Max-Age=" + maxAge];
  if (process.env.NODE_ENV === "production" || process.env.AUTH_COOKIE_SECURE === "true") fields.push("Secure");
  res.append("Set-Cookie", fields.join("; "));
}

function matchesOAuthState(left, right) {
  const a = Buffer.from(String(left ?? ""));
  const b = Buffer.from(String(right ?? ""));
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

async function touchUser(db, row) {
  const now = new Date();
  await db.collection("users").updateOne({ _id: row._id }, { $set: { lastSeenAt: now }, $inc: { signIns: 1 } });
  return { ...row, lastSeenAt: now, signIns: Number(row.signIns || 0) + 1 };
}

export function registerAuthRoutes(app, getDb) {
  const db = () => getDb();
  app.get("/api/auth/session", async (req, res) => {
    try {
      const result = await verifyUser(req);
      if (!result.user) return authFailure(res, result.status, "AUTH", result.message);
      await ensureCurrentSession(db(), req, res, result);
      res.set("Cache-Control", "no-store");
      res.json({ success: true, user: result.user });
    } catch (error) {
      console.error("session lookup failed:", error.message);
      authFailure(res, 500, "SERVER", "Could not load your session.");
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    const email = emailKey(req.body?.email), password = String(req.body?.password ?? "");
    const name = clean(req.body?.name, 80), secondName = clean(req.body?.secondName, 80);
    const phoneInput = clean(req.body?.phone, 40), phone = phoneInput ? normalizePhone(phoneInput) : "";
    if (!EMAIL_RE.test(email) || password.length < 8 || !name) return authFailure(res, 400, "INVALID_INPUT", "Ism, email yoki parol formati noto‘g‘ri.");
    if (phoneInput && (!phone || !validatePhoneNumber(phone))) return authFailure(res, 400, "PHONE_INVALID", "Enter a valid phone number.");
    if (!emailGate(email)) return authFailure(res, 429, "RATE_LIMIT", "Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring.");
    try {
      const users = db().collection("users"), prior = await users.findOne({ email });
      if (prior?.passwordHash || prior?.emailConfirmedAt) return authFailure(res, 409, "USER_EXISTS", "Bu email bilan akkaunt allaqachon mavjud.");
      const user = prior
        ? { ...prior, name: name || prior.name, secondName: secondName || prior.secondName || "", phone: phone || prior.phone || "", passwordHash: await hashPassword(password), provider: "email", providers: [...new Set([...(prior.providers || []), "email"])], emailConfirmedAt: null, sessionVersion: Number(prior.sessionVersion ?? 0) }
        : { _id: randomUUID(), email, name, secondName, phone, passwordHash: await hashPassword(password), provider: "email", providers: ["email"], emailConfirmedAt: null, createdAt: new Date(), lastSeenAt: null, signIns: 0, sessionVersion: 0 };
      if (prior) await users.updateOne({ _id: prior._id }, { $set: { name: user.name, secondName: user.secondName, phone: user.phone, passwordHash: user.passwordHash, provider: user.provider, providers: user.providers, emailConfirmedAt: null } });
      else await users.insertOne(user);
      await issueEmailToken(db(), user, "confirm");
      res.status(201).json({ success: true, confirmationRequired: true });
    } catch (error) {
      if (error?.code === 11000) return authFailure(res, 409, "USER_EXISTS", "Bu email bilan akkaunt allaqachon mavjud.");
      if (error?.code === "EMAIL_NOT_CONFIGURED") return authFailure(res, 503, "EMAIL_NOT_CONFIGURED", "Email yuborish sozlanmagan. SMTP ma’lumotlarini kiriting.");
      console.error("signup failed:", error.message);
      authFailure(res, 500, "SERVER", "Akkaunt yaratib bo‘lmadi.");
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const email = emailKey(req.body?.email), password = String(req.body?.password ?? "");
    try {
      const row = await db().collection("users").findOne({ email });
      if (!row?.passwordHash || !(await checkPassword(password, row.passwordHash))) return authFailure(res, 401, "INVALID_CREDENTIALS", "Email yoki parol noto‘g‘ri.");
      if (!row.emailConfirmedAt) return authFailure(res, 403, "EMAIL_NOT_CONFIRMED", "Avval email manzilingizni tasdiqlang.");
      const signedIn = await touchUser(db(), row);
      await startSession(db(), res, req, signedIn);
      res.set("Cache-Control", "no-store");
      res.json({ success: true, user: publicUser(signedIn) });
    } catch (error) {
      console.error("login failed:", error.message);
      authFailure(res, 500, "SERVER", "Tizimga kirib bo‘lmadi.");
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const session = await verifyUser(req);
      if (session.user?.id && session.sessionId) await db().collection("auth_sessions").deleteOne({ _id: session.sessionId, userId: session.user.id });
    } catch { /* Always clear the local cookie, even when the session already expired. */ }
    clearSessionCookie(res);
    res.json({ success: true });
  });

  app.post("/api/auth/confirm", async (req, res) => {
    const token = String(req.body?.token ?? "");
    if (token.length < 20 || token.length > 256) return authFailure(res, 400, "INVALID_TOKEN", "Tasdiqlash havolasi noto‘g‘ri yoki eskirgan.");
    try {
      const tokens = db().collection("auth_tokens"), id = tokenHash(token), row = await tokens.findOne({ _id: id, kind: "confirm", expiresAt: { $gt: new Date() } });
      if (!row) return authFailure(res, 400, "TOKEN_EXPIRED", "Tasdiqlash havolasi eskirgan yoki ishlatilgan.");
      const removed = await tokens.deleteOne({ _id: id });
      if (!removed.deletedCount) return authFailure(res, 400, "TOKEN_EXPIRED", "Tasdiqlash havolasi eskirgan yoki ishlatilgan.");
      await db().collection("users").updateOne({ _id: row.userId, emailConfirmedAt: null }, { $set: { emailConfirmedAt: new Date() } });
      res.json({ success: true });
    } catch (error) {
      console.error("email confirmation failed:", error.message);
      authFailure(res, 500, "SERVER", "Email tasdiqlanmadi.");
    }
  });

  app.post("/api/auth/resend-confirmation", async (req, res) => {
    const email = emailKey(req.body?.email);
    if (!EMAIL_RE.test(email)) return res.json({ success: true });
    if (!emailGate(email)) return authFailure(res, 429, "RATE_LIMIT", "Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring.");
    try {
      const user = await db().collection("users").findOne({ email, emailConfirmedAt: null });
      if (user) await issueEmailToken(db(), user, "confirm");
      res.json({ success: true });
    } catch (error) {
      console.error("confirmation resend failed:", error.message);
      authFailure(res, error?.code === "EMAIL_NOT_CONFIGURED" ? 503 : 500, error?.code || "SERVER", "Email yuborib bo‘lmadi.");
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    const email = emailKey(req.body?.email);
    if (!EMAIL_RE.test(email)) return res.json({ success: true });
    if (!emailGate(email)) return authFailure(res, 429, "RATE_LIMIT", "Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring.");
    try {
      const user = await db().collection("users").findOne({ email });
      if (user) await issuePasswordResetCode(db(), user);
      res.json({ success: true });
    } catch (error) {
      console.error("password recovery email failed:", error.message);
      authFailure(res, error?.code === "EMAIL_NOT_CONFIGURED" ? 503 : 500, error?.code || "SERVER", "Tiklash emaili yuborilmadi.");
    }
  });

  app.post("/api/auth/verify-reset-code", async (req, res) => {
    const email = emailKey(req.body?.email), code = String(req.body?.code ?? "").trim();
    if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(code)) return authFailure(res, 400, "INVALID_RESET_CODE", "Tasdiqlash kodi noto‘g‘ri yoki eskirgan.");
    if (!codeGate(email + ":" + String(req.ip ?? ""))) return authFailure(res, 429, "RATE_LIMIT", "Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring.");
    try {
      const users = db().collection("users"), tokens = db().collection("auth_tokens");
      const user = await users.findOne({ email });
      const row = user ? await tokens.findOne({ userId: String(user._id), kind: "reset_code", expiresAt: { $gt: new Date() } }) : null;
      if (!row || Number(row.attempts || 0) >= RESET_CODE_ATTEMPTS) return authFailure(res, 400, "TOKEN_EXPIRED", "Tasdiqlash kodi noto‘g‘ri yoki eskirgan.");
      const expected = Buffer.from(String(row.codeHash || ""), "hex");
      const provided = Buffer.from(resetCodeHash(code, user._id), "hex");
      if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
        const attempts = Number(row.attempts || 0) + 1;
        await tokens.updateOne({ _id: row._id, attempts: row.attempts ?? 0 }, { $set: { attempts } });
        if (attempts >= RESET_CODE_ATTEMPTS) await tokens.deleteOne({ _id: row._id });
        return authFailure(res, 400, "INVALID_RESET_CODE", "Tasdiqlash kodi noto‘g‘ri yoki eskirgan.");
      }
      res.json({ success: true });
    } catch (error) {
      console.error("password reset code verification failed:", error.message);
      authFailure(res, 500, "SERVER", "Tasdiqlash kodini tekshirib bo‘lmadi.");
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const token = String(req.body?.token ?? ""), password = String(req.body?.password ?? "");
    if (password.length < 8) return authFailure(res, 400, "WEAK_PASSWORD", "Parol kamida 8 ta belgidan iborat bo‘lishi kerak.");
    try {
      const tokens = db().collection("auth_tokens"), userCol = db().collection("users");
      const email = emailKey(req.body?.email), code = String(req.body?.code ?? "").trim();
      let row, user;
      if (code) {
        if (!/^\d{6}$/.test(code) || !EMAIL_RE.test(email)) return authFailure(res, 400, "INVALID_RESET_CODE", "Tasdiqlash kodi noto‘g‘ri yoki eskirgan.");
        user = await userCol.findOne({ email });
        row = user ? await tokens.findOne({ userId: String(user._id), kind: "reset_code", expiresAt: { $gt: new Date() } }) : null;
        if (!row || Number(row.attempts || 0) >= RESET_CODE_ATTEMPTS) return authFailure(res, 400, "TOKEN_EXPIRED", "Tasdiqlash kodi noto‘g‘ri yoki eskirgan.");
        const expected = Buffer.from(String(row.codeHash || ""), "hex"), provided = Buffer.from(resetCodeHash(code, user._id), "hex");
        const matches = expected.length === provided.length && timingSafeEqual(expected, provided);
        if (!matches) {
          const attempts = Number(row.attempts || 0) + 1;
          await tokens.updateOne({ _id: row._id, attempts: row.attempts ?? 0 }, { $set: { attempts } });
          if (attempts >= RESET_CODE_ATTEMPTS) await tokens.deleteOne({ _id: row._id });
          return authFailure(res, 400, "INVALID_RESET_CODE", "Tasdiqlash kodi noto‘g‘ri yoki eskirgan.");
        }
      } else {
        const id = tokenHash(token);
        row = await tokens.findOne({ _id: id, kind: "reset", expiresAt: { $gt: new Date() } });
        if (!row) return authFailure(res, 400, "TOKEN_EXPIRED", "Tiklash havolasi eskirgan yoki ishlatilgan.");
        user = await userCol.findOne({ _id: row.userId });
        if (!user) return authFailure(res, 400, "TOKEN_EXPIRED", "Akkaunt topilmadi.");
      }
      const passwordHash = await hashPassword(password);
      const removed = await tokens.deleteOne({ _id: row._id });
      if (!removed.deletedCount) return authFailure(res, 400, "TOKEN_EXPIRED", "Tiklash kodi eskirgan yoki ishlatilgan.");
      const providers = [...new Set([...(user.providers || [user.provider || "email"]), "email"])];
      await userCol.updateOne({ _id: user._id }, { $set: { passwordHash, providers, passwordChangedAt: new Date() }, $inc: { sessionVersion: 1 } });
      await tokens.deleteMany({ userId: String(user._id) });
      await db().collection("auth_sessions").deleteMany({ userId: String(user._id) });
      clearSessionCookie(res);
      res.json({ success: true });
    } catch (error) {
      console.error("password reset failed:", error.message);
      authFailure(res, 500, "SERVER", "Parolni yangilab bo‘lmadi.");
    }
  });

  app.post("/api/auth/password/verify", async (req, res) => {
    try {
      const session = await verifyUser(req);
      if (!session.user) return authFailure(res, session.status, "AUTH", session.message);
      if (!passwordGate(String(session.user.id))) return authFailure(res, 429, "RATE_LIMIT", "Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring.");
      const current = String(req.body?.currentPassword ?? "");
      const row = await db().collection("users").findOne({ _id: session.user.id });
      if (!row?.passwordHash || !current || !(await checkPassword(current, row.passwordHash))) return authFailure(res, 401, "INVALID_CREDENTIALS", "Joriy parol noto‘g‘ri.");
      res.set("Cache-Control", "no-store");
      res.json({ success: true });
    } catch (error) {
      console.error("current password verification failed:", error.message);
      authFailure(res, 500, "SERVER", "Parolni tekshirib bo‘lmadi.");
    }
  });

  app.put("/api/auth/password", async (req, res) => {
    try {
      const session = await verifyUser(req);
      if (!session.user) return authFailure(res, session.status, "AUTH", session.message);
      if (!passwordGate(String(session.user.id))) return authFailure(res, 429, "RATE_LIMIT", "Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring.");
      const sessionId = await ensureCurrentSession(db(), req, res, session);
      const current = String(req.body?.currentPassword ?? ""), password = String(req.body?.password ?? "");
      if (password.length < 8) return authFailure(res, 400, "WEAK_PASSWORD", "Parol kamida 8 ta belgidan iborat bo‘lishi kerak.");
      const userCol = db().collection("users"), row = await userCol.findOne({ _id: session.user.id });
      if (row.passwordHash && !(await checkPassword(current, row.passwordHash))) return authFailure(res, 401, "INVALID_CREDENTIALS", "Joriy parol noto‘g‘ri.");
      const providers = [...new Set([...(row.providers || [row.provider || "email"]), "email"])];
      const sessionVersion = Number(row.sessionVersion ?? 0) + 1;
      await userCol.updateOne({ _id: row._id }, { $set: { passwordHash: await hashPassword(password), providers, passwordChangedAt: new Date(), sessionVersion } });
      await db().collection("auth_sessions").deleteMany({ userId: String(session.user.id), _id: { $ne: sessionId } });
      await db().collection("auth_sessions").updateOne({ _id: sessionId, userId: String(session.user.id) }, { $set: { expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000) } });
      setSessionCookie(res, { ...row, sessionVersion }, sessionId);
      res.json({ success: true });
    } catch (error) {
      console.error("password update failed:", error.message);
      authFailure(res, 500, "SERVER", "Parolni o‘zgartirib bo‘lmadi.");
    }
  });

  app.patch("/api/auth/profile", async (req, res) => {
    try {
      const session = await verifyUser(req);
      if (!session.user) return authFailure(res, session.status, "AUTH", session.message);
      const fields = req.body ?? {};
      const set = {};
      if (fields.name !== undefined) set.name = clean(fields.name, 80);
      if (fields.second_name !== undefined) set.secondName = clean(fields.second_name, 80);
      if (fields.phone !== undefined) {
        /* the phone number is required now: it can be changed, but never emptied */
        const phone = normalizePhone(clean(fields.phone, 40));
        if (!phone || !hasValidPhone(phone)) return authFailure(res, 400, "PHONE_INVALID", "Enter a valid phone number.");
        set.phone = phone;
      }
      if (fields.avatar_color !== undefined && /^#[\da-f]{6}$/i.test(String(fields.avatar_color))) set.avatarColor = String(fields.avatar_color);
      if (fields.avatar_url === null) set.googlePicture = null;
      if (Object.keys(set).length) await db().collection("users").updateOne({ _id: session.user.id }, { $set: set });
      const row = await db().collection("users").findOne({ _id: session.user.id });
      res.json({ success: true, user: publicUser(row) });
    } catch (error) {
      console.error("profile update failed:", error.message);
      authFailure(res, 500, "SERVER", "Profilni saqlab bo‘lmadi.");
    }
  });

  /* Required phone number (the website blocks every page until a signed-in user adds one).
   * Unlike PATCH /profile this refuses an empty or incomplete number, and stores it on the MongoDB `users` document. */
  app.put("/api/auth/phone", async (req, res) => {
    try {
      const session = await verifyUser(req);
      if (!session.user) return authFailure(res, session.status, "AUTH", session.message);
      const phone = normalizePhone(clean(req.body?.phone, 40));
      if (!phone || !hasValidPhone(phone)) return authFailure(res, 400, "PHONE_INVALID", "Enter a valid phone number.");
      await db().collection("users").updateOne({ _id: session.user.id }, { $set: { phone, phoneAddedAt: new Date() } });
      const row = await db().collection("users").findOne({ _id: session.user.id });
      res.json({ success: true, user: publicUser(row) });
    } catch (error) {
      console.error("phone save failed:", error.message);
      authFailure(res, 500, "SERVER", "Telefon raqamini saqlab bo‘lmadi.");
    }
  });

  app.post("/api/auth/logout-others", async (req, res) => {
    const session = await verifyUser(req);
    if (!session.user) return authFailure(res, session.status, "AUTH", session.message);
    const sessionId = await ensureCurrentSession(db(), req, res, session);
    const sessionVersion = Number(session.row.sessionVersion ?? 0) + 1;
    await db().collection("users").updateOne({ _id: session.user.id }, { $set: { sessionVersion } });
    await db().collection("auth_sessions").deleteMany({ userId: String(session.user.id), _id: { $ne: sessionId } });
    await db().collection("auth_sessions").updateOne({ _id: sessionId, userId: String(session.user.id) }, { $set: { expiresAt: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000) } });
    setSessionCookie(res, { ...session.row, sessionVersion }, sessionId);
    res.json({ success: true });
  });

  app.get("/api/auth/sessions", async (req, res) => {
    try {
      const session = await verifyUser(req);
      if (!session.user) return authFailure(res, session.status, "AUTH", session.message);
      const currentSessionId = await ensureCurrentSession(db(), req, res, session);
      const rows = await db().collection("auth_sessions").find({ userId: String(session.user.id), expiresAt: { $gt: new Date() }, revokedAt: null }).sort({ lastSeenAt: -1 }).toArray();
      res.set("Cache-Control", "private, no-store");
      res.json({ success: true, currentSessionId, sessions: rows.map((row) => ({
        id: String(row._id), device: row.device || "Unknown device · Browser", location: row.location || "", createdAt: row.createdAt, lastSeenAt: row.lastSeenAt, current: String(row._id) === currentSessionId,
      })) });
    } catch (error) {
      console.error("session list failed:", error.message);
      authFailure(res, 500, "SERVER", "Could not load your devices.");
    }
  });

  app.post("/api/auth/sessions/location", async (req, res) => {
    try {
      const session = await verifyUser(req);
      if (!session.user) return authFailure(res, session.status, "AUTH", session.message);
      const latitude = Number(req.body?.latitude), longitude = Number(req.body?.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return authFailure(res, 400, "LOCATION_INVALID", "Location coordinates are invalid.");
      }
      const sessionId = await ensureCurrentSession(db(), req, res, session);
      const location = latitude.toFixed(2) + "°, " + longitude.toFixed(2) + "°";
      await db().collection("auth_sessions").updateOne(
        { _id: sessionId, userId: String(session.user.id) },
        { $set: { location, locationSource: "browser", locationUpdatedAt: new Date() } },
      );
      res.set("Cache-Control", "no-store");
      res.json({ success: true, location });
    } catch (error) {
      console.error("session location update failed:", error.message);
      authFailure(res, 500, "SERVER", "Could not update this device location.");
    }
  });

  app.post("/api/auth/session/heartbeat", async (req, res) => {
    try {
      const session = await verifyUser(req);
      if (!session.user) return authFailure(res, session.status, "AUTH", session.message);
      const sessionId = await ensureCurrentSession(db(), req, res, session);
      const lastSeenAt = new Date();
      await Promise.all([
        db().collection("auth_sessions").updateOne({ _id: sessionId, userId: String(session.user.id) }, { $set: { lastSeenAt } }),
        db().collection("users").updateOne({ _id: session.user.id }, { $set: { lastSeenAt } }),
      ]);
      res.json({ success: true });
    } catch (error) {
      console.error("session heartbeat failed:", error.message);
      authFailure(res, 500, "SERVER", "Could not update your session.");
    }
  });

  app.delete("/api/auth/sessions/:id", async (req, res) => {
    try {
      const session = await verifyUser(req);
      if (!session.user) return authFailure(res, session.status, "AUTH", session.message);
      const removed = await db().collection("auth_sessions").deleteOne({ _id: String(req.params.id ?? ""), userId: String(session.user.id) });
      if (!removed.deletedCount) return authFailure(res, 404, "SESSION_NOT_FOUND", "This session was not found or has already ended.");
      if (session.sessionId === String(req.params.id)) clearSessionCookie(res);
      res.json({ success: true, current: session.sessionId === String(req.params.id) });
    } catch (error) {
      console.error("session termination failed:", error.message);
      authFailure(res, 500, "SERVER", "Could not end this session.");
    }
  });

  /* Desktop app: swap the one-time code (from narxtop://auth?code=...) + the app's secret verifier for a normal session cookie. */
  app.post("/api/auth/desktop-exchange", async (req, res) => {
    const code = String(req.body?.code ?? ""), verifier = String(req.body?.verifier ?? "");
    if (code.length < 20 || code.length > 256 || verifier.length < 20 || verifier.length > 256) return authFailure(res, 400, "INVALID_TOKEN", "Invalid sign-in code.");
    try {
      const row = await db().collection("auth_tokens").findOneAndDelete({ _id: tokenHash(code), kind: "desktop", expiresAt: { $gt: new Date() } });
      if (!row || !matchesOAuthState(createHash("sha256").update(verifier).digest("base64url"), row.challenge)) return authFailure(res, 400, "TOKEN_EXPIRED", "Sign-in code expired. Please try again.");
      const user = await db().collection("users").findOne({ _id: row.userId });
      if (!user) return authFailure(res, 400, "TOKEN_EXPIRED", "Sign-in code expired. Please try again.");
      await startSession(db(), res, req, user);
      res.set("Cache-Control", "no-store");
      res.json({ success: true, user: publicUser(user), next: nextPath(row.next) });
    } catch (error) {
      console.error("desktop sign-in exchange failed:", error.message);
      authFailure(res, 500, "SERVER", "Could not finish sign-in.");
    }
  });

  app.get("/api/auth/google", async (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) return res.redirect(FRONTEND_URL() + "/auth?error=google");
    try {
      const state = randomBytes(32).toString("base64url");
      const verifier = randomBytes(48).toString("base64url");
      const challenge = createHash("sha256").update(verifier).digest("base64url");
      // Desktop app (.exe): the sign-in runs in the system browser; this challenge lets the app claim the session afterwards.
      const desktopChallenge = typeof req.query?.desktop_challenge === "string" && /^[A-Za-z0-9_-]{43}$/.test(req.query.desktop_challenge) ? req.query.desktop_challenge : null;
      await db().collection("auth_oauth_states").insertOne({ _id: state, verifier, next: nextPath(req.query?.next), ...(desktopChallenge ? { desktopChallenge } : {}), createdAt: new Date(), expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
      setOAuthStateCookie(res, state);
      const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
      url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: originForGoogle(),
        response_type: "code",
        scope: "openid email profile",
        state,
        code_challenge: challenge,
        code_challenge_method: "S256",
        prompt: "select_account",
      }).toString();
      res.redirect(url.toString());
    } catch (error) {
      console.error("Google OAuth start failed:", error.message);
      res.redirect(FRONTEND_URL() + "/auth?error=google");
    }
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    let state = null;
    try {
      const returnedState = typeof req.query?.state === "string" ? req.query.state : "";
      if (matchesOAuthState(returnedState, readOAuthStateCookie(req))) {
        const states = db().collection("auth_oauth_states");
        state = await states.findOneAndDelete({ _id: returnedState, expiresAt: { $gt: new Date() } });
      }
      setOAuthStateCookie(res, "", 0);
      if (!state || req.query?.error || !req.query?.code) throw new Error("OAUTH_DENIED");
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code: String(req.query.code),
          client_id: String(process.env.GOOGLE_CLIENT_ID || ""),
          client_secret: String(process.env.GOOGLE_CLIENT_SECRET || ""),
          redirect_uri: originForGoogle(),
          grant_type: "authorization_code",
          code_verifier: state.verifier,
        }),
      });
      const tokenBody = await tokenResponse.json().catch(() => null);
      if (!tokenResponse.ok || !tokenBody?.access_token) throw new Error("GOOGLE_TOKEN_EXCHANGE_FAILED");
      const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: "Bearer " + tokenBody.access_token } });
      const profile = await profileResponse.json().catch(() => null);
      if (!profileResponse.ok || !profile?.sub || !profile?.email || !(profile.email_verified === true || profile.email_verified === "true")) throw new Error("GOOGLE_EMAIL_UNVERIFIED");
      const users = db().collection("users"), email = emailKey(profile.email), now = new Date();
      let row = await users.findOne({ googleSub: String(profile.sub) }) || await users.findOne({ email });
      if (row) {
        const providers = [...new Set([...(row.providers || [row.provider || "email"]), "google"])];
        await users.updateOne({ _id: row._id }, { $set: { googleSub: String(profile.sub), email, emailConfirmedAt: row.emailConfirmedAt || now, googlePicture: profile.picture || row.googlePicture || null, providers, provider: row.provider === "email" && row.passwordHash ? "email" : "google", lastSeenAt: now }, $inc: { signIns: 1 } });
        row = await users.findOne({ _id: row._id });
      } else {
        row = {
          _id: randomUUID(), email, name: clean(profile.given_name || profile.name || email.split("@")[0], 80),
          secondName: clean(profile.family_name, 80), phone: "", googleSub: String(profile.sub), googlePicture: profile.picture || null,
          provider: "google", providers: ["google"], emailConfirmedAt: now,
          createdAt: now, lastSeenAt: now, signIns: 1, sessionVersion: 0,
        };
        try { await users.insertOne(row); }
        catch (error) {
          if (error?.code !== 11000) throw error;
          row = await users.findOne({ googleSub: String(profile.sub) }) || await users.findOne({ email });
          if (!row) throw error;
          if (!row.googleSub) await users.updateOne({ _id: row._id }, { $set: { googleSub: String(profile.sub), emailConfirmedAt: row.emailConfirmedAt || now, providers: [...new Set([...(row.providers || [row.provider || "email"]), "google"])], googlePicture: profile.picture || null }, $inc: { signIns: 1 } });
          row = await users.findOne({ _id: row._id });
        }
      }
      res.set("Cache-Control", "no-store");
      if (state.desktopChallenge) {
        const code = randomBytes(32).toString("base64url");
        await db().collection("auth_tokens").insertOne({ _id: tokenHash(code), kind: "desktop", userId: row._id, challenge: state.desktopChallenge, next: nextPath(state.next), expiresAt: new Date(Date.now() + 2 * 60 * 1000) });
        const link = "narxtop://auth?code=" + encodeURIComponent(code);
        return res.status(200).type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="refresh" content="0;url=${link}"><title>Narx.top</title><style>body{font:16px system-ui,sans-serif;background:#0b0705;color:#f5e9dc;display:grid;place-items:center;min-height:100vh;margin:0;text-align:center}a{display:inline-block;margin-top:16px;padding:12px 22px;border-radius:12px;background:#ff7a1a;color:#fff;text-decoration:none;font-weight:700}</style></head><body><div><h2>Narx.top</h2><p>Opening the Narx.top app… you can close this tab.</p><a href="${link}">Open Narx.top</a></div></body></html>`);
      }
      await startSession(db(), res, req, row);
      res.redirect(FRONTEND_URL() + nextPath(state.next));
    } catch (error) {
      console.warn("Google OAuth callback failed:", error.message);
      const failure = error.message === "EMAIL_NOT_CONFIRMED" ? "confirm" : "google";
      res.redirect(FRONTEND_URL() + "/auth?error=" + failure);
    }
  });
}
