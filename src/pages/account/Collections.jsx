import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Link } from "react-router-dom";

import ProductCard from "../../components/products/ProductCard";
import Icon from "../../components/ui/Icon";
import { EmptyState } from "../../components/ui/States";
import { useAuth } from "../../context/AuthContext";
import { useCatalog } from "../../context/CatalogContext";
import { useLang } from "../../context/LanguageContext";
import { useUserData } from "../../context/UserDataContext";
import { formatPrice } from "../../lib/constants";
import { formatDate } from "../../lib/dates";

export function Favorites() {
  const { t, tProduct, lang } = useLang();
  const { isAuthenticated } = useAuth();
  const { bySlug } = useCatalog();
  const [targetDrafts, setTargetDrafts] = useState({});
  const [activeView, setActiveView] = useState("items");
  const [itemsVisible, setItemsVisible] = useState(() => Boolean(isAuthenticated));
  const {
    favorites, alerts, setAlertTarget, favoriteNotifications = [],
    markFavoriteNotificationsSeen, clearFavoriteNotifications,
  } = useUserData();
  const items = favorites.map((s) => bySlug.get(s)).filter(Boolean);
  const unread = favoriteNotifications.filter((n) => !n.readAt).length;

  return (
    <div className="nt-panel nt-favorites-panel">
      <header className="nt-favorites-head">
        <div><h2>{t("acc.favorites")}</h2><p className="nt-sub">{t("acc.favSub")}</p></div>
        <span className="nt-favorites-mark"><Icon name="heart" size={20} /></span>
      </header>

      <div className="nt-favorites-tabs" role="tablist" aria-label={t("acc.favorites")}>
        <button type="button" role="tab" aria-selected={activeView === "items"} className={activeView === "items" ? "is-active" : ""} onClick={() => setActiveView("items")}>
          <Icon name="heart" size={16} />{t("fav.items.title")}<span>{items.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={activeView === "notifications"} className={activeView === "notifications" ? "is-active" : ""} onClick={() => setActiveView("notifications")}>
          <Icon name="bell" size={16} />{t("fav.notice.title")}<span className={unread ? "has-unread" : ""}>{unread}</span>
        </button>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {activeView === "notifications" ? (
          <motion.section key="notifications" className="nt-fav-view" role="tabpanel" aria-label={t("fav.notice.title")} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .18 }}>
            {favoriteNotifications.length > 0 ? (
              <section className="nt-fav-notices" aria-labelledby="fav-notice-heading">
                <div className="nt-fav-notices-head">
                  <div>
                    <span className="nt-fav-notices-kicker"><Icon name="bell" size={15} />{t("fav.notice.eyebrow")}</span>
                    <h3 id="fav-notice-heading">{t("fav.notice.title")} <em>{unread}</em></h3>
                  </div>
                  <div className="nt-fav-notices-actions">
                    {unread > 0 && <button type="button" className="nt-btn nt-btn-ghost" onClick={markFavoriteNotificationsSeen}><Icon name="checkCircle" size={16} />{t("fav.notice.seen")}</button>}
                    <button type="button" className="nt-btn nt-btn-ghost" onClick={clearFavoriteNotifications}><Icon name="trash" size={15} />{t("fav.notice.clear")}</button>
                  </div>
                </div>
                <ul className="nt-fav-notices-list">
                  {favoriteNotifications.map((n) => {
                    const product = bySlug.get(n.slug);
                    const name = product ? tProduct(product, "name") : n.slug;
                    const href = n.storeUrl || `/product/${n.slug}`;
                    const external = Boolean(n.storeUrl);
                    return (
                      <li className={`nt-fav-notice ${n.readAt ? "is-read" : "is-unread"}`} key={n.id}>
                        <span className="nt-fav-notice-icon"><Icon name="trendDown" size={19} /></span>
                        <div className="nt-fav-notice-copy">
                          <b>{t("fav.notice.drop", { name })}</b>
                          <p><s>{formatPrice(n.from)}</s><Icon name="arrowRight" size={14} /><strong>{formatPrice(n.to)}</strong>{n.store && <span className="nt-fav-notice-store">{t("fav.notice.store", { store: n.store })}</span>}</p>
                          {n.createdAt && <time>{formatDate(n.createdAt, lang)}</time>}
                        </div>
                        <a className="nt-fav-notice-link" href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
                          {t("fav.notice.buy")}<Icon name={external ? "external" : "arrowRight"} size={16} />
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : (
              <EmptyState icon="bell" title={t("fav.notice.empty")} text={t("fav.notice.emptyText")} />
            )}
          </motion.section>
        ) : (
          <motion.section key="items" className="nt-fav-view" role="tabpanel" aria-label={t("fav.items.title")} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: .18 }}>
            <div className="nt-fav-items-head">
              <div><span className="nt-fav-notices-kicker"><Icon name="heart" size={15} />{t("fav.items.eyebrow")}</span><h3>{t("fav.items.title")}</h3></div>
              {items.length > 0 && <button type="button" className="nt-fav-visibility" aria-expanded={itemsVisible} onClick={() => setItemsVisible((visible) => !visible)}>
                <Icon name={itemsVisible ? "eyeOff" : "eye"} size={16} />{t(itemsVisible ? "fav.items.hide" : "fav.items.show")}<Icon className="nt-category-chevron" name="chevronDown" size={15} />
              </button>}
            </div>
            {!items.length ? (
              <EmptyState icon="heart" title={t("acc.favEmpty")} text={t("acc.favEmptyText")} action={<Link to="/" className="nt-btn nt-btn-primary">{t("p.cart.browse")}</Link>} />
            ) : (
              <AnimatePresence initial={false}>
                {itemsVisible && <motion.div className="tc-grid nt-fav-grid" initial={{ opacity: 0, height: 0, y: -8 }} animate={{ opacity: 1, height: "auto", y: 0 }} exit={{ opacity: 0, height: 0, y: -8 }} transition={{ duration: .24, ease: "easeInOut" }}>
                  {items.map((p, i) => (
                    <div key={p.slug} className="nt-fav-wrap">
                      <ProductCard product={p} index={i} />
                      <label className="nt-price-alert" htmlFor={`fav-alert-${p.slug}`}>
                        <span className="nt-price-alert-label"><Icon name="bell" size={16} /><span>{t("p.alert.target")}</span></span>
                        <span className="nt-price-alert-input">
                          <input id={`fav-alert-${p.slug}`} type="number" min="0" inputMode="numeric" value={Object.hasOwn(targetDrafts, p.slug) ? targetDrafts[p.slug] : (alerts[p.slug]?.target ?? "")} placeholder={String(Math.min(...p.prices.map((o) => o.price)))} onChange={(e) => setTargetDrafts((drafts) => ({ ...drafts, [p.slug]: e.target.value }))} onBlur={(e) => setAlertTarget(p.slug, Number(e.target.value) || null)} />
                          <em>UZS</em>
                        </span>
                      </label>
                    </div>
                  ))}
                </motion.div>}
              </AnimatePresence>
            )}
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
