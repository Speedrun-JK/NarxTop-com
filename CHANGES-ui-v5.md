# UI v5 — categories, in-cart cards, Xarid hisobi, popups, site polish

New files
- `src/components/ui/CategoryIcon.jsx` — full-colour category illustrations (chips, soda bottle, apple, carrot, candy, bread, steak, milk carton, spray, toothbrush, box, colour grid)
- `src/styles/ui-v5.css` — imported LAST in `src/bootstrap.jsx`; everything visual below lives here

Edited files
- `src/components/home/CategoryNav.jsx` — uses CategoryIcon in a `.category-tile` (the old `.category-icon` line-icon rules no longer apply); `categoryIcon()` (used on product cards) returns the same artwork
- `src/components/products/ProductCard.jsx` — `.tc-incart` badge (cart icon + quantity) while the item is in the cart
- `src/components/ui/ConfirmDialog.jsx` — icon tile above the title (trash for danger, info otherwise)
- `src/bootstrap.jsx` — one extra import

Colours
- in-cart card = indigo outline/badge/stepper (`--incart*` tokens in ui-v5.css); green is back to "cheapest price" only
- Xarid hisobi selection + main button and the checkout "Tasdiqlash" button use the brand brown (`--brand-grad`); green stays on the cheapest store, discounts and savings

To undo any part, delete its block in ui-v5.css (sections are numbered 1–6 at the top).
