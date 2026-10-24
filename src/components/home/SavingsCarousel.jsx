import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";

import Icon from "../ui/Icon";
import StoreMark from "../products/StoreMark";
import { useCatalog } from "../../context/CatalogContext";
import { useLang } from "../../context/LanguageContext";
import { formatPrice } from "../../lib/constants";
import { summarize } from "../../lib/product";

const INTERVAL = 3000;
const MAX_SLIDES = 5;

const slideVariants = {
  enter: (direction) => ({ opacity: 0, x: direction * 42 }),
  center: { opacity: 1, x: 0 },
  exit: (direction) => ({ opacity: 0, x: direction * -42 }),
};

/* Compact signed-in desktop price comparison carousel. Its timer ignores motion preferences. */
export default function SavingsCarousel() {
  const { t, tProduct } = useLang();
  const { products, drops } = useCatalog();
  const [[index, direction], setPage] = useState([0, 1]);

  const slides = useMemo(() => products
    .map((p) => ({ p, s: summarize(p, { drops }) }))
    .filter(({ s }) => s.cheapestVerified && s.savingVsWorst > 0)
    .sort((a, b) => Number(Boolean(b.s.drop)) - Number(Boolean(a.s.drop)) || b.s.savingVsWorst - a.s.savingVsWorst)
    .slice(0, MAX_SLIDES), [products, drops]);

  const count = slides.length;
  const at = count ? index % count : 0;
  const moveTo = useCallback((next, dir) => {
    if (!count) return;
    setPage(([current]) => [((next % count) + count) % count, dir ?? (next >= current ? 1 : -1)]);
  }, [count]);
  const step = useCallback((delta) => {
    if (!count) return;
    setPage(([current]) => [((current + delta + count) % count), delta]);
  }, [count]);

  // Keep auto-advance running even when MotionConfig/reduced-motion disables slide transitions.
  useEffect(() => {
    if (count < 2) return undefined;
    const timer = window.setInterval(() => {
      setPage(([current]) => [(current + 1) % count, 1]);
    }, INTERVAL);
    return () => window.clearInterval(timer);
  }, [count]);

  const current = slides[at];
  const rows = useMemo(() => {
    if (!current) return [];
    return current.s.offers
      .filter((offer) => offer.inStock !== false)
      .sort((a, b) => a.price - b.price)
      .slice(0, 3)
      .map((offer) => ({ ...offer, best: offer.price === current.s.best.price }));
  }, [current]);

  if (!current) return null;

  return (
    <section className="hb-stage" aria-roledescription="carousel" aria-label={t("deals.title")}>
        <div className="hb-viewport" aria-live="off">
          <span className="hb-sticker" aria-hidden="true"><i>%</i><em>{t("hr.sticker")}</em></span>
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.article
              key={current.p.slug}
              className="hb-card"
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              drag={count > 1 ? "x" : false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.3}
              onDragEnd={(_, info) => { if (info.offset.x < -55) step(1); else if (info.offset.x > 55) step(-1); }}
              aria-roledescription="slide"
              aria-label={`${at + 1} / ${count}`}
            >
              <Link to={`/product/${current.p.slug}`} className="hb-prod">
                <span className="hb-img">{current.p.image && <img src={current.p.image} alt="" width="80" height="80" loading="lazy" />}</span>
                <span className="hb-name"><b>{tProduct(current.p, "name")}</b><small>{t("hr.stores", { n: current.s.liveCount })}</small></span>
                <Icon name="arrowRight" size={19} className="hb-go" />
              </Link>

              <ul className="hb-rows">
                {rows.map((offer, i) => (
                  <li key={`${offer.store}-${offer.storeId ?? i}`} className={offer.best ? "is-best" : ""}>
                    <StoreMark chain={offer.store} size={30} />
                    <b className="hb-store">{offer.store}</b>
                    <span className="hb-bar" aria-hidden="true"><i style={{ width: `${Math.max(10, Math.round((offer.price / rows[rows.length - 1].price) * 100))}%` }} /></span>
                    <strong className="hb-price">{formatPrice(offer.price)}</strong>
                  </li>
                ))}
              </ul>

              <p className="hb-save"><Icon name="trendDown" size={19} strokeWidth={2.4} /><span><b>{t("hr.save", { n: formatPrice(current.s.savingVsWorst) })}</b><small>{t("hr.where", { store: current.s.best.store })}</small></span></p>
            </motion.article>
          </AnimatePresence>
        </div>

        {count > 1 && <div className="hb-ctl">
          <button type="button" onClick={() => step(-1)} aria-label={t("hr.prev")}><Icon name="arrowLeft" size={17} /></button>
          <ol className="hb-dots">
            {slides.map(({ p }, i) => <li key={p.slug}>
              <button type="button" className={i === at ? "is-on" : ""} onClick={() => moveTo(i)} aria-label={t("hr.go", { n: i + 1 })} aria-current={i === at ? "true" : undefined}>
                {i === at && <i key={index} style={{ animationDuration: `${INTERVAL}ms` }} />}
              </button>
            </li>)}
          </ol>
          <button type="button" onClick={() => step(1)} aria-label={t("hr.next")}><Icon name="arrowRight" size={17} /></button>
        </div>}
    </section>
  );
}
