import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

import Icon from "../ui/Icon";
import Words from "../ui/Words";
import SmartSearch from "./SmartSearch";
import SavingsCarousel from "./SavingsCarousel";
import Foliage from "../ui/Foliage";
import { useAuth } from "../../context/AuthContext";
import { useCatalog } from "../../context/CatalogContext";
import { useTheme } from "../../context/ThemeContext";
import { useLang } from "../../context/LanguageContext";
import useCountUp from "../../hooks/useCountUp";
import { summarize } from "../../lib/product";

/* Hero photo: src/assets/hero/hero.(jpg|jpeg|png|webp) is the supermarket background (slightly transparent, slow pan).
 * Without a file a soft CSS "bokeh" background is shown. */
const heroFiles = import.meta.glob("../../assets/hero/hero.{jpg,jpeg,png,webp}", { eager: true, query: "?url", import: "default" });
const HERO_PHOTO = Object.values(heroFiles)[0];
/* Light theme uses the bright studio photo (hero-light.jpg); dark theme keeps the black supermarket photo (hero.png). */
const lightFiles = import.meta.glob("../../assets/hero/hero-light.{jpg,jpeg,png,webp}", { eager: true, query: "?url", import: "default" });
const HERO_LIGHT = Object.values(lightFiles)[0];
/* Cut-outs of the basket (same pixels as the photos, transparent elsewhere). They sit IN FRONT of the savings card so the card
 * looks tucked behind the basket. */
const fgDark = Object.values(import.meta.glob("../../assets/hero/hero-fg.webp", { eager: true, query: "?url", import: "default" }))[0];
const fgLight = Object.values(import.meta.glob("../../assets/hero/hero-light-fg.webp", { eager: true, query: "?url", import: "default" }))[0];

function Stat({ value, suffix = "", label, icon }) {
  const n = useCountUp(value);
  return <li><i className="hb-stat-ico" aria-hidden="true"><Icon name={icon} size={22} /></i><div><b>{n}{suffix}</b><span>{label}</span></div></li>;
}

/* Main welcome banner. Signed-in desktop users get a compact savings carousel beside the copy. */
export default function HeroBanner() {
  const { t } = useLang();
  const { isAuthenticated } = useAuth();
  const { isDark } = useTheme();
  const { products, status, drops } = useCatalog();
  const [isPhone, setIsPhone] = useState(() => typeof window !== "undefined" && window.matchMedia?.("(max-width: 767px)").matches);
  const chains = new Set(products.flatMap((p) => p.prices.map((o) => o.store))).size;
  const spread = useMemo(() => {
    const values = products.filter((p) => p.prices.length > 1).map((p) => summarize(p, { drops }).spreadPct);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0;
  }, [products, drops]);

  useEffect(() => {
    const media = window.matchMedia?.("(max-width: 767px)");
    if (!media) return undefined;
    const update = () => setIsPhone(media.matches);
    media.addEventListener?.("change", update);
    return () => media.removeEventListener?.("change", update);
  }, []);

  return (
    <section className={`hb ${isAuthenticated ? "" : "is-guest"} ${HERO_PHOTO ? "has-photo" : ""}`} aria-label={t("p.hero.eyebrow")}>
      {HERO_PHOTO && <span className="hb-photo" aria-hidden="true"><span className="hb-photo-box"><img src={!isDark && HERO_LIGHT ? HERO_LIGHT : HERO_PHOTO} alt="" decoding="async" fetchPriority="high" draggable="false" /></span></span>}
      <span className="hb-glow" aria-hidden="true" />
      <Foliage className="nt-leaf-hero" />
      <div className="hb-copy">
        <motion.span className="hb-eyebrow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5 }}>
          <Icon name="zap" size={14} />{t("p.hero.eyebrow")}<i className="hb-eyebrow-dot" aria-hidden="true" />
        </motion.span>
        <h1>
          <Words text={t("hero.title1")} delay={0.3} />
          <Words text={t("hero.title2")} delay={0.55} className="hb-grad" />
        </h1>
        <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8, duration: 0.5 }}>{t("p.hero.sub")}</motion.p>

        {isAuthenticated && (
          <motion.div className="hb-action" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.95, duration: 0.5 }}>
            <SmartSearch compact />
          </motion.div>
        )}
        <Link to="/products" className="hb-seeall"><span>{t("home.seeAllProducts")}</span><Icon name="arrowRight" size={16} /></Link>

        {status === "ready" && products.length > 0 && (
          <motion.ul className="hb-stats" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.5 }}>
            <Stat icon="tag" value={products.length} label={t("p.stat.products")} />
            <Stat icon="store" value={chains} label={t("p.stat.chains")} />
            <Stat icon="chart" value={spread} suffix="%" label={t("p.stat.spread")} />
          </motion.ul>
        )}
      </div>
      {isAuthenticated && !isPhone && <SavingsCarousel />}
      {HERO_PHOTO && isAuthenticated && !isPhone && (isDark ? fgDark : fgLight) && (
        <span className="hb-fg" aria-hidden="true"><span className="hb-photo-box"><img src={isDark ? fgDark : fgLight} alt="" decoding="async" draggable="false" /></span></span>
      )}
    </section>
  );
}
