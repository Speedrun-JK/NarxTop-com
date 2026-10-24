import { useEffect, useRef } from "react";
import { useLang } from "../../context/LanguageContext";
import ScrollBar from "../ui/ScrollBar";
import CategoryIcon from "../ui/CategoryIcon";
import { ALL_CATEGORIES } from "../../lib/constants";

import "./CategoryNav.css";

const categories = [
  [ALL_CATEGORIES, "layoutGrid"],
  ["Sneklar", "chips"],
  ["Ichimliklar", "drink"],
  ["Mevalar", "apple"],
  ["Sabzavotlar", "carrot"],
  ["Shirinliklar", "candy"],
  ["Non mahsulotlari", "bread"],
  ["Go'sht", "meat"],
  ["Baliq", "fish"],
  ["Polufabrikat", "semifinished"],
  ["Sut mahsulotlari", "milk"],
  ["Uy-ro'zg'or", "spray"],
  ["Shaxsiy gigiyena", "toothbrush"],
  ["Boshqa", "package"],
].map(([name, icon]) => ({ name, icon }));

/* Each category has its OWN colour (never purple/violet). It drives the pill border, the icon tile, the count badge,
 * the selected state — and the border / chip of every product card in that category (see ProductCard + styles/v24.css).
 * a/b are the selected-state gradient stops (both pass 4.5:1 with white text); ink / inkD are label colours on a tinted
 * surface in light / dark mode. "Barcha kategoriyalar" has no tone: it follows the brand brown (--accent*). */
const TONES = new Map([
  ["Sneklar",          { rgb: "232,160,10", a: "#a46807", b: "#a05f00", ink: "#8a5200", inkD: "#ffd36b" }],
  ["Ichimliklar",      { rgb: "10,166,201",  a: "#087d9a", b: "#06667f", ink: "#05667f", inkD: "#6fe0f7" }],
  ["Mevalar",          { rgb: "229,72,63",   a: "#ce4439", b: "#b02620", ink: "#a21f19", inkD: "#ff9d94" }],
  ["Sabzavotlar",      { rgb: "240,122,28",  a: "#be5615", b: "#b8480a", ink: "#a24508", inkD: "#ffb77d" }],
  ["Shirinliklar",     { rgb: "236,79,134",  a: "#c93e72", b: "#b02456", ink: "#a31f54", inkD: "#ff9cc0" }],
  ["Non mahsulotlari", { rgb: "190,126,56",  a: "#a16629", b: "#86521a", ink: "#7a4a14", inkD: "#f0c288" }],
  ["Go'sht",           { rgb: "190,52,70",   a: "#c03a4e", b: "#8c1f33", ink: "#8f1f33", inkD: "#ff9aa8" }],
  ["Baliq",            { rgb: "44,151,184",  a: "#187d9c", b: "#105d78", ink: "#075b73", inkD: "#8fe5f2" }],
  ["Polufabrikat",     { rgb: "199,143,66",  a: "#a56a20", b: "#825018", ink: "#754812", inkD: "#f4ca83" }],
  ["Sut mahsulotlari", { rgb: "58,120,224",  a: "#3670d2", b: "#2257b5", ink: "#1c4aa0", inkD: "#9cc0ff" }],
  ["Uy-ro'zg'or",      { rgb: "16,165,138",  a: "#0c846f", b: "#0a6f5d", ink: "#076452", inkD: "#6fe6cf" }],
  ["Shaxsiy gigiyena", { rgb: "46,155,230",  a: "#247ab9", b: "#1670b3", ink: "#115f96", inkD: "#8fd2ff" }],
  ["Boshqa",           { rgb: "140,120,104", a: "#847261", b: "#5f4e41", ink: "#5c4a3c", inkD: "#d3bfae" }],
]);

/** CSS custom properties for a category (spread into a style prop). Empty object = use the brand brown. */
export const categoryTone = (name) => {
  const t = TONES.get(name);
  return t ? { "--cat-rgb": t.rgb, "--cat-a": t.a, "--cat-b": t.b, "--cat-ink": t.ink, "--cat-ink-d": t.inkD } : {};
};

const categoryIconName = new Map(categories.map(({ name, icon }) => [name, icon]));
export const categoryNames = categories.map(({ name }) => name);
/** name -> CategoryIcon key (used by the admin product form) */
export const categoryIconFor = (name) => categories.find((c) => c.name === name)?.icon ?? "package";
export const categoryIcon = (name, size = 18) => <CategoryIcon name={categoryIconName.get(name) ?? "package"} size={size} />;

export default function CategoryNav({ selectedCategory, onCategoryChange, counts }) {
  const { t, tCategory } = useLang();
  const listRef = useRef(null);

  /* phones: the pills are one swipeable row, so keep the chosen one in view */
  useEffect(() => {
    const list = listRef.current;
    const on = list?.querySelector(".category-button-active");
    if (!list || !on || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: on.offsetLeft - (list.clientWidth - on.offsetWidth) / 2, behavior: document.documentElement.dataset.motion === "off" ? "auto" : "smooth" });
  }, [selectedCategory]);

  return (
    <nav className="category-section" aria-label={t("p.home.all")}>
      <div className="category-container">
        <div className="category-list" ref={listRef}>
          {categories.map((category) => {
            const isActive = selectedCategory === category.name;
            const count = counts?.[category.name];
            return (
              <button key={category.name} type="button" aria-pressed={isActive} style={categoryTone(category.name)}
                className={`category-button ${isActive ? "category-button-active" : ""} ${count === 0 ? "is-empty" : ""}`}
                onClick={() => onCategoryChange(category.name)}>
                <span className="category-tile" aria-hidden="true"><CategoryIcon name={category.icon} size={24} /></span>
                <span className="category-label">{tCategory(category.name)}</span>
                {count != null && <span className="category-count">{count}</span>}
              </button>
            );
          })}
        </div>
        <ScrollBar targetRef={listRef} />
      </div>
    </nav>
  );
}
