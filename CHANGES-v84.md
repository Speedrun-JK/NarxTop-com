# v84 — compact one-screen banner + richer banner styling (navbar untouched)
- Desktop: navbar + main banner now fit in the first screen. Banner height = 62% of window height (min 460px, max 620px), so the next section ("Supermarketlar narxlari") peeks in underneath and the page scrolls to the rest.
- Short laptop windows (<= 780px high): handwritten note is hidden and the subtitle is clamped to 2 lines so nothing is cut off.
- Smaller headline / search / savings card (sizes follow window height). Phones and tablets (<= 1100px) are unchanged.
- Stat tiles merged into ONE glass strip with dividers (saves height).
- Savings card: slow light sweep around the edge, price bars fill in on every slide, best-price row highlighted, "Eng arzon narxlar" sticker moved above the card (no more overlap with the badge).
- Headline: orange swoosh draws itself once on load; warm glow behind the accent word (dark theme).
- Banner surface: warm corner light, bottom vignette, top sheen, coloured outer glow. Search bar gets a focus glow.
- Motion respects prefers-reduced-motion and the site's motion-off switch.
- Files: src/styles/hero-v84.css (new, imported last in src/bootstrap.jsx). No component changes.

## v84b — new photos, card tucked behind the basket
- New banner photos: src/assets/hero/hero.png (dark) and hero-light.jpg (light).
- The savings card is slightly turned (3D tilt) and sits BEHIND the basket: hero-fg.webp / hero-light-fg.webp are cut-outs of the basket + produce drawn in front of the card (HeroBanner.jsx renders them as .hb-fg). The photo is placed in an image-shaped box so the cut-out always lines up with the photo.
- "Eng arzon narxlar" is now a dark board above the card.
- Search bar has a visible orange border in dark and light themes (focus glow too).
- Stats are three separate soft tiles again (like the mock). No extra feature tiles under the search.
- Phones: only the headline text and the search bar (stats, note, card hidden).
- If you swap the photos, keep the same framing, or re-cut the basket (hero-fg.webp) and adjust --hb-r / --hb-shift in hero-v84.css.
