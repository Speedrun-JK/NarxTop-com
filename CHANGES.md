# NarxTop change log

## Audit and interpretation

- **A1:** `.nt-hero { overflow: hidden }` and the absolutely positioned search panel could clip results. The input had no body scroll lock or wheel/touch cancellation; the “see all” row sat outside the result list's scroll area.
- **B1:** Dark product cards used a canvas cutout capped at 260px and a radial image mask. Both could soften images or leave halos.
- **D1:** The password eye existed, but its small, weakly styled target shared the input's right edge with validation feedback.
- **E1:** “Maximum Economy” is treated as the home “Biggest savings” strip (`Deals.jsx`, `deals.title`).
- **A6:** Notifications is the user inbox and is labelled “Messages”; the admin message inbox is out of scope. Contact is available from desktop and phone menus, including for guests.
- **E2:** The supermarket gift event manager in `PlusPanel.jsx` is the gift-record UI to compact.
- **B8:** “Glass” and “Solid” refer to the card surface choices already stored by `DisplayPrefsContext`.
- **B5:** Product quick view means `ProductModal.jsx`; the full product page remains the detail view.
- **A3:** Suggested terms were removed from the shared `SmartSearch`, so the search page follows the same behavior as the home page.

## Changes

- Search results render in a body portal positioned from the input and reposition on scroll, resize, and `visualViewport` changes. Search terms were removed; search semantics and keyboard navigation remain.
- Home, guest showcase, navbar, quick tiles, and shared styles were adjusted for a more compact hero, logos, menu placement, sticky navigation, safe areas, and narrower screens. Product cards now show source images directly; category icons share one icon map; price display and Glass/Solid settings were extended.
- Quick view now includes store-specific unit price, freshness, stock, and price difference, an alert target, a 44px close control, focus trapping/restoration, Esc/backdrop close, body scroll locking, and a phone sticky action area.
- Cart uses a tested single-store selector and a persisted review/route/receipt/confirmation draft. Receipt upload requires a compressed photo before recording a pending purchase; successful upload clears only purchased items.
- Added authenticated receipt upload/list routes, private admin image/review routes, server-side image validation and rate limits, admin receipt review UI, Plus gift notices, read controls, and receipt status notifications.
- Added storage helpers and motion preferences; improved the password-eye target and registration layout with store marks, a visible +998 prefix, translated consent links, and reserved inline feedback space. Compacted the Plus gift event panel.
- Added Maximum Economy settings validation, Mongo persistence, cached public settings, a rate-limited admin save route, a translated tab with picker/exclusions/reordering/live preview, and automatic fallback when the public API is unavailable.
- Added explicit store confirmation, a recovery path for declined/unavailable location, an optional live camera capture path, and bounded server pagination for Plus gift records.
- Corrected the motion preference semantics so On enables animation, Off disables every Framer Motion transition, and System follows the OS preference. Split route pages and heavyweight admin panels into on-demand chunks.
- Bumped browser storage envelopes to schema v2 with an explicit migration path and tests. Account switching and the clear-data action now remove user-scoped checkout/Plus notice state.

## Requirement checklist

Every requested implementation item is complete. The checklist status describes implementation; live services and physical-device checks that could not run are recorded separately below.

