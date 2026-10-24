import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import PageShell from "../components/layout/PageShell";
import Gate from "../components/ui/Gate";
import ProductCard, { Freshness } from "../components/products/ProductCard";
import Section from "../components/ui/Section";
import { EmptyState, ErrorState, Skeleton } from "../components/ui/States";

import { useCart } from "../context/CartContext";
import { useCatalog } from "../context/CatalogContext";
import { useLang } from "../context/LanguageContext";
import { useUserData } from "../context/UserDataContext";
import { formatPrice } from "../lib/constants";
import { summarize } from "../lib/product";
import { toast } from "../lib/toast";
import { trackEvent } from "../lib/events";
import { similarProducts, boughtTogether } from "../../shared/core/recommend.js";
import { freshness } from "../../shared/core/priceIntel.js";
import { discountPercent } from "../../shared/core/promotions.js";
import Icon from "../components/ui/Icon";
import { HScroll } from "../components/ui/ScrollBar";
import { EyeButton, useImageViewer } from "../components/ui/ImageViewer";
import MobileProductView from "../components/products/MobileProductView";
import useMediaQuery, { PHONE_QUERY } from "../hooks/useMediaQuery";

function Offers({ s, product, promoText }) {
  const { t } = useLang();
  const maxPrice = Math.max(1, ...s.offers.filter((o) => o.inStock !== false).map((o) => o.price));
  return (
    <table className="nt-table">
      <thead><tr><th>{t("p.store")}</th><th>{t("p.price")}</th><th>{t("p.status")}</th></tr></thead>
      <tbody>
        {s.offers.map((o, i) => (
          <motion.tr key={`${o.store}-${o.storeId ?? i}`} className={s.cheapestVerified && o.inStock !== false && o.price === s.best.price ? "is-best" : o.inStock === false ? "is-out" : ""} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, delay: Math.min(i, 6) * 0.03 }}>
            <td><b>{o.store}</b>{s.cheapestVerified && o.inStock !== false && o.price === s.best.price && <span className="nt-badge b-cheap"><Icon name="check" size={12} strokeWidth={2.6} />{t("p.badge.cheapest")}</span>}</td>
            <td>
              <strong>{formatPrice(o.price)}</strong>
              {o.inStock !== false && <i className="nt-pbar" aria-hidden="true"><b style={{ width: `${Math.max(12, (o.price / maxPrice) * 100)}%` }} /></i>}
              {discountPercent(o) > 0 && <><del className="nt-old">{formatPrice(o.oldPrice)}</del><span className="nt-badge b-disc">−{discountPercent(o)}%</span></>}
              {(o.promos ?? []).map((p, k) => <small key={k} className="nt-promo">{promoText(p)}</small>)}
              {s.available && o.inStock !== false && o.price > s.best.price && <small className="nt-diff">+{formatPrice(o.price - s.best.price)} {t("p.moreThanCheapest")}</small>}
            </td>
            <td><span className={`nt-stock ${o.inStock === false ? "is-out" : "is-in"}`}>{o.inStock === false ? t("p.outOfStock") : t("p.inStock")}</span><Freshness fresh={freshness(o.updatedAt)} /></td>
          </motion.tr>
        ))}
      </tbody>
    </table>
  );
}

