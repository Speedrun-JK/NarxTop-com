/* Delete the signed-in NarxTop account and its private MongoDB data. */
import { clearSessionCookie, verifyUser } from "./auth.js";

/* Removes one user and every private record that belongs to them. `withMessages` also removes their contact-form messages
 * (used when staff delete an account). Returns the number of documents removed per collection. */
export async function purgeUserData(db, id, { withMessages = false } = {}) {
  const jobs = [
    ["avatars", db.collection("avatars").deleteOne({ _id: id })],
    ["users", db.collection("users").deleteOne({ _id: id })],
    ["user_state", db.collection("user_state").deleteMany({ userId: id })],
    ["auth_tokens", db.collection("auth_tokens").deleteMany({ userId: id })],
    ["receipts", db.collection("receipts").deleteMany({ userId: id })],
    ["receipt_images", db.collection("receipt_images").deleteMany({ userId: id })],
    ["user_notifications", db.collection("user_notifications").deleteMany({ userId: id })],
    ["plus_subscriptions", db.collection("plus_subscriptions").deleteOne({ userId: id })],
    ["plus_gift_events", db.collection("plus_gift_events").deleteMany({ userId: id })],
    ["search_history", db.collection("search_history").deleteMany({ userId: id })],
  ];
  if (withMessages) jobs.push(["contact_messages", db.collection("contact_messages").deleteMany({ userId: id })]);
  const results = await Promise.all(jobs.map(([, job]) => job));
  return Object.fromEntries(jobs.map(([name], i) => [name, results[i]?.deletedCount ?? 0]));
}

export function registerAccountRoutes(app, getDb) {
  app.delete("/api/account", async (req, res) => {
    try {
      const session = await verifyUser(req);
      if (!session.user) return res.status(session.status || 401).json({ success: false, message: session.message || "Unauthorized" });
      const id = session.user.id, db = getDb();
      await purgeUserData(db, id);
      clearSessionCookie(res);
      res.json({ success: true });
    } catch (error) {
      console.error("account delete failed:", error.message);
      res.status(500).json({ success: false, message: "Could not delete account" });
    }
  });
}
