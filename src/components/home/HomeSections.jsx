import { useMemo } from "react";
import { useCatalog } from "../../context/CatalogContext";
import { useLang } from "../../context/LanguageContext";
import { summarize } from "../../lib/product";
import useCountUp from "../../hooks/useCountUp";

export function HeroStats() {
  const { t } = useLang();
  const { products } = useCatalog();
  const chains = new Set(products.flatMap((p) => p.prices.map((o) => o.store))).size;
  const spread = useMemo(() => {
    const v = products.filter((p) => p.prices.length > 1).map((p) => summarize(p).spreadPct);
    return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : 0;
  }, [products]);
  const a = useCountUp(products.length), b = useCountUp(chains), c = useCountUp(spread);
  return (
    <ul className="nt-stats">
      <li><b>{a}</b><span>{t("p.stat.products")}</span></li>
      <li><b>{b}</b><span>{t("p.stat.chains")}</span></li>
      <li><b>{c}%</b><span>{t("p.stat.spread")}</span></li>
    </ul>
  );
}

