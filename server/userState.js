/* MongoDB persistence for per-account app state formerly stored in Supabase. */
import { requireUser } from "./auth.js";

const KEYS = new Set(["favorites", "purchases", "alerts", "notifications", "favoriteNotifications", "prefs"]);
const validShape = (key, value) => key === "alerts" || key === "prefs"
  ? value && typeof value === "object" && !Array.isArray(value)
  : Array.isArray(value);

export async function ensureUserStateIndexes(db) {
  await db.collection("user_state").createIndex({ userId: 1, key: 1 }, { unique: true });
  await db.collection("user_state").createIndex({ updatedAt: -1 });
}

export function registerUserStateRoutes(app, getDb) {
  const collection = () => getDb().collection("user_state");

  app.get("/api/user-state", requireUser, async (req, res) => {
    try {
      const rows = await collection().find({ userId: req.user.id }).toArray();
      res.set("Cache-Control", "private, no-store");
      res.json({ success: true, rows: rows.map((row) => ({ key: row.key, value: row.value, updated_at: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : row.updatedAt })) });
    } catch (error) {
      console.error("user state read failed:", error.message);
      res.status(500).json({ success: false, message: "Could not load account data." });
    }
  });

  app.put("/api/user-state", requireUser, async (req, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows.slice(0, 6) : [];
    if (!rows.length || rows.some((row) => !KEYS.has(row?.key) || !validShape(row.key, row.value))) {
      return res.status(400).json({ success: false, message: "Invalid account data." });
    }
    try {
      const userId = req.user.id;
      await Promise.all(rows.map((row) => {
        const parsed = Date.parse(row.updated_at ?? "");
        const updatedAt = Number.isFinite(parsed) ? new Date(parsed) : new Date();
        return collection().updateOne(
          { userId, key: row.key },
          { $set: { value: row.value, updatedAt }, $setOnInsert: { userId, key: row.key } },
          { upsert: true },
        );
      }));
      res.json({ success: true });
    } catch (error) {
      console.error("user state save failed:", error.message);
      res.status(500).json({ success: false, message: "Could not save account data." });
    }
  });
}
