import { ObjectId } from "mongodb";
import { verifyUser as defaultVerifyUser } from "./auth.js";
import { requestToken } from "./auth.js";

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const iso = (date) => date instanceof Date ? date.toISOString() : date ?? null;
const row = (item) => ({ id: String(item._id), query: item.query, createdAt: iso(item.createdAt) });
const cleanQuery = (value) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 160);
const queryKey = (value) => cleanQuery(value).normalize("NFKC").toLocaleLowerCase();
const validSessionId = (value) => /^[a-zA-Z0-9_-]{20,128}$/.test(String(value ?? ""));

export async function ensureSearchHistoryIndexes(db) {
  await db.collection("search_history").createIndex({ ownerId: 1, queryKey: 1 }, { unique: true });
  await db.collection("search_history").createIndex({ ownerId: 1, createdAt: -1 });
}

export function registerSearchHistoryRoutes(app, getDb, deps = {}) {
  const verifyUser = deps.verifyUser ?? defaultVerifyUser;
  const collection = () => getDb().collection("search_history");
  const buckets = new Map();

  const resolveOwner = async (req, res, next) => {
    try {
      const token = requestToken(req);
      if (token) {
        const result = await verifyUser(req);
        if (!result.user?.id) return fail(res, result.status ?? 401, result.message ?? "Unauthorized");
        req.searchHistoryOwner = { ownerId: `user:${result.user.id}`, userId: result.user.id };
        return next();
      }

      const sessionId = req.query?.sessionId ?? req.body?.sessionId;
      if (!validSessionId(sessionId)) return fail(res, 400, "A valid guest search session is required.");
      req.searchHistoryOwner = { ownerId: `guest:${sessionId}`, sessionId: String(sessionId) };
      next();
    } catch (error) {
      console.error("search history auth failed:", error.message);
      fail(res, 500, "Search history is unavailable.");
    }
  };

  const limitWrites = (req, res, next) => {
    const ownerId = req.searchHistoryOwner.ownerId;
    const now = Date.now();
    let bucket = buckets.get(ownerId);
    if (!bucket || now - bucket.at >= 60_000) bucket = { at: now, count: 0 };
    bucket.count += 1;
    buckets.set(ownerId, bucket);
    if (bucket.count > 30) return fail(res, 429, "Please wait before saving more searches.");
    next();
  };

  const recent = async (ownerId) => {
    return collection().find({ ownerId }).sort({ createdAt: -1, _id: -1 }).toArray();
  };

  app.get("/api/search/history", resolveOwner, async (req, res) => {
    try {
      res.set("Cache-Control", "no-store");
      res.json({ success: true, history: (await recent(req.searchHistoryOwner.ownerId)).slice(0, 10).map(row) });
    } catch (error) {
      console.error("search history read failed:", error.message);
      fail(res, 500, "Could not load search history.");
    }
  });

  app.post("/api/search/history", resolveOwner, limitWrites, async (req, res) => {
    const query = cleanQuery(req.body?.query);
    const normalized = queryKey(query);
    if (!normalized) return fail(res, 400, "Enter a search term first.");
    const owner = req.searchHistoryOwner;
    const now = new Date();
    try {
      await collection().updateOne(
        { ownerId: owner.ownerId, queryKey: normalized },
        { $set: { query, createdAt: now, updatedAt: now, userId: owner.userId ?? null, sessionId: owner.sessionId ?? null }, $setOnInsert: { ownerId: owner.ownerId, queryKey: normalized } },
        { upsert: true },
      );
      const entries = await recent(owner.ownerId);
      const overflow = entries.slice(10);
      if (overflow.length) await collection().deleteMany({ _id: { $in: overflow.map((entry) => entry._id) }, ownerId: owner.ownerId });
      res.json({ success: true, history: entries.slice(0, 10).map(row) });
    } catch (error) {
      console.error("search history save failed:", error.message);
      fail(res, 500, "Could not save search history.");
    }
  });

  app.delete("/api/search/history", resolveOwner, async (req, res) => {
    try {
      await collection().deleteMany({ ownerId: req.searchHistoryOwner.ownerId });
      res.json({ success: true });
    } catch (error) {
      console.error("search history clear failed:", error.message);
      fail(res, 500, "Could not clear search history.");
    }
  });

  app.delete("/api/search/history/:id", resolveOwner, async (req, res) => {
    if (!ObjectId.isValid(String(req.params.id))) return fail(res, 404, "Search history item not found.");
    try {
      const result = await collection().deleteOne({ _id: new ObjectId(String(req.params.id)), ownerId: req.searchHistoryOwner.ownerId });
      if (!result.deletedCount) return fail(res, 404, "Search history item not found.");
      res.json({ success: true });
    } catch (error) {
      console.error("search history delete failed:", error.message);
      fail(res, 500, "Could not remove search history item.");
    }
  });
}
