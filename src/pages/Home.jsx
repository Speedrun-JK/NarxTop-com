import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import PageShell from "../components/layout/PageShell";
import GuestShowcase from "../components/home/GuestShowcase";
import ProductBrowser from "../components/products/ProductBrowser";
import Section from "../components/ui/Section";
import Icon from "../components/ui/Icon";
import HeroBanner from "../components/home/HeroBanner";
import DailyPicks from "../components/home/DailyPicks";
import SortSelect from "../components/products/SortSelect";

import { useAuth } from "../context/AuthContext";
import { useCatalog } from "../context/CatalogContext";
import { useLang } from "../context/LanguageContext";
import { GUEST_BROWSING } from "../lib/constants";
import { DEFAULT_SORT, sortProducts } from "../lib/sortProducts";
import useMediaQuery, { PHONE_QUERY } from "../hooks/useMediaQuery";

/* the home page previews one tidy row of 4 products on desktop (and 4 on phones); everything else lives on /products */
const HOME_COUNT = 4;
const HOME_COUNT_PHONE = 4;

export default function Home() {
  const { t, tProduct, lang } = useLang();
  const { isAuthenticated } = useAuth();
  const { products, status, error, reload, drops } = useCatalog();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [sort, setSort] = useState(DEFAULT_SORT);
  const count = isPhone ? HOME_COUNT_PHONE : HOME_COUNT;
  const preview = useMemo(
    () => sortProducts(products, sort, { drops, getName: (p) => tProduct(p, "name"), locale: lang }).slice(0, count),
    [products, sort, drops, count, tProduct, lang],
  );
  const showCatalog = GUEST_BROWSING || isAuthenticated;

  return (
    <PageShell className="nt-home">
      <HeroBanner />

      {!showCatalog && <GuestShowcase />}

      {showCatalog && <DailyPicks />}

      {showCatalog && (
        <>
          <Section title={t("p.home.all")} id="catalog" action={status === "ready" ? <SortSelect value={sort} onChange={setSort} /> : null}>
            <ProductBrowser hideDrop keepOrder showSort={false} items={preview} loading={status === "loading"} error={status === "error" ? error : null} onRetry={reload} />
            {status === "ready" && products.length > 0 && (
              <Link to="/products" className="nt-seeall">
                <span><b>{t("prod.seeAll")}</b><small>{t("prod.page.count", { n: products.length })}</small></span>
                <i aria-hidden="true"><Icon name="arrowRight" size={18} /></i>
              </Link>
            )}
          </Section>
        </>
      )}
    </PageShell>
  );
}
