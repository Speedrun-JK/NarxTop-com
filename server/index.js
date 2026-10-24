import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { MongoClient, ServerApiVersion } from "mongodb";

import { registerCatalogRoutes, startIngestScheduler } from "./catalog.js";
import { ensureIndexes } from "./ingest.js";
import { registerAccountRoutes } from "./account.js";
import { registerAvatarRoutes } from "./avatar.js";
import { registerProductImageRoutes, ensureProductImageIndexes } from "./productImages.js";
import { registerContactRoutes } from "./contact.js";
import { registerAdminRoutes, ensureAdminIndexes } from "./admin.js";
import { registerPlusRoutes, ensurePlusIndexes } from "./plus.js";
import { registerReceiptRoutes, ensureReceiptIndexes } from "./receipts.js";
import { registerStoreLogoRoutes } from "./storeLogos.js";
import { registerSearchHistoryRoutes, ensureSearchHistoryIndexes } from "./searchHistory.js";
import { registerAuthRoutes, ensureAuthIndexes } from "./authRoutes.js";
import { registerChatRoutes, ensureChatIndexes, closeChatUser } from "./chat.js";
import { registerUserStateRoutes, ensureUserStateIndexes } from "./userState.js";
import { seedIfEmpty } from "./seed.js";
import { backfillDescriptionTranslations, removeStoredDescriptionTranslations } from "./descriptionTranslate.js";
import { ADMIN_API_VERSION } from "../shared/adminVersion.js";

import {
  translations,
  LANGUAGES,
} from "../shared/translations.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(PROJECT_ROOT, ".env.local") });
dotenv.config({ path: path.join(PROJECT_ROOT, ".env") }); // also allow a plain .env

const app = express();

const PORT = process.env.PORT || 5000;
const DIST_DIR = path.join(PROJECT_ROOT, "dist");
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "narxitop";

if (!MONGODB_URI) {
  console.error("❌ Missing MONGODB_URI in .env.local");
  process.exit(1);
}

// Behind Render / Nginx / Cloudflare the real client IP comes from X-Forwarded-For (rate limits use it).
if (process.env.TRUST_PROXY) app.set("trust proxy", /^\d+$/.test(process.env.TRUST_PROXY) ? Number(process.env.TRUST_PROXY) : process.env.TRUST_PROXY);
app.disable("x-powered-by");

// Small set of safe default headers (no extra dependency).
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(self), geolocation=(self)",
  });
  next();
});

app.use(
  cors({
    origin: [
      "http://127.0.0.1:5173",
      "http://localhost:5173",
      ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
      // extra browser origins that may call this API (comma separated), e.g. the Netlify site when the API runs elsewhere
      ...String(process.env.CORS_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean),
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-ingest-token"],
  })
);

app.use("/api/receipts", express.json({ limit: "3mb" })); // receipt images are compressed client-side and validated again on the server
app.use("/api/chat", express.json({ limit: "3mb" })); // chat photos are compressed client-side and validated again on the server
app.use(express.json({ limit: "1mb" })); // profile photos arrive as small base64 JPEGs
app.use(express.text({ type: "text/plain" }));

// Cookie-based sessions need an origin check for write requests, especially when
// the frontend and API are deployed on separate origins.
const allowedBrowserOrigins = new Set([
  "http://127.0.0.1:5173", "http://localhost:5173",
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.replace(/\/+$/, "")] : []),
  ...String(process.env.CORS_ORIGINS ?? "").split(",").map((origin) => origin.trim().replace(/\/+$/, "")).filter(Boolean),
]);
app.use("/api", (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || !req.headers.origin) return next();
  if (!allowedBrowserOrigins.has(String(req.headers.origin).replace(/\/+$/, ""))) return res.status(403).json({ success: false, message: "Origin not allowed." });
  next();
});

const client = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;
// Admin authorization resolves delegated roles from the same MongoDB user directory as the admin panel.
app.locals.getDb = () => db;

/* ------------------------------------------------------------------ */
/* Seed: copy every text from shared/translations.js into MongoDB.     */
/* Existing keys are overwritten, keys you added by hand are kept.     */
/* ------------------------------------------------------------------ */
async function seedTranslations() {
  const collection = db.collection("translations");

  for (const lang of LANGUAGES) {
    const set = { lang, updatedAt: new Date() };

    for (const [key, value] of Object.entries(translations[lang])) {
      // Mongo field names cannot contain "." — store keys with "|" instead.
      set[`messages.${key.replaceAll(".", "|")}`] = value;
    }

    await collection.updateOne(
      { _id: lang },
      { $set: set },
      { upsert: true }
    );
  }

  console.log(`✅ Translations seeded (${LANGUAGES.join(", ")})`);
}

/* ------------------------------ Routes ----------------------------- */

// While MongoDB is still connecting (or is down) data routes answer 503 instead of crashing.
app.use("/api", (req, res, next) => {
  if (db || req.path === "/health") return next();
  res.status(503).json({ success: false, message: "Database is not connected yet." });
});

const catalog = registerCatalogRoutes(app, () => db);
registerAuthRoutes(app, () => db);
const chat = registerChatRoutes(app, () => db);
registerUserStateRoutes(app, () => db);
registerAccountRoutes(app, () => db);
registerAvatarRoutes(app, () => db);
registerProductImageRoutes(app, () => db);
registerContactRoutes(app, () => db);
registerAdminRoutes(app, () => db, { invalidate: catalog.invalidate, closeChatUser });
registerPlusRoutes(app, () => db); // NarxTop Plus: trial, plan, gifts (+ admin)
registerReceiptRoutes(app, () => db); // private user submissions and admin-only review/images
registerStoreLogoRoutes(app, () => db); // admin-uploaded supermarket logos
registerSearchHistoryRoutes(app, () => db); // per-account and anonymous search history

