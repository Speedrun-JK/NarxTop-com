/* Store logos (Korzinka / Makro / Havas …) uploaded in the admin panel and stored in MongoDB, so EVERY visitor sees them
 * next to prices and in the cart (the original NarxTop only kept them in the admin's own browser).
 *
 *   GET    /api/store-logos                   public: { logos: { korzinka: "data:image/png;base64,…" } }
 *   PUT    /api/admin/store-logos/:chain      admin:  { dataUrl }  — replaces the logo
 *   DELETE /api/admin/store-logos/:chain      admin:  back to the built-in icon / bundled file
 *
 * Logos are tiny (the browser shrinks them to ≤ 160 px before upload) and are only ever rendered through <img>,
 * which cannot run scripts even for SVG. Keys are the lower-case chain name without spaces/punctuation. */
import { requireCatalogManager as defaultRequireCatalogManager } from "./auth.js";
import { logAction } from "./admin.js";

export const MAX_LOGO_CHARS = 260_000; // data-URL length (≈ 190 kB of image)
const DATA_URL = /^data:image\/(?:png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+={0,2}$/;

export const logoKey = (chain) => String(chain ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 40);

export function validateLogo(dataUrl) {
  const s = typeof dataUrl === "string" ? dataUrl.trim() : "";
  if (!DATA_URL.test(s)) return { ok: false, error: "Logo PNG, JPG, WebP yoki SVG rasm bo‘lishi kerak." };
  if (s.length > MAX_LOGO_CHARS) return { ok: false, error: "Logo juda katta (eng ko‘pi bilan ≈190 KB)." };
  return { ok: true, value: s };
}

export function registerStoreLogoRoutes(app, getDb, deps = {}) {
  const requireAdmin = deps.requireCatalogManager ?? deps.requireAdmin ?? defaultRequireCatalogManager;
  const col = () => getDb().collection("store_logos");
  const wrap = (fn) => async (req, res) => {
    try { await fn(req, res); } catch (e) { console.error(e); if (!res.headersSent) res.status(500).json({ success: false, message: "Server error" }); }
  };

  app.get("/api/store-logos", wrap(async (req, res) => {
    const rows = await col().find({}).limit(200).toArray();
    res.set("Cache-Control", "public, max-age=60");
    res.json({ success: true, logos: Object.fromEntries(rows.map((r) => [r._id, r.dataUrl])) });
  }));

  app.put("/api/admin/store-logos/:chain", requireAdmin, wrap(async (req, res) => {
    const key = logoKey(req.params.chain);
    if (!key) return res.status(400).json({ success: false, message: "Do‘kon nomi noto‘g‘ri." });
    const v = validateLogo(req.body?.dataUrl);
    if (!v.ok) return res.status(400).json({ success: false, message: v.error });
    await col().updateOne({ _id: key }, { $set: { chain: String(req.params.chain).slice(0, 60), dataUrl: v.value, updatedAt: new Date(), updatedBy: String(req.admin?.email ?? "") } }, { upsert: true });
    await logAction(getDb(), req.admin, "logo.set", key);
    res.json({ success: true, key });
  }));

  app.delete("/api/admin/store-logos/:chain", requireAdmin, wrap(async (req, res) => {
    const key = logoKey(req.params.chain);
    const r = await col().deleteOne({ _id: key });
    if (!r.deletedCount) return res.status(404).json({ success: false, message: "Bu do‘kon uchun logo yo‘q." });
    await logAction(getDb(), req.admin, "logo.remove", key);
    res.json({ success: true });
  }));
}
