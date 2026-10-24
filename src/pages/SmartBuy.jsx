import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import Icon from "../components/ui/Icon";
import PageShell from "../components/layout/PageShell";
import { useCatalog } from "../context/CatalogContext";
import { useLang } from "../context/LanguageContext";
import { usePlus } from "../context/PlusContext";
import { formatPrice } from "../lib/constants";

const MEALS = [
  { id: "breakfast", icon: "sun", roles: [
    { categories: ["Non mahsulotlari"], words: ["non", "bread", "buxanka"] },
    { categories: ["Sut mahsulotlari", "Go'sht"], words: ["tuxum", "egg", "sut", "milk", "qatiq", "yogurt", "pishloq", "cheese"] },
    { categories: ["Mevalar"], words: ["olma", "apple", "banan", "banana", "meva", "fruit"] },
    { categories: ["Ichimliklar", "Sut mahsulotlari"], words: ["choy", "tea", "coffee", "kofe", "sharbat", "juice"] },
  ] },
  { id: "lunch", icon: "sun", roles: [
    { categories: ["Go'sht"], words: ["tovuq", "chicken", "mol", "go'sht", "meat", "qiyma"] },
    { categories: ["Sabzavotlar"], words: ["kartoshka", "potato", "guruch", "rice", "makaron", "pasta"] },
    { categories: ["Sabzavotlar", "Mevalar"], words: ["piyoz", "onion", "pomidor", "tomato", "bodring", "carrot"] },
    { categories: ["Non mahsulotlari"], words: ["non", "bread"] },
  ] },
  { id: "snacks", icon: "apple", roles: [
    { categories: ["Mevalar"], words: ["meva", "fruit", "banan", "olma", "tarvuz", "gilos"] },
    { categories: ["Sneklar", "Shirinliklar"], words: ["snack", "chips", "qurt", "shirin", "chocolate", "lay"] },
    { categories: ["Sut mahsulotlari", "Ichimliklar"], words: ["yogurt", "qatiq", "sut", "milk", "sharbat", "juice"] },
  ] },
  { id: "dinner", icon: "moon", roles: [
    { categories: ["Go'sht"], words: ["tovuq", "chicken", "go'sht", "meat", "qiyma"] },
    { categories: ["Sabzavotlar"], words: ["kartoshka", "potato", "sabzavot", "vegetable"] },
    { categories: ["Sabzavotlar", "Mevalar"], words: ["piyoz", "onion", "bodring", "pomidor", "tomato"] },
    { categories: ["Non mahsulotlari"], words: ["non", "bread"] },
  ] },
];

const low = (value) => String(value ?? "").toLocaleLowerCase();
const offerFor = (product) => product.prices.filter((offer) => offer.inStock !== false && offer.price > 0).sort((a, b) => a.price - b.price)[0] ?? null;

function bundleFor(meal, products, budget, priority) {
  const chosen = [];
  const seen = new Set();
  let total = 0;
  const meat = ["go'sht", "meat", "tovuq", "chicken", "mol qiyma"];

  for (const role of meal.roles) {
    const candidates = products.map((product) => {
      const offer = offerFor(product);
      if (!offer || (priority === "vegetarian" && meat.some((word) => low(product.name).includes(word)))) return null;
      const name = low(product.name);
      const productCategories = [...new Set([product.category, ...(product.categories ?? [])].filter(Boolean).map(low))];
      const categoryMatch = role.categories.some((item) => productCategories.includes(low(item)));
      const mealMatch = product.mealTypes?.includes(meal.id) || product.mealType === meal.id;
      const wordMatch = role.words.some((word) => name.includes(low(word)));
      if (!categoryMatch && !wordMatch && !mealMatch) return null;
      const priorityMatch = priority === "protein" && (productCategories.includes("go'sht") || productCategories.includes("sut mahsulotlari")) ? 2 : 0;
      const score = (categoryMatch ? 3 : 0) + (wordMatch ? 2 : 0) + (mealMatch ? 4 : 0) + priorityMatch;
      return { product, offer, score };
    }).filter(Boolean).filter(({ product }) => !seen.has(product.slug));

    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (priority === "savings") return a.offer.price - b.offer.price;
      return a.offer.price - b.offer.price;
    });
    const selected = candidates.find(({ offer }) => total + offer.price <= budget);
    if (!selected) continue;
    chosen.push(selected);
    seen.add(selected.product.slug);
    total += selected.offer.price;
  }
  return { id: meal.id, icon: meal.icon, items: chosen, total, budget };
}

