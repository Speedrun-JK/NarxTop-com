import { useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import Icon from "../ui/Icon";
import CategoryIcon from "../ui/CategoryIcon";
import StoreMark from "./StoreMark";
import { categoryIconFor, categoryTone } from "../home/CategoryNav";
import { useLang } from "../../context/LanguageContext";
import { formatPrice } from "../../lib/constants";
import { toast } from "../../lib/toast";

/* Phone-only product page (<= 640px): full-width photo, floating round buttons, a rounded bottom sheet with
 * the lowest price, a "prices at a glance" list and one big green add-to-cart bar. Desktop keeps the classic page.
 * Everything is driven by props from ProductDetail so there is a single source of truth for cart / favourite state. */
export default function MobileProductView({
  product, s, name, hasImage, onImageError, fav, onToggleFav, onZoom, inCart, onAdd, onQty, children,
}) {
  const { t, tUnit, tCategory } = useLang();
  const navigate = useNavigate();
  const glance = useRef(null);

  const back = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/products");
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) { await navigator.share({ title: name, url }); return; }
      await navigator.clipboard.writeText(url);
      toast(t("mpv.copied"));
    } catch { /* the share sheet was dismissed */ }
  };

  const live = s.offers.filter((o) => o.inStock !== false);
  const maxPrice = Math.max(1, ...live.map((o) => o.price));
  const cheaperPct = s.cheapestVerified ? s.spreadPct : 0;
  const bestOffer = s.available ? s.best : null;
  const category = product.category;

  return (
    <div className="mpv" style={categoryTone(category)}>
      <div className="mpv-hero">
        {hasImage
          ? <img src={product.image} alt={name} decoding="async" fetchPriority="high" onError={onImageError} />
          : <span className="mpv-noimg" role="img" aria-label={name}><Icon name="package" size={64} strokeWidth={1.4} /></span>}

        <div className="mpv-top">
          <button type="button" className="mpv-round" onClick={back} aria-label={t("mpv.back")}><Icon name="arrowLeft" size={20} strokeWidth={2.2} /></button>
          <div className="mpv-top-right">
            <button type="button" className={`mpv-round ${fav ? "is-on" : ""}`} onClick={onToggleFav} aria-pressed={fav} aria-label={fav ? t("p.fav.remove") : t("p.fav.add")}><Icon name="heart" size={20} strokeWidth={2} /></button>
            <button type="button" className="mpv-round" onClick={share} aria-label={t("mpv.share")}><Icon name="external" size={19} strokeWidth={2} /></button>
            {hasImage && <button type="button" className="mpv-round" onClick={onZoom} aria-label={t("mpv.zoom")}><Icon name="eye" size={20} strokeWidth={2} /></button>}
          </div>
        </div>

        {cheaperPct > 0 && <span className="mpv-flag"><Icon name="tag" size={15} strokeWidth={2.3} />{t("mpv.cheaper", { n: cheaperPct })}</span>}
      </div>

      <section className="mpv-sheet" aria-labelledby="mpv-title">
        <span className="mpv-grab" aria-hidden="true" />

        <span className="mpv-cat"><CategoryIcon name={categoryIconFor(category)} size={20} />{tCategory(category)}</span>
        <h1 id="mpv-title" className="mpv-title">{name}</h1>

        <div className="mpv-meta">
          <span><Icon name="store" size={17} />{t("mpv.stores", { n: s.total })}</span>
          <i aria-hidden="true" />
          <span><Icon name="ruler" size={17} />{tUnit(product.unit)}</span>
        </div>

        <button type="button" className="mpv-lowest" onClick={() => glance.current?.scrollIntoView({ behavior: "smooth", block: "center" })}>
          <span className="mpv-lowest-main">
            <small>{s.available ? t("mpv.lowest") : t("p.lastKnown")}</small>
            <strong>{formatPrice(s.best.price)}</strong>
            {s.best.oldPrice > s.best.price && <del>{formatPrice(s.best.oldPrice)}</del>}
          </span>
          {bestOffer && <span className="mpv-best"><Icon name="tag" size={15} strokeWidth={2.3} />{t("mpv.bestPrice")}</span>}
          <Icon name="chevronDown" size={20} className="mpv-chev" />
        </button>

        <div className="mpv-glance" ref={glance}>
          <header>
            <span><Icon name="trendDown" size={18} strokeWidth={2.2} />{t("mpv.glance")}</span>
            <b>{live.length}/{s.total}</b>
          </header>
          <ul>
            {s.offers.map((o, i) => {
              const out = o.inStock === false;
              const best = !out && s.available && o.price === s.best.price;
              return (
                <li key={`${o.store}-${o.storeId ?? i}`} className={`${best ? "is-best" : ""} ${out ? "is-out" : ""}`}>
                  <StoreMark chain={o.store} size={40} />
                  <span className="mpv-row">
                    <b>{o.store}</b>
                    <i className="mpv-bar-track" aria-hidden="true"><em style={{ width: `${out ? 14 : Math.max(18, Math.round((o.price / maxPrice) * 100))}%` }} /></i>
                  </span>
                  <strong>{out ? t("p.outOfStock") : formatPrice(o.price)}</strong>
                  <Icon name="chevronDown" size={17} className="mpv-chev" />
                </li>
              );
            })}
          </ul>
        </div>

        {children}
      </section>

      <div className="mpv-cta">
        <AnimatePresence mode="wait" initial={false}>
          {inCart > 0 ? (
            <motion.div key="step" className="mpv-incart" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.16 }}>
              <div className="mpv-qty" role="group" aria-label={t("nav.cart")}>
                <button type="button" onClick={() => onQty(inCart - 1)} aria-label={t("p.cart.dec")}><Icon name={inCart === 1 ? "trash" : "minus"} size={18} strokeWidth={2.4} /></button>
                <output aria-live="polite">{inCart}</output>
                <button type="button" onClick={() => onQty(Math.min(99, inCart + 1))} aria-label={t("p.cart.inc")}><Icon name="plus" size={18} strokeWidth={2.4} /></button>
              </div>
              <Link to="/cart" className="mpv-add">{t("p.goCart")}<Icon name="arrowRight" size={18} strokeWidth={2.4} /></Link>
            </motion.div>
          ) : (
            <motion.button key="add" type="button" className="mpv-add" disabled={!s.available} onClick={onAdd} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.16 }} whileTap={{ scale: 0.97 }}>
              <Icon name="cart" size={22} strokeWidth={2.1} />{s.available ? t("p.add") : t("p.unavailable")}
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
