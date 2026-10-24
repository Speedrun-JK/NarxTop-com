# v68

## Product description translations
- Removed the per-product description translations (`prod.<slug>.desc`) from `shared/translations.js` and `shared/translations.plus.js`. Product names and all other site translations are untouched.
- New `server/descriptionTranslate.js`: Uzbek description → `{ uz, ru, en }`, saved on the MongoDB product as `descriptionI18n` by the admin create/edit routes. Unchanged text is never re-translated; a failure never blocks saving.
- `server/catalog.js` exposes `descriptionI18n` (only while it matches the current Uzbek text); `tProduct(…, "description")` in `LanguageContext.jsx` reads it.
- Startup: old `prod|*|desc` keys are removed from the Mongo `translations` collection; products without ru/en descriptions are translated in the background (`DESCRIPTION_BACKFILL=false` to skip).
- Env: `GOOGLE_TRANSLATE_API_KEY`, `DESCRIPTION_TRANSLATE=off`, `DESCRIPTION_BACKFILL=false` (see SETUP.md §6).

## Bills (Cheklar) in the admin panel
- `server/receipts.js`: receipt photos stored in MongoDB come back as BSON `Binary`; they are now converted to a Buffer so the admin sees the image (`toBuffer`).
- Receipts with promotions were rejected (total ≠ qty × price). Each line may now carry a promo-adjusted `cost` (never above qty × price); the Smart Cart sends it. Analytics use it too.
- `ReceiptsPanel.jsx`: item names fall back to the stored name; line totals use `cost`.

## Product details / preview
- Removed the per-kg/per-litre unit price from the preview (chip) and the detail page (under the best price, per offer, facts row).
- Preview on phones (≤640px, and touch screens ≤860px): larger picture, larger buttons and progress bars, scrollable info area, "See full product page" hidden. Desktop unchanged.

## Main page (phone unless noted)
- Search bar (all sizes): shorter, same width; placeholder is now short and has no "arzon" (`p.search.placeholderShort`).
- Product cards: lower photo, category chip and price rows (`.nt-home` scope).

## Premium page, footer, Smart Cart (phone)
- Premium page and footer compacted.
- Smart Cart: compact product rows (fixes the price overlapping the name), taller product list that no longer traps page scrolling, stores + total are part of the normal page (no inner scroller / custom scrollbar, ≤960px). On phones the per-item select checkbox is gone and saved "unchecked" items are ignored; items can only be removed.

Styles: `src/styles/mobile-v5.css` (imported last). Tests: `server/__tests__/descriptionTranslate.test.js` + a promo-receipt test.

# v69 (merge of v67 base + v68, plus fixes)
- Navbar drops behind every pop-up (preview, Smart Cart dialogs, route, search panel) via `html:has([aria-modal])`; pop-up backdrops raised above it.
- Smart Cart: market boxes use `touch-action: pan-y` and sit in the normal page flow (no separate scroller), so touching them scrolls the page. Phone select-checkbox stays hidden (remove-only).
- Product preview: minimal look (no glow/gradients/hover motion), smaller prices and market logos.
- Main page: the % reduction badge is removed from ordinary product cards (`ProductBrowser hideDrop`); it stays in "Eng katta tejash" (Deals).
- Performance: endless card float animation removed, ambient blobs hidden and blur reduced on phones, reduced-motion respected.
