import { useRef, useState } from "react";

import Icon from "../ui/Icon";
import StoreMark from "../products/StoreMark";
import { useCatalog } from "../../context/CatalogContext";
import { setStoreLogo } from "../../lib/storeLogos";
import { toast } from "../../lib/toast";
import { adminApi } from "../../services/admin";

const MAX_SIDE = 160; // px — logos are tiny badges; the browser shrinks the picture before upload

/* Reads an image file and returns a small PNG data URL (SVG is passed through unchanged, it is already tiny). */
async function toLogoDataUrl(file) {
  if (!/^image\//.test(file.type)) throw new Error("Rasm faylini tanlang (PNG, JPG, WebP yoki SVG).");
  if (file.type === "image/svg+xml") {
    if (file.size > 150_000) throw new Error("SVG juda katta.");
    return new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
  }
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return c.toDataURL("image/png");
}

/* Settings → Store logos. Saved in MongoDB, so every visitor sees them next to prices and in the cart. */
export default function StoreLogosCard() {
  const { products } = useCatalog();
  const chains = [...new Set(products.flatMap((p) => p.prices.map((o) => o.store)))].sort();
  const [busy, setBusy] = useState("");
  const input = useRef(null);
  const target = useRef("");

  const pick = (chain) => { target.current = chain; input.current?.click(); };
  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const chain = target.current;
    if (!file || !chain) return;
    setBusy(chain);
    try {
      const dataUrl = await toLogoDataUrl(file);
      await adminApi.setStoreLogo(chain, dataUrl);
      setStoreLogo(chain, dataUrl);
      toast(`${chain} logotipi saqlandi`);
    } catch (err) { toast(err.message || "Logotipni saqlab bo‘lmadi"); } finally { setBusy(""); }
  };
  const remove = async (chain) => {
    setBusy(chain);
    try { await adminApi.removeStoreLogo(chain); setStoreLogo(chain, null); toast(`${chain} logotipi o‘chirildi`); }
    catch (err) { toast(err.message); } finally { setBusy(""); }
  };

  return (
    <section className="adm-card">
      <header className="adm-card-head"><h3><Icon name="store" size={18} />Do‘kon logotiplari</h3></header>
      <p className="adm-logo-hint">Narxlar yonida va savatda ko‘rinadi. Kvadrat, shaffof PNG yoki SVG eng yaxshi chiqadi.</p>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden onChange={onFile} />
      {chains.length === 0 ? <p className="adm-logo-hint">Hali do‘konlar yo‘q — avval mahsulot qo‘shing.</p> : (
        <ul className="adm-logos">
          {chains.map((c) => (
            <li key={c}>
              <StoreMark chain={c} size={40} />
              <b>{c}</b>
              <button type="button" className="adm-btn is-sm" disabled={busy === c} onClick={() => pick(c)}><Icon name="download" size={15} className="adm-flip" />Yuklash</button>
              <button type="button" className="adm-icon-btn" disabled={busy === c} onClick={() => remove(c)} aria-label={`${c} logotipini o‘chirish`} title="Yuklangan logotipni o‘chirish"><Icon name="trash" size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
