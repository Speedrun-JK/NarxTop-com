import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import Icon from "../ui/Icon";
import StoreMark from "../products/StoreMark";
import { useCatalog } from "../../context/CatalogContext";
import { useLang } from "../../context/LanguageContext";
import { formatPrice } from "../../lib/constants";
import { summarize } from "../../lib/product";
import { logoKey } from "../../lib/storeLogos";
import { chunk, dayKey, msUntilNextDay, pickDaily } from "../../../shared/core/dailyPicks.js";
import Foliage from "../ui/Foliage";
import useMediaQuery, { PHONE_QUERY } from "../../hooks/useMediaQuery";

const INTERVAL = 3000; // auto-advance to the next set of three products every 3 seconds

/* "Supermarketlar narxlari": 3 slides x 3 products. The 9 products are random but cheap, and change every day
 * (Tashkent midnight). Every card wears the colour of the store that sells the product cheapest. */
export default function DailyPicks() {
  const { t, tProduct } = useLang();
  const { products, drops, status } = useCatalog();
  const [day, setDay] = useState(() => dayKey());
  const [page, setPage] = useState(0);
  const [hover, setHover] = useState(false);
  const [hidden, setHidden] = useState(() => typeof document !== "undefined" && document.hidden);
  const track = useRef(null);
  /* desktop: 3 products per slide; phones: 2 side by side (never a tall stack of three) */
  const isPhone = useMediaQuery(PHONE_QUERY);
  const perSlide = isPhone ? 2 : 3;

  /* roll over to the next set when the day changes while the page is open */
  useEffect(() => {
    const timer = window.setTimeout(() => setDay(dayKey()), msUntilNextDay());
    return () => window.clearTimeout(timer);
  }, [day]);

  const slides = useMemo(() => {
    const meta = new Map();
    for (const p of products) {
      const s = summarize(p, { drops });
      if (s.available && s.best.price > 0) meta.set(p.slug, { p, s });
    }
    const slugs = pickDaily([...meta.values()].map(({ p, s }) => ({ slug: p.slug, price: s.best.price })), day);
    const picked = slugs.map((slug) => meta.get(slug));
    // keep every slide full: 9 picks -> 3 x 3 on desktop, 8 picks -> 4 x 2 on phones
    return chunk(picked.slice(0, Math.floor(picked.length / perSlide) * perSlide || picked.length), perSlide);
  }, [products, drops, day, perSlide]);

  /* the slide layout changed (phone <-> desktop): start again from the first slide */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(0);
    track.current?.scrollTo({ left: 0, behavior: "auto" });
  }, [perSlide]);

  const count = slides.length;
  /* Advance into a duplicate first slide at the end of the track, then reset seamlessly to the real first slide. */
  const go = useCallback((next) => {
    const el = track.current;
    if (!el || !count) return;
    const target = ((next % count) + count) % count;
    const loopsForward = next > 0 && target === 0 && next > page;
    const destination = loopsForward ? count : target;
    const instant = document.documentElement.dataset.motion === "off";
    el.scrollTo({ left: destination * el.clientWidth, behavior: instant ? "auto" : "smooth" });
    if (!loopsForward) setPage(target);
  }, [count, page]);

  /* pause while the pointer / focus is on the carousel or the tab is in the background */
  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", on);
    return () => document.removeEventListener("visibilitychange", on);
  }, []);

  /* every 3 s: next three products. Re-armed whenever the page changes, so clicking an arrow / dot restarts the 3 s. */
  useEffect(() => {
    if (count < 2 || hover || hidden) return undefined;
    const timer = window.setTimeout(() => go(page + 1, true), INTERVAL);
    return () => window.clearTimeout(timer);
  }, [count, page, hover, hidden, go]);

  const onScroll = () => {
    const el = track.current;
    if (!el?.clientWidth) return;
    if (el.scrollLeft >= count * el.clientWidth - 1) {
      el.scrollLeft = 0;
      setPage(0);
      return;
    }
    setPage(Math.min(count - 1, Math.round(el.scrollLeft / el.clientWidth)));
  };

  if (status !== "ready" || !count) return null;

  return (
    <section className="dp" aria-roledescription="carousel" aria-label={t("dp.title")} onPointerEnter={(e) => { if (e.pointerType === "mouse") setHover(true); }} onPointerLeave={() => setHover(false)} onFocus={(e) => { if (e.target.matches?.(":focus-visible")) setHover(true); }} onBlur={() => setHover(false)}>
      <Foliage className="nt-leaf-dp-tr" />
      <Foliage className="nt-leaf-dp-bl" />
      <header className="dp-head">
        <span className="dp-head-ico" aria-hidden="true"><Icon name="store" size={22} /></span>
        <div><h2>{t("dp.title")}</h2><p>{t("dp.sub")}</p></div>
        <Link to="/products" className="dp-all" aria-label={t("dp.all")}><span>{t("dp.all")}</span><Icon name="arrowRight" size={15} /></Link>
      </header>

      <div className="dp-stage">
        {count > 1 && <button type="button" className="dp-nav is-prev" onClick={() => go(page - 1)} aria-label={t("hr.prev")}><Icon name="arrowLeft" size={18} /></button>}
        <div className="dp-track" ref={track} onScroll={onScroll}>
          {[...slides, ...(count > 1 ? [slides[0]] : [])].map((group, si) => (
            <ul className={`dp-slide is-per-${perSlide} ${si === page ? "is-active" : ""}`} key={si === count ? "loop-first" : si} aria-roledescription="slide" aria-label={`${si === count ? 1 : si + 1} / ${count}`} aria-hidden={si === count || undefined} inert={si === count || undefined}>
              {group.map(({ p, s }, ci) => {
                const store = logoKey(s.best.store);
                const old = Number(s.best.oldPrice);
                const hasOld = old > s.best.price;
                return (
                  <li key={p.slug}>
                    <article className="dp-card" data-store={store} style={{ "--n": ci }}>
                      <div className="dp-card-top">
                        <StoreMark chain={s.best.store} size={34} />
                        <b className="dp-store">{s.best.store}</b>
                        <span className="dp-badge">{t("dp.cheapest")}</span>
                      </div>
                      <div className="dp-card-body">
                        <Link to={`/product/${p.slug}`} className="dp-photo" aria-label={tProduct(p, "name")}>
                          {p.image && <img src={p.image} alt="" width="96" height="96" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />}
                        </Link>
                        <div className="dp-info">
                          <Link to={`/product/${p.slug}`} className="dp-name">{tProduct(p, "name")}</Link>
                          <small>{p.unit}</small>
                          <strong className="dp-price">{formatPrice(s.best.price)}</strong>
                          {hasOld && <del>{formatPrice(old)}</del>}
                          <Link to={`/product/${p.slug}`} className="dp-go">{t("dp.go")}<Icon name="arrowRight" size={14} strokeWidth={2.4} /></Link>
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          ))}
        </div>
        {count > 1 && <button type="button" className="dp-nav is-next" onClick={() => go(page + 1)} aria-label={t("hr.next")}><Icon name="arrowRight" size={18} /></button>}
      </div>

      {count > 1 && (
        <ol className="dp-dots">
          {slides.map((_, i) => <li key={i}><button type="button" className={i === page ? "is-on" : ""} onClick={() => go(i)} aria-label={t("hr.go", { n: i + 1 })} aria-current={i === page ? "true" : undefined}>{i === page && count > 1 && <i key={`${page}-${hover || hidden ? "p" : "r"}`} className={hover || hidden ? "is-paused" : ""} style={{ animationDuration: `${INTERVAL}ms` }} />}</button></li>)}
        </ol>
      )}
    </section>
  );
}
