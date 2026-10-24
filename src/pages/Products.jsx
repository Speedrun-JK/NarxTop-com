import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";

import PageShell from "../components/layout/PageShell";
import Gate from "../components/ui/Gate";
import ProductBrowser from "../components/products/ProductBrowser";
import CategorySidebar, { sidebarCategories } from "../components/products/CategorySidebar";
import SmartSearch from "../components/home/SmartSearch";
import Icon from "../components/ui/Icon";
import { useCatalog } from "../context/CatalogContext";
import { useLang } from "../context/LanguageContext";
import { ALL_CATEGORIES } from "../lib/constants";
import { DEFAULT_SORT, isSortKey } from "../lib/sortProducts";

/* /products — every product, split by category. Sidebar on desktop, pill row on phones. The search box sits at the top.
 * The chosen category and the search live in the URL (?category=…&q=…), so links, refresh and Back all work. */
export default function Products() {
  const { t } = useLang();
  const [params, setParams] = useSearchParams();
  const { products, search, status, error, reload } = useCatalog();
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const asked = params.get("category");
  /* all admin categories, plus any category a product uses that is not in the built-in list */
  const allCategories = useMemo(() => [...new Set([...sidebarCategories, ...products.flatMap((p) => [p.category, ...(p.categories ?? [])]).filter((name) => name && !/^(fish\s+and\s+mea[nt]|go['’‘ʻʼ]?sht\s+va\s+baliq|мясо\s+и\s+рыба)$/i.test(String(name).trim()))])], [products]);
  const category = asked && allCategories.includes(asked) ? asked : ALL_CATEGORIES;

  const q = params.get("q") ?? "";
  const found = useMemo(() => (q.trim() ? search(q) : null), [q, search]);
  const query = found?.query ?? null;
  const pool = useMemo(() => (found ? found.results.map((x) => x.product) : products), [found, products]);

  const counts = useMemo(() => {
    const c = { [ALL_CATEGORIES]: pool.length };
    for (const p of pool) for (const categoryName of new Set([p.category, ...(p.categories ?? [])].filter(Boolean))) if (!/^(fish\s+and\s+mea[nt]|go['’‘ʻʼ]?sht\s+va\s+baliq|мясо\s+и\s+рыба)$/i.test(String(categoryName).trim())) c[categoryName] = (c[categoryName] ?? 0) + 1;
    return c;
  }, [pool]);

  const items = useMemo(() => (category === ALL_CATEGORIES ? pool : pool.filter((p) => p.category === category || p.categories?.includes(category))), [pool, category]);

  const askedSort = params.get("sort");
  const sort = isSortKey(askedSort) ? askedSort : DEFAULT_SORT;
  const setSort = (key) => {
    const next = new URLSearchParams(params);
    if (key === DEFAULT_SORT) next.delete("sort"); else next.set("sort", key);
    setParams(next, { replace: true });
  };

  const setQuery = (text) => {
    const value = text.trim();
    if (value === q.trim()) return;
    const next = new URLSearchParams(params);
    if (value) next.set("q", value); else next.delete("q");
    setParams(next, { replace: !value });
  };

  const select = (name) => {
    const next = new URLSearchParams(params);
    if (name === ALL_CATEGORIES) next.delete("category"); else next.set("category", name);
    setParams(next, { replace: true });
  };

  const title = t("prod.page.all");

  return (
    <PageShell className="pp">
      <header className="pp-head">
        <span className="pp-eyebrow">{t("prod.page.eyebrow")}</span>
        <h1 className="pp-title">{title}</h1>
        {status === "ready" && <p className="pp-sub">{t("prod.page.count", { n: items.length })}</p>}
      </header>
      <Gate>
        <div className="pp-layout">
          <div className="pp-search">
            <SmartSearch initial={q} onSearch={setQuery} shortHint />
            {query && (query.cheapest || query.size || query.category) && (
              <div className="nt-intent">
                {query.cheapest && <span className="nt-chip"><Icon name="tag" size={14} /> {t("p.search.cheapest")}</span>}
                {query.size && <span className="nt-chip"><Icon name="ruler" size={14} /> {query.size.label}</span>}
                {query.category && <span className="nt-chip"><Icon name="tag" size={14} /> {t(`cat.${query.category}`)}</span>}
              </div>
            )}
          </div>
          <CategorySidebar selected={category} onSelect={select} list={allCategories} counts={status === "ready" ? counts : undefined} onShowAll={() => setCategoriesOpen(true)} />
          <motion.div className="pp-content" key={category} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <ProductBrowser sort={sort} onSort={setSort} items={items} loading={status === "loading"} error={status === "error" ? error : null} onRetry={reload} keepOrder={Boolean(q.trim()) && !isSortKey(askedSort)} />
          </motion.div>
        </div>
      </Gate>
      <AnimatePresence>{categoriesOpen && <motion.div className="pp-category-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setCategoriesOpen(false)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.section className="pp-category-dialog" role="dialog" aria-modal="true" aria-label={t("cat.all")} initial={{ opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }}><header><h2>{t("cat.all")}</h2><button type="button" onClick={() => setCategoriesOpen(false)} aria-label={t("nav.close")}><Icon name="x" size={19} /></button></header><div>{allCategories.map((name) => <button type="button" key={name} onClick={() => { select(name); setCategoriesOpen(false); }}><span>{name}</span><Icon name="arrowRight" size={15} /></button>)}</div></motion.section></motion.div>}</AnimatePresence>
    </PageShell>
  );
}