app.get("/api/health", async (req, res) => {
  try {
    if (!db) {
      return res
        .status(503)
        .json({ success: false, message: "Database is not connected.", adminApi: ADMIN_API_VERSION });
    }

    await db.command({ ping: 1 });

    res.json({
      success: true,
      message: "NarxTop API and MongoDB are connected.",
      database: MONGODB_DB_NAME,
      adminApi: ADMIN_API_VERSION, // the admin panel compares this to detect a server that was not restarted
    });
  } catch (error) {
    console.error("Health check error:", error);
    res
      .status(500)
      .json({ success: false, message: "MongoDB connection check failed." });
  }
});

app.get("/api/translations", (req, res) => {
  res.json({ success: true, languages: LANGUAGES });
});

app.get("/api/translations/:lang", async (req, res) => {
  const { lang } = req.params;

  if (!LANGUAGES.includes(lang)) {
    return res
      .status(404)
      .json({ success: false, message: "Unsupported language." });
  }

  try {
    const doc = await db
      .collection("translations")
      .findOne({ _id: lang });

    // Convert "nav|home" back to "nav.home"
    const messages = {};
    for (const [key, value] of Object.entries(doc?.messages || {})) {
      messages[key.replaceAll("|", ".")] = value;
    }

    res.json({ success: true, lang, messages });
  } catch (error) {
    console.error("Translations error:", error);
    res
      .status(500)
      .json({ success: false, message: "Could not load translations." });
  }
});

/* ------------------------- Fallbacks (JSON) ------------------------ */

// Unknown /api paths answer with JSON (never Express's HTML page), so the admin panel can tell
// "this server is older than the panel — restart it" apart from a real "not found".
app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    code: "api_not_found",
    message: `API yo‘li topilmadi: ${req.method} ${req.originalUrl}`,
  });
});

/* --------------------- Serve the React frontend -------------------- */

// Render builds the Vite frontend into dist/ before starting this server.
// Serve assets directly, then let React Router handle refreshes/deep links
// such as /auth/confirm, /reset-password, /account and /admin.
app.use(express.static(DIST_DIR, {
  index: false,
  setHeaders(res, file) {
    // hashed build files never change; index.html must always be re-checked
    if (/[\\/]assets[\\/]/.test(file)) res.set("Cache-Control", "public, max-age=31536000, immutable");
  },
}));
app.get("/{*splat}", (req, res, next) => {
  if (!req.accepts("html")) return next();
  res.set("Cache-Control", "no-cache");
  res.sendFile(path.join(DIST_DIR, "index.html"), (error) => {
    if (error) next(error);
  });
});

// Malformed / oversized request bodies and any uncaught route error.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "So‘rov formati noto‘g‘ri (JSON)." });
  }
  if (err?.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "So‘rov juda katta." });
  }
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Server error" });
});

/* ------------------------------ Start ------------------------------ */

async function startServer() {
  try {
    await client.connect();
    db = client.db(MONGODB_DB_NAME);
    await db.command({ ping: 1 });

    console.log("✅ Connected to MongoDB");
    console.log(`✅ Database: ${MONGODB_DB_NAME}`);

    await seedTranslations();
    try {
      // Product descriptions are now translated per product (descriptionI18n); drop the old stored description keys.
      const removed = await removeStoredDescriptionTranslations(db);
      if (removed) console.log(`✅ Removed ${removed} old product-description translation key(s)`);
    } catch (e) { console.warn("description translation cleanup skipped:", e.message); }
    await ensureIndexes(db);
    await ensureAuthIndexes(db);
    await ensureChatIndexes(db);
    await ensureUserStateIndexes(db);
    await ensureAdminIndexes(db);
    await ensureProductImageIndexes(db);
    await ensurePlusIndexes(db);
    await ensureReceiptIndexes(db);
    await ensureSearchHistoryIndexes(db);
    await seedIfEmpty(db);
    startIngestScheduler(() => db, catalog.invalidate);
    if (String(process.env.DESCRIPTION_BACKFILL ?? "").toLowerCase() !== "false") {
      // Background: translate descriptions of existing products that don't have ru/en yet. Never blocks startup.
      backfillDescriptionTranslations(db, { invalidate: catalog.invalidate, log: console.log }).catch((e) => console.warn("description translation backfill failed:", e.message));
    }

    httpServer = app.listen(PORT, () => {
      console.log(`✅ API server running on http://localhost:${PORT}`);
    });
    chat.attach(httpServer);
    httpServer.on("error", (error) => {
      console.error(error.code === "EADDRINUSE" ? `❌ Port ${PORT} is already in use (is another "npm run server" running?)` : `❌ ${error.message}`);
      process.exit(1);
    });
  } catch (error) {
    console.error("❌ Server startup failed:");
    console.error(error.message);
    process.exit(1);
  }
}

let httpServer;
let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    // stop taking new requests, let running ones finish (max 8 s), then close MongoDB
    const force = setTimeout(() => process.exit(1), 8000);
    force.unref();
    await new Promise((resolve) => (httpServer ? httpServer.close(() => resolve()) : resolve()));
    await client.close().catch(() => {});
    process.exit(0);
  });
}

process.on("unhandledRejection", (reason) => console.error("Unhandled rejection:", reason));

startServer();
