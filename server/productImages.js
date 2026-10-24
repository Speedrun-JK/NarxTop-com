import { randomUUID } from "node:crypto";
import { Binary } from "mongodb";
import { requireCatalogManager } from "./auth.js";

const MAX_BYTES = 512 * 1024;
const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/;
const IMAGE_PATH = /^\/api\/product-images\/([a-f\d-]{36})$/i;

export async function ensureProductImageIndexes(db) {
  await db.collection("product_images").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

export async function attachProductImage(db, image, slug) {
  const id = IMAGE_PATH.exec(String(image ?? ""))?.[1];
  if (!id) return;
  await db.collection("product_images").updateOne({ _id: id }, { $set: { slug, attachedAt: new Date() }, $unset: { expiresAt: "" } });
}

export function registerProductImageRoutes(app, getDb) {
  app.post("/api/admin/product-images", requireCatalogManager, async (req, res) => {
    try {
      const match = DATA_URL.exec(String(req.body?.image ?? ""));
      if (!match) return res.status(400).json({ success: false, message: "Upload a JPEG, PNG or WebP image." });
      const bytes = Buffer.from(match[2], "base64");
      if (!bytes.length || bytes.length > MAX_BYTES) return res.status(413).json({ success: false, message: "Optimized image must be 512 KB or smaller." });
      const id = randomUUID();
      await getDb().collection("product_images").insertOne({ _id: id, contentType: match[1], data: new Binary(bytes), size: bytes.length, createdAt: new Date(), expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
      res.status(201).json({ success: true, image: `/api/product-images/${id}` });
    } catch (error) {
      console.error("product image upload failed:", error.message);
      res.status(500).json({ success: false, message: "Could not save product image." });
    }
  });

  app.get("/api/product-images/:id", async (req, res) => {
    try {
      const id = String(req.params.id ?? "");
      if (!/^[a-f\d-]{36}$/i.test(id)) return res.status(404).end();
      const doc = await getDb().collection("product_images").findOne({ _id: id });
      if (!doc) return res.status(404).end();
      res.set({ "Content-Type": doc.contentType, "Content-Length": String(doc.size), "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" });
      res.end(Buffer.from(doc.data.value(true)));
    } catch (error) {
      console.error("product image read failed:", error.message);
      res.status(500).end();
    }
  });
}
