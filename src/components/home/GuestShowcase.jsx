import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

import Icon from "../ui/Icon";
import Mesh from "../ui/Mesh";
import { HScroll } from "../ui/ScrollBar";
import useSpotlight from "../../hooks/useSpotlight";
import useParallax from "../../hooks/useParallax";
import { useCatalog } from "../../context/CatalogContext";
import { useLang } from "../../context/LanguageContext";

const STEPS = [["search", "s1"], ["chart", "s2"], ["cart", "s3"], ["pin", "s4"]];
const rise = (i) => ({ initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] } });

/*
 * Second banner for visitors. Only true statements: what the app does, real catalogue items
 * (name/photo/number of store offers) with their prices deliberately hidden until sign-up.
 * Without catalogue data it still renders the steps and the call to action.
 */
export default function GuestShowcase() {
  const { t, tProduct } = useLang();
  const { products } = useCatalog();
  const spot = useSpotlight();
  const ref = useParallax();
  const teasers = useMemo(() => [...products].sort((a, b) => b.prices.length - a.prices.length).slice(0, 3), [products]);

  return (
    <section ref={ref} className="gs" aria-labelledby="nt-show-title" onPointerMove={spot}>
      <Mesh />
      <div className="gs-grid">
        <div className="gs-copy">
          <motion.span className="gs-kicker" {...rise(0)}><Icon name="sparkles" size={14} />{t("guest.kicker")}</motion.span>
          <motion.h2 id="nt-show-title" {...rise(1)}>{t("guest.show.title")}</motion.h2>
          <motion.p {...rise(2)}>{t("guest.show.sub")}</motion.p>
          <motion.ul className="gs-feats" {...rise(3)}>{["f1", "f2", "f3"].map((f) => <li key={f}><Icon name="check" size={13} strokeWidth={3} />{t(`guest.${f}`)}</li>)}</motion.ul>
          <motion.div className="gs-btns" {...rise(4)}>
            <Link to="/auth?mode=signup" className="gs-btn gs-btn-main">{t("guest.cta")}<Icon name="arrowRight" size={17} /></Link>
            <Link to="/auth" className="gs-btn gs-btn-ghost">{t("guest.have")}</Link>
          </motion.div>
        </div>

        {teasers.length > 0 && (
          <div className="gs-stage">
            <HScroll className="gs-cards" aria-label={t("guest.teaserNote")}>
              {teasers.map((p, i) => (
                <motion.article key={p.slug} className="gs-card" {...rise(i)}>
                  <div className="gs-card-img">{p.image && <img src={p.image} alt="" width="400" height="250" sizes="(max-width: 640px) 42vw, 200px" loading="lazy" decoding="async" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />}</div>
                  <b>{tProduct(p, "name")}</b>
                  <span className="gs-card-n">{t("guest.teaserN", { n: p.prices.length })}</span>
                  <div className="gs-card-lock"><span aria-hidden="true" /><Icon name="lock" size={13} />{t("guest.locked")}</div>
                </motion.article>
              ))}
            </HScroll>
            <p className="gs-note">{t("guest.teaserNote")}</p>
          </div>
        )}
      </div>

      <ol className="gs-steps">
        {STEPS.map(([icon, k], i) => (
          <motion.li key={k} {...rise(i)}>
            <span className="gs-step-ico"><Icon name={icon} size={18} /><em>{i + 1}</em></span>
            <b>{t(`guest.${k}.t`)}</b>
            <small>{t(`guest.${k}.d`)}</small>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
