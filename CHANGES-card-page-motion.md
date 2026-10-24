# Card → full page, and motion/typography upgrade

## Task A — product card opens the full page (no popup)
- ProductCard.jsx: the card is a plain <Link to="/product/:slug"> (Ctrl/Cmd/middle-click open a new tab). Removed the click handler and its "view" tracking; ProductDetail's effect is the single place a view is tracked. Warms the page chunk on pointer-enter, focus, touchstart and when the browser is idle.
- lib/preload.js (new): shared loader + preloadProduct()/preloadProductWhenIdle(). App.jsx lazy-loads ProductDetail through it.
- App.jsx: removed ProductModal, backgroundLocation/modalSlug/shown-location; plain <Routes>. ScrollTop = new pathname → top; Back/Forward restore the saved scroll position (history.scrollRestoration = "manual").
- Home.jsx: selected category is remembered for the tab (sessionStorage) so Back returns to the same category.
- ProductDetail.jsx: ported from the modal — per-store unit price, per-store freshness, "+X above the lowest price" difference, price-alert target always visible (was only shown for favourites). Table row animation shortened (≤0.2s).
- Deleted: components/products/ProductModal.jsx, lib/productLink.js. Removed .pm-* rules from styles/extras.css and the modal.* keys (uz/ru/en) from shared/translations.plus.js.

## Task B — motion + typography
- tokens.css: new --ease-*, --dur-*, --shadow-lift, --fs-*, --track-*, --mesh-* tokens.
- styles/motion.css (new, imported before mobile.css): type scale/balance/tracking, animated headline gradient, ambient mesh + parallax for banners, store-mark float, button press/shine, card lift, breathing best-price tint, navbar scroll shadow (opacity), product-page arrival (≤0.28s), reduced-motion + data-motion="off" handling, lighter on phones.
- components/ui/Words.jsx (extracted from Home), components/ui/Mesh.jsx, hooks/useParallax.js (new). Mesh+parallax used in Home hero, GuestShowcase, Plus hero.

## Assumptions
- Single exception to "transform/opacity only": the headline gradient drift animates background-position on one element (off on phones and with reduced motion).
- About/Contact/Auth banners get the type polish only (they already have orbs); no extra markup.

## Not verified here (sandbox could not reach the npm registry)
`npm run build`, `npm run lint`, visual checks at 360/390/768/1280/1440, Lighthouse. Passed: `npm run check:i18n`, JSX syntax check of all src files, 62/64 `npm test` (2 failures are server tests that need uninstalled packages).

## Manual test checklist
1. Home (signed in): click a card image, title, "see prices" → full page, no overlay, no skeleton flash. Back → same scroll + same category.
2. Ctrl/Cmd/middle-click a card → new tab with the full page.
3. Guest → card → page shows the sign-up Gate.
4. Product page: breadcrumb, image viewer, store table (cheapest highlighted, stock, difference, unit price, freshness, promos), savings, alert target, favourite, cart stepper, similar / bought together.
5. SmartSearch, Cart, Notifications, Admin "open on site", Deals → each goes to the full page.
6. Network tab: product view event fires once per product.
7. Banners (Home guest + user, showcase, Plus): mesh drift, parallax, spotlight, no extra height; toggle motion off and OS reduced motion → everything static.
8. Light/dark; 360–1440 px: no horizontal scroll, phone cards unchanged (2 per row).

---
## Round 2
- **Card customization removed**: deleted `CardSettings.jsx` and `DisplayPrefsContext.jsx` (and its provider in bootstrap, its use in ProductCard/ProductBrowser/Danger), the self-contained `.nt-viewdock/.nt-cardset/.nt-view-preview/.nt-range/.nt-price-*` CSS and the orphaned `card.*` translation keys (kept `card.pricesOnCards`). Grid is fixed to the default comfortable/glass layout; all offers show on laptop cards, phone cards unchanged.
- **Banners**: the three supermarket names (`.nt-hero-stores`) are gone from the home hero (hero is single column). New indigo + amber palette via `--banner-*` tokens (light + dark) for the home hero and guest showcase.
- **Search suggestions fixed** (`SmartSearch.jsx`): the results list was a portal placed directly inside `AnimatePresence`, which ignores non-element children, so it never rendered. The portal now wraps `AnimatePresence`.
- **Checkout**: clicking "Choose store" opens a new dialog (`components/cart/StoreChoiceModal.jsx`) — store cards with total, coverage, "cheapest" badge, difference and savings; Confirm continues to review, close returns to the cart. Bottom sheet on phones. New key `cart.chooseSub` (uz/ru/en).
- **Style**: card polish (sheen, arrow slide, gradient add button, radius), checkout picker, focus rings, selection colour, footer/nav/chip transitions, toast glass — all in `styles/motion.css`.
- Not run here (no npm registry): build, lint, browser/visual checks. Old density/surface CSS variants for cards are left in place (harmless, no longer reachable).