export default function ProductDetail() {
  const { slug } = useParams();
  const { t, tProduct, tUnit } = useLang();
  const { bySlug, products, status, drops, reload } = useCatalog();
  const { items, addItem, setQty } = useCart();
  const { isFavorite, toggleFavorite, purchases, alerts, setAlertTarget } = useUserData();
  const product = bySlug.get(slug);
  const [targetDraft, setTargetDraft] = useState({ slug: "", value: "" });
  const [failedImage, setFailedImage] = useState("");
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [viewer, openViewer] = useImageViewer(product?.image, product ? tProduct(product, "name") : "");
  const inCart = items.find((i) => i.slug === slug)?.qty ?? 0;
  const target = targetDraft.slug === slug ? targetDraft.value : alerts[slug]?.target ?? "";
  const imgFailed = failedImage === slug;

  useEffect(() => { if (product) trackEvent(slug, "view"); }, [slug, product]);

  const s = useMemo(() => (product ? summarize(product, { drops }) : null), [product, drops]);

  const recs = useMemo(() => {
    if (!product) return null;
    const baskets = Object.values(purchases.reduce((m, p) => ((m[p.ts] ??= []).push(p.slug), m), {}));
    return {
      similar: similarProducts(product, products, 4),
      together: boughtTogether(slug, baskets, { minSupport: 2, limit: 4 }).map((x) => bySlug.get(x.slug)).filter(Boolean),
    };
  }, [product, products, purchases, slug, bySlug]);

  const promoText = (p) => ({ multibuy: () => t("p.promo.multibuy", { q: p.minQty, p: formatPrice(p.unitPrice) }), percent: () => t("p.promo.percent", { q: p.minQty, p: p.percent }), bundle: () => t("p.promo.bundle", { q: p.qty, p: formatPrice(p.price) }), amount: () => t("p.promo.amount", { q: p.minQty, p: formatPrice(p.off) }) }[p.type]?.() ?? "");

  let body;
  if (status === "loading") body = <div className="nt-detail"><Skeleton h={360} r={24} /><div><Skeleton h={28} w="60%" /><Skeleton h={90} /></div></div>;
  else if (status === "error") body = <ErrorState onRetry={reload} />;
  else if (!product) body = <EmptyState icon="search" title={t("p.notFound")} action={<Link to="/" className="nt-btn nt-btn-primary">{t("nav.home")}</Link>} />;
  else {
    const name = tProduct(product, "name");
    const fav = isFavorite(slug);
    const live = product.prices.filter((o) => o.inStock !== false);
    const avg = live.length ? Math.round(live.reduce((a, o) => a + o.price, 0) / live.length) : null;
    const facts = [
      ["tag", t("p.facts.category"), t(`cat.${product.category}`)],
      ["ruler", t("p.facts.unit"), tUnit(product.unit)],
      ["store", t("p.facts.stores"), t("p.inStockAt", { n: s.liveCount, m: s.total })],
      s.available && ["trendDown", t("p.facts.cheapestAt"), s.best.store],
      s.available && s.total > 1 && ["trendUp", t("p.facts.priciest"), formatPrice(s.worst.price)],
      s.available && avg && s.total > 1 && ["chart", t("p.facts.avg"), formatPrice(avg)],
      s.available && s.spreadPct > 0 && ["sparkles", t("p.facts.spread"), `${s.spreadPct}%`],
    ].filter(Boolean);
    const recSections = recs && [["together", t("rec.together")], ["similar", t("rec.similar")]].map(([k, title]) => {
      const list = recs[k].map((x) => x.product ?? x);
      return list.length ? <Section key={k} title={title}><HScroll className="tc-grid tc-row">{list.map((p, i) => <ProductCard key={p.slug} product={p} index={i} />)}</HScroll></Section> : null;
    });
    if (isPhone) {
      body = (
        <>
          <MobileProductView
            product={product}
            s={s}
            name={name}
            hasImage={Boolean(product.image) && !imgFailed}
            onImageError={() => setFailedImage(slug)}
            fav={fav}
            onToggleFav={() => { toggleFavorite(product); if (!fav) trackEvent(slug, "favorite"); }}
            onZoom={openViewer}
            inCart={inCart}
            onAdd={() => { if (!addItem(slug, 1)) return; trackEvent(slug, "cart"); toast(t("p.added", { name })); }}
            onQty={(n) => setQty(slug, n)}
          >
            {tProduct(product, "description") && <p className="mpv-desc">{tProduct(product, "description")}</p>}
            <dl className="mpv-facts">{facts.map(([icon, label, value]) => <div key={label}><dt><Icon name={icon} size={15} />{label}</dt><dd>{value}</dd></div>)}</dl>
            {recSections}
          </MobileProductView>
          {viewer}
        </>
      );
    } else body = (
      <>
        <nav className="nt-crumbs" aria-label="breadcrumb"><Link to="/">{t("nav.home")}</Link><i>/</i><Link to={`/products?q=${encodeURIComponent(product.category)}`}>{t(`cat.${product.category}`)}</Link><i>/</i><span aria-current="page">{name}</span></nav>
        <div className="nt-detail">
          <div className="nt-detail-img">
            {product.image && !imgFailed
              ? <img src={product.image} alt={name} onError={() => setFailedImage(slug)} />
              : <span className="nt-detail-noimg" role="img" aria-label={name}><Icon name="package" size={56} strokeWidth={1.5} /></span>}
            {product.image && !imgFailed && <EyeButton className="nt-detail-eye" onClick={openViewer} />}
            {viewer}
            {s.available && s.total > 1 && <span className="nt-detail-flag"><Icon name="check" size={13} strokeWidth={2.6} />{s.best.store}</span>}
          </div>
          <div className="nt-detail-info">
            <span className="nt-detail-cat"><Icon name="tag" size={13} />{t(`cat.${product.category}`)}</span>
            <h1>{name}</h1>
            <div className="nt-meta"><span>{tUnit(product.unit)}</span><Freshness fresh={s.fresh} /></div>
            <p className="nt-desc">{tProduct(product, "description")}</p>
            <div className="nt-best big">
              <div>
                <span className="nt-best-label">{s.available ? t("p.from") : t("p.lastKnown")}</span>
                <strong className="nt-best-price">{formatPrice(s.best.price)}</strong>
                {s.best.oldPrice > s.best.price && <del className="nt-old">{formatPrice(s.best.oldPrice)}</del>}
              </div>
              <span className="nt-best-store">{s.best.store}</span>
            </div>
            {s.available && s.total > 1 && s.savingVsWorst > 0 && <p className="nt-save"><Icon name="trendDown" size={16} />{t("p.saveVs", { a: formatPrice(s.savingVsWorst) })}</p>}

            <div className="nt-actions">
              <AnimatePresence mode="wait" initial={false}>
                {inCart > 0 ? (
                  <motion.div key="stepper" className="nt-incart" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
                    <div className="nt-qty" role="group" aria-label={t("nav.cart")}>
                      <button type="button" onClick={() => setQty(slug, inCart - 1)} aria-label={t("p.cart.dec")}><Icon name={inCart === 1 ? "trash" : "minus"} size={16} /></button>
                      <output aria-live="polite">{inCart}</output>
                      <button type="button" onClick={() => setQty(slug, Math.min(99, inCart + 1))} aria-label={t("p.cart.inc")}><Icon name="plus" size={16} /></button>
                    </div>
                    <Link to="/cart" className="nt-btn nt-btn-primary">{t("p.goCart")}<Icon name="arrowRight" size={16} /></Link>
                  </motion.div>
                ) : (
                  <motion.button key="add" type="button" className="nt-btn nt-btn-primary nt-add-main" disabled={!s.available} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }} whileTap={{ scale: 0.96 }}
                    onClick={() => { if (!addItem(slug, 1)) return; trackEvent(slug, "cart"); toast(t("p.added", { name })); }}>
                    <Icon name="cart" size={17} />{s.available ? t("p.add") : t("p.unavailable")}
                  </motion.button>
                )}
              </AnimatePresence>
              <button type="button" className={`nt-btn nt-btn-ghost ${fav ? "is-on" : ""}`} onClick={() => { toggleFavorite(product); if (!fav) trackEvent(slug, "favorite"); }} aria-pressed={fav}><Icon name="heart" size={17} /> {fav ? t("p.fav.remove") : t("p.fav.add")}</button>
            </div>
            {inCart > 0 && s.available && <p className="nt-linetotal">{t("p.lineTotal", { n: inCart, a: formatPrice(s.best.price * inCart) })}</p>}
            <label className="nt-alertbox">
              <span><Icon name="bell" size={15} />{t("p.alert.target")}</span>
              <input type="number" min="0" inputMode="numeric" value={target} placeholder={String(s.best.price)} onChange={(e) => setTargetDraft({ slug, value: e.target.value })} onBlur={() => setAlertTarget(slug, Number(target) || null)} />
            </label>
          </div>
        </div>

        <Section title={t("p.compare")}><Offers s={s} product={product} promoText={promoText} /></Section>

        <Section title={t("p.facts.title")}>
          <dl className="nt-facts">
            {facts.map(([icon, label, value]) => (
              <div key={label}><dt><Icon name={icon} size={15} />{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        </Section>

        {recs && [["together", t("rec.together")], ["similar", t("rec.similar")]].map(([k, title]) => {
          const list = recs[k].map((x) => x.product ?? x);
          return list.length ? <Section key={k} title={title}><HScroll className="tc-grid tc-row">{list.map((p, i) => <ProductCard key={p.slug} product={p} index={i} />)}</HScroll></Section> : null;
        })}
      </>
    );
  }
  return <PageShell><Gate>{body}</Gate></PageShell>;
}
