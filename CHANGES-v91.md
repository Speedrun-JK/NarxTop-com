# v91 — new navbar, page background photos, polish

- `src/styles/theme-v91.css` (imported last in `src/bootstrap.jsx`): everything below lives here, so it is easy to tweak or remove.
- **Page background**: `src/assets/bg/bg-dark.webp` (dark theme) / `bg-light.webp` (light theme) on one fixed layer (`body::before`).
  Not applied to the navbar or the main banner. Adjust the readability veil in the two `linear-gradient(...)` lines at the top of the file.
  The old drifting blobs / corner foliage (`.nt-ambient`) are hidden because the photo replaces them.
- **Navbar (> 860px)**: dark = glass pill with orange glow edge + leaves; light = white frosted pill with peach ends. Grouped links with orange
  underline, UZ/RU/EN switch, round icon buttons with orange badges, user pill with chevron. Phones keep the burger layout (`nav-m85.css`).
- `Logo.jsx`: new `bare` mark (orange N + leaf, no tile) used only by the navbar (`<Logo bare size={42} />`).
- Small polish: orange selection/scrollbar/focus ring, card hover lift.

## v91b
- Page background = the photo with a soft wash of the accent colour (brown by default) instead of black/white veil.
- Borders: `--border`, `--line`, `--glass-border`, `--tc-line`, `--card-line` now use the accent colour in both themes (section 4 of theme-v91.css).
- Main banner: removed the "Bugun tejang, ertaga ko‘proq xarid qiling!" line (HeroBanner.jsx); accent border, larger headline/spacing on desktop, side-by-side buttons on phones.
