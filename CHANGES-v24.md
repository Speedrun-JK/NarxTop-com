# v24 — visible borders, coloured categories, product cards without purple

## What changed
**Files edited:** `src/styles/tokens.css`, `src/bootstrap.jsx` (one import), `src/components/ui/CategoryIcon.jsx` (rewritten),
`src/components/home/CategoryNav.jsx`, `src/components/products/ProductCard.jsx`.
**File added:** `src/styles/v24.css` (imported last; sections 1-4 are numbered so any part can be deleted to undo it).

### 1. Borders (the "white borders in light mode" problem)
Cause: several stacked layers declared borders as white (`rgba(255,255,255,.x)`, ~15 of them on light surfaces: quick-look pop-up,
favourite heart, …) or as very pale tokens (`--tc-line #e3d8cf`, `--tc-row-line #ddd6cf`, `--pop-line #e6d6ce`). On the cream/white
light theme those read as white; in dark mode the same values happened to look fine.
Fix: `v24.css` (loads last) sets definitive border tokens for light AND dark, and gives each element a border in its own colour:
- category pill / product card → the category's colour
- price row → the store's colour (Korzinka red, Makro blue, Havas green); cheapest row → green
- heart → pink; in-cart card → amber; product page image/info → brand brown; cheapest-price box → green
- quick-look pop-up (`.pv*`) light-mode edges → brand brown
`tokens.css` also gets `--line`, `--line-strong` and stronger `--border` / `--glass-border`.

### 2. Categories
- label 0.93rem → 0.78rem, tile 44px → 32px, icon 33px → 25px (phones: 27px / 21px / 0.72rem)
- 12 new detailed illustrations (gradients, gloss, outlines, ground shadow, a companion object each, e.g. apple + orange,
  carrot + broccoli, milk carton + cheese). Gradient ids are unique per instance (`useId`).
- each category has its own colour (`TONES` in CategoryNav.jsx): border, tile ring, label, count badge and a selected state with that
  colour's gradient (all selected gradients pass 4.5:1 with white text). No purple: the "all" icon's violet square is now teal.

### 3. Product cards
- in-cart state: indigo/violet → amber-gold (`--incart*` tokens), dark text on the badge for contrast
- sale badge: brown-on-cream → red-pink gradient
- card border, tint, photo ring and category chip follow the category colour; price rows follow the store colour
- `ProductCard` passes `categoryTone()` to the article and `data-store` to each price row

## Not changed
The signed-out banner (`--banner-*` in tokens.css) is still indigo — it is not a product card. Say the word and it can be recoloured.

## Checked
`vite build` OK · eslint clean on changed files · `npm run check:i18n` OK · `npm test` 90/90 ·
visual checks (light + dark, 1360px and 390px): home, catalog, in-cart cards, product page, cart.
