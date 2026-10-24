import { summarize } from "./product";

export const SORT_OPTIONS = [
  ["cheap", "p.sort.cheap"],
  ["expensive", "p.sort.expensive"],
  ["discount", "p.sort.discount"],
  ["savings", "p.sort.savings"],
  ["name", "p.sort.name"],
];
export const DEFAULT_SORT = "cheap";
export const isSortKey = (key) => SORT_OPTIONS.some(([k]) => k === key);

/* Sorts a copy of `items`. Products with no in-stock offer always go last. Ties fall back to the name. */
export function sortProducts(items, sort, { drops, getName = (p) => p.name, locale } = {}) {
  const meta = new Map((items ?? []).map((p) => [p.slug, summarize(p, { drops })]));
  const byName = (a, b) => String(getName(a)).localeCompare(String(getName(b)), locale);
  const key = {
    cheap: (a, b) => meta.get(a.slug).best.price - meta.get(b.slug).best.price,
    expensive: (a, b) => meta.get(b.slug).best.price - meta.get(a.slug).best.price,
    discount: (a, b) => (meta.get(b.slug).drop?.percent ?? meta.get(b.slug).discount) - (meta.get(a.slug).drop?.percent ?? meta.get(a.slug).discount),
    savings: (a, b) => meta.get(b.slug).savingVsWorst - meta.get(a.slug).savingVsWorst,
    name: byName,
  }[sort] ?? (() => 0);
  return [...(items ?? [])].sort((a, b) => (meta.get(a.slug).available === false) - (meta.get(b.slug).available === false) || key(a, b) || byName(a, b));
}
