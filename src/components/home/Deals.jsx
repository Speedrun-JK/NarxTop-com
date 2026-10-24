import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import Icon from "../ui/Icon";
import { HScroll } from "../ui/ScrollBar";
import ProductCard from "../products/ProductCard";
import { useCatalog } from "../../context/CatalogContext";
import { useLang } from "../../context/LanguageContext";
import { summarize } from "../../lib/product";
import { DEFAULT_MAX_ECONOMY, selectMaxEconomyProducts } from "../../../shared/core/maxEconomy.js";
import { loadMaxEconomy } from "../../services/catalog";

const KEY = "narxtop_deals_open";
/* "Biggest savings": products where choosing the right store matters most, ranked by how many so‘m you save against
 * the priciest in-stock store. Only genuine comparisons count (2+ in-stock offers that differ), and products whose
 * price just dropped (from the server's price history) are surfaced first. Collapsible; the choice is remembered. */
export default function Deals() {
  const { t } = useLang();
  const { products, drops } = useCatalog();
  const [open, setOpen] = useState(() => { try { return localStorage.getItem(KEY) !== "0"; } catch { return true; } });
  const [settings, setSettings] = useState(DEFAULT_MAX_ECONOMY);
  const toggle = () => setOpen((o) => { try { localStorage.setItem(KEY, o ? "0" : "1"); } catch { /* ignore */ } return !o; });

  useEffect(() => {
    let controller;
    const refresh = () => {
      controller?.abort();
      controller = new AbortController();
      loadMaxEconomy(controller.signal).then(setSettings).catch((error) => {
        if (error.name !== "AbortError") setSettings(DEFAULT_MAX_ECONOMY);
      });
    };
    refresh();
    window.addEventListener("online", refresh);
    return () => { controller?.abort(); window.removeEventListener("online", refresh); };
  }, []);

  const ranked = useMemo(() => products
    .map((p) => ({ p, s: summarize(p, { drops }) }))
    .filter(({ s }) => s.cheapestVerified && s.savingVsWorst > 0)
    .sort((a, b) => Number(Boolean(b.s.drop)) - Number(Boolean(a.s.drop)) || b.s.savingVsWorst - a.s.savingVsWorst)
    .map(({ p }) => p), [products, drops]);
  const deals = useMemo(() => selectMaxEconomyProducts(products, ranked, settings), [products, ranked, settings]);

  if (!settings.enabled || !deals.length) return null;
  return (
    <section className="dl nt-glass" aria-labelledby="deals-title">
      <button type="button" className="dl-head" onClick={toggle} aria-expanded={open} aria-controls="deals-body">
        <span className="dl-ico"><Icon name="flame" size={20} /></span>
        <span className="dl-text"><h2 id="deals-title">{t("deals.title")}</h2><small>{t("deals.sub")}</small></span>
        <span className="dl-count">{deals.length}</span>
        <Icon name="chevronDown" size={20} className={`dl-chev ${open ? "is-open" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div id="deals-body" className="dl-body" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
            <HScroll className="tc-grid tc-row">{deals.map((p, i) => <ProductCard key={p.slug} product={p} index={i} />)}</HScroll>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