export function SmartBuyPanel() {
  const { t, tProduct } = useLang();
  const { products, status } = useCatalog();
  const { isPlus } = usePlus();
  const [budget, setBudget] = useState("");
  const [priority, setPriority] = useState("balanced");
  // Exactly one meal period can be planned at a time (breakfast OR lunch OR snacks OR dinner).
  const [selectedMeal, setSelectedMeal] = useState(null);
  const [generated, setGenerated] = useState(false);
  const amount = Number(budget);

  const bundles = useMemo(() => {
    if (!generated || !Number.isFinite(amount) || amount <= 0) return [];
    return MEALS.filter((meal) => meal.id === selectedMeal).map((meal) => bundleFor(meal, products, amount, priority));
  }, [generated, amount, selectedMeal, products, priority]);

  const pickMeal = (id) => { setSelectedMeal(id); setGenerated(false); };
  const submit = (event) => { event.preventDefault(); if (amount > 0 && selectedMeal) setGenerated(true); };

  if (!isPlus) {
    return (
      <section className="sb-premium-card">
        <span className="sb-premium-icon"><Icon name="crown" size={28} /></span>
        <span className="nt-eyebrow">{t("smart.eyebrow")}</span>
        <h2>{t("smart.premium.title")}</h2>
        <p>{t("smart.premium.text")}</p>
        <Link to="/premium" className="nt-btn nt-btn-primary nt-btn-lg">{t("smart.premium.cta")}<Icon name="arrowRight" size={17} /></Link>
      </section>
    );
  }

  return (
    <div className="sb-page">
      <header className="sb-hero nt-glass">
        <span className="sb-hero-mark"><Icon name="sparkles" size={25} /></span>
        <div><span className="nt-eyebrow">{t("smart.eyebrow")}</span><h1>{t("smart.title")}</h1><p>{t("smart.subtitle")}</p></div>
        <span className="sb-member"><Icon name="crown" size={15} />Premium</span>
      </header>

      <form className="sb-form nt-glass" onSubmit={submit}>
        <div className="sb-form-grid">
          <label className="sb-field sb-budget"><span><Icon name="wallet" size={17} />{t("smart.budget")}</span><input type="number" min="1" step="any" inputMode="numeric" required value={budget} onChange={(event) => { setBudget(event.target.value); setGenerated(false); }} placeholder="100000" /><small>{t("smart.budgetHint")}</small></label>
          <label className="sb-field"><span><Icon name="sliders" size={17} />{t("smart.priority")}</span><select value={priority} onChange={(event) => { setPriority(event.target.value); setGenerated(false); }}>{["balanced", "savings", "protein", "vegetarian"].map((value) => <option key={value} value={value}>{t(`smart.priority.${value}`)}</option>)}</select><small>{t(`smart.priority.${priority}`)}</small></label>
        </div>
        <fieldset className="sb-meals">
          <legend>{t("smart.meals")}</legend>
          <div role="radiogroup" aria-label={t("smart.meals")}>{MEALS.map((meal) => <button key={meal.id} type="button" role="radio" className={selectedMeal === meal.id ? "is-selected" : ""} aria-checked={selectedMeal === meal.id} onClick={() => pickMeal(meal.id)}><Icon name={meal.icon} size={18} />{t(`smart.${meal.id}`)}</button>)}</div>
        </fieldset>
        <button type="submit" className="nt-btn nt-btn-primary nt-btn-lg sb-submit" disabled={status !== "ready" || !selectedMeal || !(amount > 0)}><Icon name="sparkles" size={18} />{t("smart.generate")}<Icon name="arrowRight" size={16} /></button>
      </form>

      {generated ? (
        <section className="sb-results">
          <div className="sb-results-head"><div><span className="nt-eyebrow">{t("smart.results")}</span><h2>{t("smart.results")}</h2></div><span className="sb-budget-pill"><Icon name="wallet" size={15} />{formatPrice(amount)}</span></div>
          {bundles.map((bundle) => {
            const fits = bundle.items.length > 0 && bundle.total <= bundle.budget;
            return (
              <article className="sb-bundle nt-glass" key={bundle.id}>
                <header className="sb-bundle-head"><span className={`sb-meal-icon sb-${bundle.id}`}><Icon name={bundle.icon} size={21} /></span><div><h3>{t(`smart.${bundle.id}`)}</h3><small>{fits ? t("smart.within") : t("smart.noResults")}</small></div><div className="sb-total"><small>{t("smart.combo")}</small><b>{formatPrice(bundle.total)}</b></div></header>
                {bundle.items.length > 0 ? <ul className="sb-items">{bundle.items.map(({ product, offer }) => <li key={product.slug}><span className="sb-item-thumb">{product.image ? <img src={product.image} alt="" loading="lazy" /> : <Icon name="package" size={18} />}</span><Link to={`/product/${product.slug}`}>{tProduct(product, "name")}</Link><small><Icon name="store" size={13} />{offer.store}</small><b>{formatPrice(offer.price)}</b></li>)}</ul> : <p className="sb-empty">{t("smart.noResults")}</p>}
                <footer><span><Icon name={fits ? "checkCircle" : "info"} size={15} />{fits ? `${bundle.items.length} ${t("smart.item")}` : t("smart.over")}</span><span>{t("smart.budget")}: {formatPrice(bundle.budget)}</span></footer>
              </article>
            );
          })}
          {!bundles.length && <p className="sb-empty nt-glass">{t("smart.empty")}</p>}
          <p className="sb-disclaimer"><Icon name="info" size={15} />{t("smart.disclaimer")}</p>
        </section>
      ) : <p className="sb-empty-prompt"><Icon name="sparkles" size={18} />{t("smart.empty")}</p>}
    </div>
  );
}

export default function SmartBuy() {
  return <PageShell><SmartBuyPanel /></PageShell>;
}
