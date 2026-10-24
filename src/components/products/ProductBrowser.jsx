import { useMemo } from "react";
import { LayoutGroup, motion } from "framer-motion";

import ProductCard from "./ProductCard";
import { EmptyState, ErrorState, GridSkeleton } from "../ui/States";
import { useCatalog } from "../../context/CatalogContext";
import { useLang } from "../../context/LanguageContext";
import SortSelect from "./SortSelect";
import { DEFAULT_SORT, sortProducts } from "../../lib/sortProducts";

/* Product grid with a slim bar (result count + "Tartiblash" dropdown). Default order: cheapest first.
 * Pass `sort` + `onSort` to control the order from outside (the /products page keeps it in the URL). */
export default function ProductBrowser({ items, loading, error, onRetry, showSort = true, keepOrder = false, hideDrop = false, sort = DEFAULT_SORT, onSort }) {
  const { t, tProduct, lang } = useLang();
  const { drops } = useCatalog();

  const list = useMemo(() => {
    if (keepOrder) return items ?? [];
    return sortProducts(items, sort, { drops, getName: (p) => tProduct(p, "name"), locale: lang });
  }, [items, keepOrder, sort, drops, tProduct, lang]);

  if (error) return <ErrorState onRetry={onRetry} />;
  if (loading) return <GridSkeleton />;

  return (
    <div>
      {showSort && list.length > 0 && (
        <div className="nt-viewbar">
          <span className="nt-count" role="status">{t("p.results", { n: list.length })}</span>
          {onSort && <SortSelect value={sort} onChange={onSort} />}
        </div>
      )}
      {list.length === 0 ? (
        <EmptyState icon="search" title={t("p.empty.title")} text={t("p.empty.text")} />
      ) : (
        <LayoutGroup>
          <motion.div layout className="tc-grid">
            {list.map((p, i) => <ProductCard key={p.slug} product={p} index={i} showDrop={!hideDrop} />)}
          </motion.div>
        </LayoutGroup>
      )}
    </div>
  );
}