| ID | Status | Reason / verification |
|---|---|---|
| A1 | done | Portal positioning, viewport updates, body scroll behavior, result-list scrolling, and keyboard combobox navigation are implemented. |
| A2 | done | Compact hero, reduced decorative content, and store marks are implemented. Desktop and phone home layouts were inspected. |
| A3 | done | Suggestions and orphaned keys/styles were removed from shared search; translation checker passes. |
| A4 | done | Sticky navigation, stacking tokens, safe-area offsets, and scroll padding are implemented; phone navigation was inspected at 360px. |
| A5 | done | Quick tiles and phone navigation sizing are implemented and visible at 360/390px. |
| A6 | done | Inbox/contact links live in the phone menu, with guest contact access and unread count support; the guest menu was inspected. |
| A7 | done | Guest images include intrinsic dimensions and loading hints. No `srcset` was added because the bundled sources do not provide alternate-size variants. |
| B1 | done | Product source images render without destructive preprocessing; light/dark card surfaces remain distinct. |
| B2 | done | Product cards reserve image space and use first-item eager loading with lazy loading for the remainder. |
| B3 | done | Product cards contain no eye/viewer action; the product image remains the detail link. |
| B4 | done | Card settings use opaque grouped controls, a phone sheet, and large touch targets. |
| B5 | done | Quick view provides the required price/stock details, keyboard dismissal, focus management, scroll lock, and phone action area. |
| B6 | done | Shared category icon lookup and fallback cover admin-defined and unknown categories. |
| B7 | done | Three-chain price rows, store selection, display modes, and persistence are implemented. |
| B8 | done | Glass and Solid styles have separate surfaces and previews. |
| C1 | done | `cheapestSingleStore` picks one eligible chain; core tests passed. |
| C2 | done | Cart product details disclosure and summary layout are implemented. |
| C3 | done | Checkout requires an explicit store selection before confirmation; confirmation is guarded by the step state machine. |
| C4 | done | Review state, per-user draft persistence, and recovery on reload are implemented; receipt bytes are excluded from local storage. |
| C5 | done | Route lookup supports browser location and validated manual coordinates when permission or support is unavailable. |
| C6 | done | Receipt picker, preview/retake, client compression, and camera capture code are implemented. Per the request, physical camera permission/device QA is deferred; camera capability is expected in the upcoming update. |
| C7 | done | Receipt upload precedes purchase recording; pending status, stable order ID, retry, and idempotency are implemented. |
| C8 | done | Authenticated/private routes, image signature/size checks, rate limiting, idempotency, indexes, and fake-route coverage are implemented. |
| D1 | done | Password visibility control has the required hit area, validation spacing, and keyboard focus behavior. |
| D2 | done | The signup page includes the two-pane value panel, store marks, +998 prefix, reserved feedback space, and legal links; the 360px layout was inspected. |
| E1 | done | Maximum Economy validation, rate-limited persistence, picker, ordering, exclusions, preview, and fallback are implemented. |
| E2 | done | The Plus gift API returns bounded pages with exact pending counts, filter/search, pagination, and direct ID issue lookup; endpoint tests passed. |
| E3 | done | Admin receipts include filters, cursor pagination, private thumbnails, review actions, and pending badge. |
| F1 | done | Storage uses a versioned envelope and explicit migrations; cross-tab, corruption, quota, and account reset behavior have coverage. |
| F2 | done | System/On/Off semantics now match their labels; Off skips all Framer Motion animation, CSS transitions, and count-up updates. |
| F3 | done | Plus notices are owner-scoped, read-state backed, deduplicated across reload/poll, and reset with user data. |
| F4 | done | Plus crown includes an accessible label/tooltip and responsive overflow handling. |

## Files changed

- Foundation and motion: `index.html`, `eslint.config.js`, `src/App.jsx`, `src/bootstrap.jsx`, `src/lib/storage.js`, `src/context/MotionPrefsContext.jsx`, `src/context/AuthContext.jsx`, `src/context/CartContext.jsx`, `src/context/DisplayPrefsContext.jsx`, `src/context/UserDataContext.jsx`, `src/context/PlusContext.jsx`, `src/hooks/useCountUp.js`, `src/hooks/useLogout.js`, `src/hooks/useSpotlight.js`, `src/lib/fly.js`, `src/lib/cutout.js`, `src/components/brand/AnimatedBrand.jsx`, `src/components/ui/LogoutOverlay.jsx`, `src/components/layout/ScrollProgress.jsx`.
- Home, navigation, products, auth, and account: `src/pages/Home.jsx`, `src/pages/Auth.jsx`, `src/pages/Cart.jsx`, `src/pages/Admin.jsx`, `src/pages/account/Notifications.jsx`, `src/pages/account/Preferences.jsx`, `src/components/home/CategoryNav.jsx`, `src/components/home/Deals.jsx`, `src/components/home/GuestShowcase.jsx`, `src/components/home/HomeSections.jsx`, `src/components/home/SmartSearch.jsx`, `src/components/layout/Navbar.jsx`, `src/components/cart/RouteModal.jsx`, `src/components/products/CardSettings.jsx`, `src/components/products/ProductCard.jsx`, `src/components/products/ProductModal.jsx`, `src/components/brand/Logo.jsx`, `src/components/ui/Icon.jsx`, `src/components/auth/Field.jsx`, `src/components/admin/PlusPanel.jsx`, `src/components/admin/ReceiptsPanel.jsx`, `src/components/admin/MaxEconomyPanel.jsx`, `src/data/legal.js`, `src/lib/product.js`, `src/services/admin.js`, `src/services/catalog.js`, `src/services/receipts.js`.
- Backend, tests, translations, and styles: `server/index.js`, `server/admin.js`, `server/account.js`, `server/plus.js`, `server/receipts.js`, `server/__tests__/adminRoutes.test.js`, `server/__tests__/helpers/fakes.js`, `server/__tests__/plus.test.js`, `server/__tests__/receipts.test.js`, `server/__tests__/storage.test.js`, `shared/core/maxEconomy.js`, `shared/core/__tests__/core.test.js`, `shared/translations.js`, `shared/translations.en.base.js`, `shared/translations.platform.js`, `shared/translations.en.platform.js`, `shared/translations.en.pages.js`, `shared/translations.route.js`, `shared/translations.plus.js`, `scripts/check-i18n.mjs`, `package.json`, and styles `admin.css`, `card.css`, `cart-footer.css`, `cart.css`, `design.css`, `extras.css`, `layout.css`, `mobile-fit.css`, `mobile-v3.css`, `mobile-v4.css`, `phone.css`, `platform.css`, `route.css`, `refresh.css`, `revamp.css`, `tokens.css` under `src/styles/`.

