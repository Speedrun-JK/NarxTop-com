import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useDragControls } from "framer-motion";

import Icon from "../ui/Icon";
import { EyeButton, ImageViewer } from "../ui/ImageViewer";
import StoreMark from "./StoreMark";
import { useCart } from "../../context/CartContext";
import { useCatalog } from "../../context/CatalogContext";
import { useLang } from "../../context/LanguageContext";
import { useUserData } from "../../context/UserDataContext";
import { flyToCart } from "../../lib/fly";
import { formatPrice } from "../../lib/constants";
import { summarize } from "../../lib/product";
import { toast } from "../../lib/toast";
import { trackEvent } from "../../lib/events";
import { preloadProduct } from "../../lib/preload";
import useMediaQuery, { PHONE_QUERY } from "../../hooks/useMediaQuery";
import { discountPercent } from "../../../shared/core/promotions.js";

const FALLBACK = "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400"><rect x="110" y="120" width="180" height="160" rx="26" fill="none" stroke="#9a6a48" stroke-opacity=".45" stroke-width="10"/><path d="M110 170h180" stroke="#9a6a48" stroke-opacity=".45" stroke-width="10"/><circle cx="200" cy="225" r="14" fill="#e8527f" fill-opacity=".55"/></svg>`
);

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* Click handler for "open the quick look": plain left click opens the pop-up,
 * Ctrl / Cmd / Shift / middle click keep the normal link behaviour (new tab with the full page). */
export function previewClick(open, product) {
  return (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    open(product);
  };
}

/* const [node, openPreview] = useProductPreview();  ->  render {node} once, call openPreview(product) on click. */
export function useProductPreview() {
  const [product, setProduct] = useState(null);
  const open = useCallback((p) => setProduct(p), []);
  const close = useCallback(() => setProduct(null), []);
  const node = typeof document === "undefined" ? null : createPortal(
    <AnimatePresence>{product && <PreviewDialog key={product.slug} product={product} onClose={close} />}</AnimatePresence>,
    document.body,
  );
  return [node, open];
}

function PreviewDialog({ product, onClose }) {
  const { t, tProduct, tUnit, tCategory } = useLang();
  const { items, addItem, setQty } = useCart();
  const { isFavorite, toggleFavorite } = useUserData();
  const { drops } = useCatalog();
  const panel = useRef(null);
  const closeBtn = useRef(null);
  const imgRef = useRef(null);
  const [imgOk, setImgOk] = useState(true);
  const [viewing, setViewing] = useState(false);
  const viewingRef = useRef(false);
  viewingRef.current = viewing;
  const drag = useDragControls();
  const navigate = useNavigate();
  const isPhone = useMediaQuery(PHONE_QUERY); // phones: the preview is a full-screen sheet that slides up

  const slug = product.slug;
  const name = tProduct(product, "name");
  const desc = tProduct(product, "description");
  const s = useMemo(() => summarize(product, { drops }), [product, drops]);
  const qty = items.find((i) => i.slug === slug)?.qty ?? 0;
  const fav = isFavorite(slug);
  const cheaperPct = s.drop?.percent || s.spreadPct || 0;
  const maxPrice = Math.max(...s.offers.filter((o) => o.inStock !== false).map((o) => o.price), 1);
  const oldPrice = s.best.oldPrice > s.best.price ? s.best.oldPrice : null;

  /* keyboard: Esc closes, Tab stays inside, page behind does not scroll */
  useEffect(() => {
    const opener = document.activeElement;
    const root = document.documentElement;
    const prevOverflow = root.style.overflow;
    root.style.overflow = "hidden";
    closeBtn.current?.focus({ preventScroll: true });
    const onKey = (e) => {
      if (viewingRef.current) return; /* the full-photo viewer handles its own Esc */
      if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
      if (e.key !== "Tab" || !panel.current) return;
      const nodes = [...panel.current.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      root.style.overflow = prevOverflow;
      opener?.focus?.({ preventScroll: true });
    };
  }, [onClose]);

  const add = () => {
    if (!s.available) return;
    if (!addItem(slug)) return;
    flyToCart(imgRef.current);
    trackEvent(slug, "cart");
    if (qty === 0) toast(t("p.added", { name }));
  };

  /* every "full page" affordance: plain click closes the pop-up and opens the real product page */
  const fullPath = `/product/${slug}`;
  const goFull = (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onClose();
    navigate(fullPath);
  };
  const warm = { onPointerEnter: preloadProduct, onFocus: preloadProduct, onTouchStart: preloadProduct };

  return (
    <motion.div
      className="pv-scrim"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        ref={panel}
        className={`pv ${s.available ? "" : "is-unavailable"}`}
        role="dialog" aria-modal="true" aria-label={name}
        initial={isPhone ? { opacity: 1, y: "100%" } : { opacity: 0, y: 30, scale: 0.96 }}
        animate={isPhone ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, scale: 1 }}
        exit={isPhone ? { y: "100%", transition: { duration: 0.2, ease: "easeIn" } } : { opacity: 0, y: 20, scale: 0.98, transition: { duration: 0.16 } }}
        transition={isPhone ? { type: "tween", duration: 0.28, ease: [0.22, 1, 0.36, 1] } : { type: "spring", stiffness: 300, damping: 30 }}
        drag="y" dragControls={drag} dragListener={false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 600) onClose(); }}
      >
        <span className="pv-grab" onPointerDown={(e) => drag.start(e)} aria-hidden="true"><i /></span>

        {/* ---------- left: the product ---------- */}
        <div className="pv-stage">
          <img ref={imgRef} className="pv-img" src={imgOk && product.image ? product.image : FALLBACK} alt={name} onError={() => setImgOk(false)} draggable="false"
            {...(product.image && imgOk ? { role: "button", tabIndex: -1, onClick: () => setViewing(true) } : {})} />
          {product.image && imgOk && <EyeButton className="pv-eye" onClick={() => setViewing(true)} />}
          <div className="pv-tags">
            {cheaperPct > 0 && s.available && <span className="pv-tag is-drop"><Icon name="tag" size={15} strokeWidth={2.4} />{t("p.pv.cheaper", { n: cheaperPct })}</span>}
            {s.cheapestVerified && <span className="pv-tag"><Icon name="checkCircle" size={16} strokeWidth={2.4} />{t("p.badge.cheapest")}</span>}
          </div>
          <button type="button" className={`pv-heart ${fav ? "is-on" : ""}`} aria-pressed={fav} aria-label={fav ? t("p.fav.remove") : t("p.fav.add")} title={fav ? t("p.fav.remove") : t("p.fav.add")}
            onClick={() => { toggleFavorite(product); if (!fav) trackEvent(slug, "favorite"); }}>
            <Icon name="heart" size={20} />
          </button>
          {s.available && (
            <a href={fullPath} className="pv-best" onClick={goFull} {...warm}>
              <span className="pv-best-ico"><Icon name="cart" size={20} strokeWidth={2} /></span>
              <span className="pv-best-txt"><small>{t("p.pv.bestPrice")}</small><b><StoreMark chain={s.best.store} size={16} />{s.best.store}</b></span>
              <Icon name="arrowRight" size={17} strokeWidth={2.2} />
            </a>
          )}
        </div>

        {/* ---------- right: facts + actions ---------- */}
        <div className="pv-body">
          <button ref={closeBtn} type="button" className="pv-x" onClick={onClose} aria-label={t("p.pv.close")} title={`${t("p.pv.close")} · ${t("p.pv.esc")}`}><Icon name="x" size={20} strokeWidth={2.4} /></button>
          <div className="pv-scroll">
            <div className="pv-kicker">
              <span className="pv-cat">{product.category ? tCategory(product.category) : tUnit(product.unit)}</span>
              <span className="pv-quick">{t("p.pv.quick")}</span>
            </div>
            <h2 className="pv-title">{name}</h2>
            <div className="pv-meta"><span>{tUnit(product.unit)}</span>{s.total > 1 && <span>{t("p.pv.stores", { n: s.total })}</span>}</div>
            {desc && <p className="pv-desc">{desc}</p>}

            <div className={`pv-price ${s.cheapestVerified ? "is-cheapest" : ""}`}>
              <div className="pv-price-main">
                <span className="pv-price-label">{s.cheapestVerified && <Icon name="crown" size={15} />}{s.available ? t("p.from") : t("p.lastKnown")}</span>
                <strong>{formatPrice(s.best.price)}</strong>
                {oldPrice && <del>{formatPrice(oldPrice)}</del>}
              </div>
              {s.available && s.savingVsWorst > 0 && s.total > 1 && <span className="pv-save">{t("p.pv.save", { a: formatPrice(s.savingVsWorst) })}</span>}
            </div>

            <section className="pv-ladder" aria-label={t("p.pv.priceMap")}>
              <h3><Icon name="trendUp" size={18} strokeWidth={2} />{t("p.pv.priceMap")}<span>{s.liveCount}/{s.total}</span></h3>
              <ul>
                {s.offers.map((o, i) => {
                  const out = o.inStock === false;
                  const isBest = s.cheapestVerified && !out && o.price === s.best.price;
                  const off = discountPercent(o) || (isBest ? s.spreadPct : 0);
                  return (
                    <motion.li key={`${o.store}-${o.storeId ?? i}`} className={`${isBest ? "is-best" : ""} ${out ? "is-out" : ""}`}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + Math.min(i, 6) * 0.05, duration: 0.3 }}>
                      <a href={fullPath} className="pv-row" onClick={goFull} {...warm} aria-label={`${o.store}: ${out ? t("p.outOfStock") : formatPrice(o.price)}`}>
                        <StoreMark chain={o.store} size={24} />
                        <span className="pv-row-main">
                          <span className="pv-row-top">
                            <b className="pv-row-name">{o.store}</b>
                            {isBest && off > 0 && <em>−{off}%</em>}
                          </span>
                          <span className="pv-bar" aria-hidden="true"><i style={{ width: out ? "0%" : `${Math.max(12, Math.round((o.price / maxPrice) * 100))}%` }} /></span>
                        </span>
                        {!isBest && !out && o.price > s.best.price && <em className="pv-diff">+{formatPrice(o.price - s.best.price)}</em>}
                        <span className="pv-row-price">{out ? t("p.outOfStock") : formatPrice(o.price)}</span>
                        {isBest ? <i className="pv-ok"><Icon name="check" size={15} strokeWidth={3} /></i> : <Icon name="arrowRight" size={16} strokeWidth={2} className="pv-go" />}
                      </a>
                    </motion.li>
                  );
                })}
              </ul>
            </section>
          </div>

          <div className="pv-foot">
            <AnimatePresence mode="wait" initial={false}>
              {qty > 0 ? (
                <motion.div key="step" className="pv-step" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.14 }} role="group" aria-label={t("nav.cart")}>
                  <button type="button" onClick={() => setQty(slug, qty - 1)} aria-label={t("p.cart.dec")}><Icon name={qty === 1 ? "trash" : "minus"} size={18} strokeWidth={2.4} /></button>
                  <output aria-live="polite"><b>{qty}</b><small>{formatPrice(s.best.price * qty)}</small></output>
                  <button type="button" onClick={add} disabled={qty >= 99} aria-label={t("p.cart.inc")}><Icon name="plus" size={18} strokeWidth={2.4} /></button>
                </motion.div>
              ) : (
                <motion.button key="add" type="button" className="pv-add" onClick={add} disabled={!s.available} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.14 }} whileTap={{ scale: 0.97 }}>
                  <Icon name="cart" size={20} strokeWidth={2} />{s.available ? t("p.pv.addCart") : t("p.unavailable")}
                </motion.button>
              )}
            </AnimatePresence>
            <a href={fullPath} className="pv-full" onClick={goFull} {...warm}>
              <Icon name="external" size={19} strokeWidth={2} /><span>{t("p.pv.viewFull")}</span><Icon name="arrowRight" size={18} strokeWidth={2.4} />
            </a>
          </div>
        </div>
      </motion.div>
      {viewing && product.image && <ImageViewer src={product.image} alt={name} onClose={() => setViewing(false)} />}
    </motion.div>
  );
}
