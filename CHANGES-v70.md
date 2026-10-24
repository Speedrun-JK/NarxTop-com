# v70 — /products page
- New route `/products` (`src/pages/Products.jsx`): category sidebar + big 4-per-row card grid. The card panel is as tall as the sidebar and scrolls inside itself; chosen category is kept in the URL (`?category=`).
- Phones: categories become a sticky glass pill scroller (edge fade + scroll bar); exactly 2 cards per row; compact card layout on phones.
- Home: category controls removed; first 8 products + a new "See all products" button (brown gradient, shimmer) linking to `/products`. No Products link in the navbar.
- Cards (home + /products): category-colour top glow, photo spotlight + shadow, glass heart, gradient discount chip, richer price rows.
- Product preview: brown glass pop-up (animated orbs, light sheen, floating product, staggered rows), light + dark theme, also on phones; reduced-motion respected.
- Site-wide: focus rings, button hover/press, scrollbar and selection colours.
- Styles: `src/styles/products.css` (imported last). Translations in `shared/translations.smartbuy.js`.

## v72 fixes
- /products: page uses the full screen width; cards panel fills everything right of the category sidebar (same height, cards scroll inside it). Cards are the original look again (no extra padding, no image shadow/glow); they are bigger because the panel is wider.
- Categories on phones are no longer sticky.
- Product preview: page behind keeps its look (light blur only, no brown overlay/orbs); brown glass panel is more opaque with explicit dark text (light text in dark theme) so nothing fades out.

## v73
- /products: no inner panel / scroller any more — normal page scroll. Cards use the main-page grid (4 per row, max 303px wide like the main page, same gap and compact phone cards, 2 per row on phones).
- Category sidebar is smaller (210px, smaller rows) and only lists: All, Snacks, Drinks, Fruit, Vegetables, Sweets, Bakery, Meat, Dairy (no household / personal care / other).
- Phones: category pills are a swipe row with a visible scroll bar (was hidden by an older rule); not sticky.

## v74
- Category sidebar: wider (256px), bigger rows, count badges now fit inside (grid column was not allowed to shrink).
- Product preview: restored the green/pink gradients that an old phone rule stripped (white text on no background): tags, "Add to cart", plus readable disabled / stepper / full-page buttons.
- Navbar: "Premium" link replaced by "Products" (/products).
- Extra site-wide polish (hover, focus, font smoothing).
