# v76
- Sort drop-down opened BEHIND the product cards -> `.nt-viewbar` / `.nt-section-head` now get their own higher z-index (v76.css section 1).
- "Supermarketlar narxlari" carousel (DailyPicks.jsx): every 5 s it slides to the next set of 3 products (pauses on hover / keyboard focus / hidden tab, wraps with a fade), animated progress dot, new card look.
- Hero banner: supermarket photo (src/assets/hero/hero.jpg), slightly transparent, slow pan animation, dark overlay for the text.
- Cheapest price highlight redesigned: gold "best price" tag with a one-off shine (product cards, hero carousel, carousel badge). No more thick coloured/green border.
- Corner foliage: new `components/ui/Foliage.jsx` (SVG leaves + cherry tomatoes), shown in page corners, carousel corners and hero corner.
- New stylesheet `src/styles/v76.css`, imported last in bootstrap.jsx.
- v76: removed the tick (check circle) from the cheapest row on product cards; keeps only the gold highlight
