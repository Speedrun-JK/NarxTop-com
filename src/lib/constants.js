// Category value used in products.json / CategoryNav for "show everything".
export const ALL_CATEGORIES = "Barcha kategoriyalar";

export function formatPrice(price) {
  const n = Number(price);
  return `${(Number.isFinite(n) ? n : 0).toLocaleString("uz-UZ")} UZS`;
}

export function getCheapestPrice(prices = []) {
  const v = prices.map((item) => Number(item.price)).filter((n) => n > 0);
  return v.length ? Math.min(...v) : null;
}

/* When false, guests must sign in to see products/cart (existing behaviour). */
export const GUEST_BROWSING = false;
