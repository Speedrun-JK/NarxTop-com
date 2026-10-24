/* One shared loader for the product page chunk: App lazy-loads it, cards warm it up on hover / focus / touch / idle,
 * so a card click never waits on the network. The import promise is cached by the module system. */
export const loadProductDetail = () => import("../pages/ProductDetail");

let warmed = false;
export function preloadProduct() {
  if (warmed) return;
  warmed = true;
  loadProductDetail().catch(() => { warmed = false; });
}

/* Warm the chunk once the browser is idle (called by visible cards). */
export function preloadProductWhenIdle() {
  if (warmed) return;
  if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(preloadProduct, { timeout: 2500 });
  else setTimeout(preloadProduct, 1200);
}
