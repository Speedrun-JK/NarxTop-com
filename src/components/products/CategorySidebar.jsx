import { useEffect, useRef } from "react";
import { useLang } from "../../context/LanguageContext";
import { ALL_CATEGORIES } from "../../lib/constants";
import { categoryIcon, categoryNames, categoryTone } from "../home/CategoryNav";

/* every category the admin panel offers (plus any category a product already uses — see Products.jsx) */
export const sidebarCategories = categoryNames.filter((name) => !/^(fish\s+and\s+mea[nt]|go['’‘ʻʼ]?sht\s+va\s+baliq|мясо\s+и\s+рыба)$/i.test(String(name).trim()));
import Icon from "../ui/Icon";
import ScrollBar from "../ui/ScrollBar";

/* Category list for /products.
 * Desktop / tablet: a sticky glass sidebar (icon tile + name + count).
 * Phones: the same buttons become one swipeable pill row that stays under the navbar. */
export default function CategorySidebar({ selected, onSelect, counts, list = sidebarCategories, onShowAll }) {
  const { t, tCategory } = useLang();
  const listRef = useRef(null);

  /* phones: keep the chosen pill in view */
  useEffect(() => {
    const list = listRef.current;
    const on = list?.querySelector(".pcat-item.is-active");
    if (!list || !on || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: on.offsetLeft - (list.clientWidth - on.offsetWidth) / 2, behavior: document.documentElement.dataset.motion === "off" ? "auto" : "smooth" });
  }, [selected]);

  return (
    <aside className="pcat" aria-label={t("prod.page.all")}>
      <div className="pcat-head"><h2 className="pcat-title" aria-hidden="true"><Icon name="layoutGrid" size={16} /></h2>{onShowAll && <button type="button" className="pp-all-categories" onClick={onShowAll}><Icon name="layoutGrid" size={15} />{t("cat.all")}</button>}</div>
      <div className="pcat-list" ref={listRef} role="list">
        {list.map((name) => {
          const active = selected === name;
          const count = counts?.[name];
          const empty = count === 0 && name !== ALL_CATEGORIES;
          return (
            <button key={name} type="button" role="listitem" aria-pressed={active} style={categoryTone(name)}
              className={`pcat-item ${active ? "is-active" : ""} ${empty ? "is-empty" : ""}`}
              onClick={() => onSelect(name)}>
              <span className="pcat-ico" aria-hidden="true">{categoryIcon(name, 18)}</span>
              <span className="pcat-name">{tCategory(name)}</span>
              {count != null && <span className="pcat-count">{count}</span>}
              <Icon name="chevronDown" size={16} className="pcat-chev" />
            </button>
          );
        })}
      </div>
      <ScrollBar targetRef={listRef} className="pcat-sbar" />
    </aside>
  );
}
