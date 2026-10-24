import { memo, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

import Icon from "../ui/Icon";
import StoreMark from "./StoreMark";
import { previewClick, useProductPreview } from "./ProductPreview";
import { categoryTone } from "../home/CategoryNav";
import { useCart } from "../../context/CartContext";
import { useLang } from "../../context/LanguageContext";
import { useUserData } from "../../context/UserDataContext";
import { useCatalog } from "../../context/CatalogContext";
import { flyToCart } from "../../lib/fly";
import { formatPrice } from "../../lib/constants";
import { summarize } from "../../lib/product";
import { toast } from "../../lib/toast";
import { trackEvent } from "../../lib/events";
import { preloadProduct, preloadProductWhenIdle } from "../../lib/preload";
import { logoKey } from "../../lib/storeLogos";


/* Neutral, theme-friendly placeholder used when an image is missing or fails to load. */
const FALLBACK = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect x="110" y="120" width="180" height="160" rx="26" fill="none" stroke="#9a6a48" stroke-opacity=".45" stroke-width="10"/><path d="M110 170h180" stroke="#9a6a48" stroke-opacity=".45" stroke-width="10"/><circle cx="200" cy="225" r="14" fill="#e8527f" fill-opacity=".55"/></svg>`
);

export function Freshness({ fresh, className = "" }) {
  const { t } = useLang();
  if (!fresh) return null;
  const text = fresh.unit === "now" ? t("p.updated.now") : t(`p.updated.${fresh.unit}`, { n: fresh.value });
  return <span className={`nt-fresh ${fresh.stale ? "is-stale" : ""} ${className}`}>{text}</span>;
}

export function UnitPrice({ unit }) {
  const { t } = useLang();
  if (!unit) return null;
  return <span className="nt-unitprice">≈ {Math.round(unit.value).toLocaleString("uz-UZ")} UZS / {t(`p.per.${unit.per}`)}</span>;
}

function Heart({ active, onClick, label }) {
  return (
    <motion.button type="button" className={`tc-heart ${active ? "is-on" : ""}`} onClick={onClick} whileTap={{ scale: 0.82 }} aria-pressed={active} aria-label={label} title={label}>
      <motion.span animate={active ? { scale: [1, 1.3, 1] } : { scale: 1 }} transition={{ duration: 0.32 }} style={{ display: "grid" }}>
        <Icon name="heart" size={19} />
      </motion.span>
    </motion.button>
  );
}

function ProductCard({ product, index = 0, showDrop = true }) {
  const { t, tProduct } = useLang();
  const { items, addItem, setQty } = useCart();
  const { isFavorite, toggleFavorite } = useUserData();
  const { drops } = useCatalog();
  const [imgOk, setImgOk] = useState(true);
  const imgRef = useRef(null);
  const [preview, openPreview] = useProductPreview();
  useEffect(() => { preloadProductWhenIdle(); }, []);
  const qty = items.find((i) => i.slug === product.slug)?.qty ?? 0;

  const s = summarize(product, { drops });
  const fav = isFavorite(product.slug);
  const name = tProduct(product, "name");
  const rows = s.offers;
  const partial = !s.available || s.liveCount < s.total;

  const add = (e) => {
    e.preventDefault();
    if (!s.available) return;
    if (!addItem(product.slug)) return; // blocked by the free basket limit (a notice is shown)
    flyToCart(imgRef.current);
    trackEvent(product.slug, "cart");
    if (qty === 0) toast(t("p.added", { name }));
  };
  const step = (d) => (e) => { e.preventDefault(); setQty(product.slug, Math.min(99, qty + d)); };

  const dropPct = s.drop?.percent ?? (s.discount > 0 ? s.discount : 0);
  return (
    <motion.article
      className={`tc ${s.available ? "" : "is-unavailable"} ${s.cheapestVerified ? "has-cheapest" : ""} ${qty > 0 ? "has-qty" : ""}`}
      style={{ "--i": index % 8, ...categoryTone(product.category) }}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.38, delay: Math.min(index, 8) * 0.035, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="tc-photo">
        <Link to={`/product/${product.slug}`} className="tc-photo-link" aria-label={name} onClick={previewClick(openPreview, product)} onPointerEnter={preloadProduct} onFocus={preloadProduct} onTouchStart={preloadProduct}>
          <motion.img
            ref={imgRef}
            src={imgOk && product.image ? product.image : FALLBACK}
            alt=""
            loading={index < 4 ? "eager" : "lazy"}
            decoding="async"
            width="400"
            height="400"
            fetchPriority={index < 4 ? "high" : "auto"}
            onError={() => setImgOk(false)}
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 240, damping: 22 }}
          />
          <span className="tc-peek" aria-hidden="true"><Icon name="eye" size={15} strokeWidth={2.2} />{t("p.pv.quick")}</span>
        </Link>
        {showDrop && dropPct > 0 && <span className="tc-drop"><Icon name="trendDown" size={12} strokeWidth={2.6} />{dropPct}%</span>}
        <Heart active={fav} label={fav ? t("p.fav.remove") : t("p.fav.add")} onClick={(e) => { e.preventDefault(); toggleFavorite(product); if (!fav) trackEvent(product.slug, "favorite"); }} />
        {!s.available && <span className="tc-unavail">{t("p.unavailable")}</span>}
        {qty > 0 && <span className="tc-incart" aria-hidden="true"><Icon name="cart" size={13} strokeWidth={2.6} />{qty}</span>}
      </div>

      <Link to={`/product/${product.slug}`} className="tc-title" title={name} onClick={previewClick(openPreview, product)}>{name}</Link>

      <ul className="tc-offers">
        {rows.map((o, i) => {
          const isBest = s.cheapestVerified && o.inStock !== false && o.price === s.best.price;
          const out = o.inStock === false;
          return (
            <li key={`${o.store}-${o.storeId ?? i}`} data-store={logoKey(o.store)} className={`${isBest ? "is-best" : ""} ${out ? "is-out" : ""}`}>
              <StoreMark chain={o.store} size={26} />
              <span className="tc-store">{o.store}</span>
              <span className="tc-price">{out ? t("p.outOfStock") : formatPrice(o.price)}</span>
            </li>
          );
        })}
      </ul>

      {partial && <span className="tc-note">{s.available ? t("p.inStockAt", { n: s.liveCount, m: s.total }) : t("p.unavailable")}</span>}

      <div className="tc-foot">
        <AnimatePresence mode="wait" initial={false}>
          {qty > 0 ? (
            <motion.div key="step" className="tc-step" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.16 }} role="group" aria-label={name}>
              <button type="button" onClick={step(-1)} aria-label={t("p.cart.dec")}><Icon name={qty === 1 ? "trash" : "minus"} size={17} strokeWidth={2.4} /></button>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.output key={qty} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }} transition={{ duration: 0.14 }}>{qty}</motion.output>
              </AnimatePresence>
              <button type="button" onClick={add} aria-label={t("p.cart.inc")} disabled={qty >= 99}><Icon name="plus" size={17} strokeWidth={2.4} /></button>
            </motion.div>
          ) : (
            <motion.button key="add" type="button" className="tc-add" onClick={add} disabled={!s.available} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} whileTap={{ scale: 0.97 }} aria-label={`${t("p.add")}: ${name}`}>
              <span className="tc-add-ico" aria-hidden="true"><Icon name="cart" size={17} strokeWidth={2.2} /></span><span className="tc-add-txt">{t("p.add")}</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      {preview}
    </motion.article>
  );
}

export default memo(ProductCard);