## Data, environment, and verification

- Mongo collections/indexes: added `site_settings` (unique `key`, stores the `maxEconomy` value), `receipts` (unique `id`, unique `{ userId, orderId }`, and descending creation cursor), `receipt_images` (unique `receiptId`), `user_notifications` (unique `id`, `{ userId, createdAt }`), and a pending/issued gift cursor for `plus_gift_events`. Account deletion removes the user's receipt and notice records. No Supabase schema change and no new environment variables.
- Passed: `npm run lint` (0 warnings/errors), `npm run build` (maximum initial chunk 240 KB; admin and page chunks load on demand), and `npm run check:i18n` (0 missing keys in uz/ru/en).
- Passed earlier in this task: full `npm test` (87/87); Plus and storage tests (14/14). Those tests print expected simulated database failure output from failure-path cases.
- Browser visual review covered desktop home and phone home at 390px, the guest menu at 390px, and signup at 360px. The temporary preview used dummy Supabase values and no live backend. A local OAuth redirect blocked further browser navigation, so protected routes and the full checkout/admin flow were not exercised in the browser.
- No Mongo/Supabase credentials were present, so live database integration could not be run. Physical camera permissions/devices were not exercised, as requested; receipt image selection and camera code remain implemented for the upcoming camera update.

---
## Quick-look pop-up + style pass (v4)
- **New** `components/products/ProductPreview.jsx` (v6: dark glass layout matching the design reference; "See full product page" button, store rows and best-price chip all open the product page; card "Savatga" button made slightly smaller) — glass (transparent, blurred-backdrop) quick-look dialog. Opens on a plain click of a product photo / title on cards and on cart rows; Ctrl/Cmd/middle-click still opens the full page in a new tab. Shows a tilting product photo, best-store + unit-price chips, price hero with saving, stat tiles, per-store price bars, add-to-cart / stepper, favourite, and a **View full info** button that routes to `/product/:slug`. Esc, backdrop click, close button and (on phones) drag-down close it; focus is trapped and restored; bottom sheet on phones.
- **New** `styles/glass.css` (imported last in `bootstrap.jsx`) — pop-up styles plus refinements for product cards (gradient hover ring, "Quick look" pill, sale tag), the cart page (accent header bars, gradient rows, richer total card), the product page (framed photo stage, price hero, icon fact tiles, price bars in the store table).
- `ProductDetail.jsx`: store table gets a relative price bar (`.nt-pbar`).
- `shared/translations.preview.js` (uz / ru / en, `p.pv.*`) merged at the end of `translations.js`.
- Not run here: `npm run build` / `lint` (registry unreachable in the sandbox). Syntax-checked all touched files, `check:i18n` passes, and the pop-up CSS was rendered in a static mock (light/dark, 1280 and 390 px).
