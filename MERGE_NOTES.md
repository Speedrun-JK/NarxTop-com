# Merge notes

**Base:** `narxinitope-fixed` (design system, react-router app, MongoDB catalogue, admin v3, shared core logic, tests).
**Added from `NarxTop-complete-source`:** everything below that B did not have. Where both had the same feature, the
stronger implementation was kept.

## Taken from NarxTop-complete-source (A) — and how it was adapted

| Feature | In the merged build |
|---|---|
| NarxTop Plus (trial, gifts, plan, 1 000 000 UZS free basket limit) | `server/plus.js`, `shared/core/plus.js`, `PlusContext`, `/plus`, Account → Plus, admin → Plus. Uses B's Supabase auth + admin check + audit log + user directory instead of A's duplicate auth/Supabase listing. Errors are stable `code`s translated in the UI. |
| Plus promo dialog + "limit reached" toast | `PlusPrompt.jsx` (only shown once membership status is known) |
| Product pop-up | `ProductModal.jsx` + `lib/productLink.js` — a router "modal route" (Back closes it, URL shareable) instead of A's `pushState` hack, which would corrupt react-router's history index |
| "Biggest savings" collapsible section | `Deals.jsx` — ranked with B's `summarize()` (promo/stock-aware) and real price drops first |
| Store-logo upload | stored in MongoDB (`server/storeLogos.js`) so **all visitors** see them; A kept them in the admin's own `localStorage` |
| English | complete (≈750 keys) for B's UI + A's texts; `check:i18n` now enforces uz/ru/en parity |
| Privacy policy + Terms | `/privacy`, `/terms` (`src/data/legal.js`), rewritten to match what this product actually collects; linked in the footer |
| Nearest-branch lookup (OpenStreetMap) | `src/lib/nearby.js` inside B's `RouteModal`; B's four map-app links remain as fallback |
| Separate API host / CORS | `VITE_API_ROOT` (all 13 `/api` calls go through `src/lib/api.js`), `CORS_ORIGINS`, `netlify.toml` |
| Admin e-mail env names | `ADMIN_EMAILS` / `VITE_ADMIN_EMAILS` accepted alongside `*_ADMIN_GMAIL` (merged, de-duplicated) |

## Deliberately NOT merged (B's version was better, or A's was dead code)

- A's Home hero/welcome overlay, rolling numbers, back-to-top, fly-to-cart, image cut-out — B has richer equivalents.
- A's search (`lib/search.js`) — B's `shared/core/matching.js` has the same typo/phonetic handling plus synonyms and brand aliases.
- A's local-storage product CRUD admin — replaced by B's MongoDB admin.
- A's cart — B's has promos, stock, store plans and the cheapest-mix ladder.
- A's `server/auth.js` (JWT/bcrypt accounts, `MongoAuthContext`): never wired into A's UI; sign-in is Supabase everywhere.
- Admin-pinned "deal" product flag: Deals are computed instead (would need schema changes across 6 files for little gain).
- Dependencies: no new packages were needed; `package.json`/lockfile dependencies are unchanged from B.

## Bugs found and fixed while merging

- **Product descriptions were never translated** (B looked up `prod.<slug>.description`, keys are `.desc`). Fixed; also a renamed product no longer shows a stale translation.
- `common.close` and `p.viewImage` were used but undefined in every language. Added.
- A's basket limit blocked *reducing* an over-limit basket (e.g. after Plus expired). Reducing is now always allowed.
- Account → Preferences showed "Русский" for any non-Uzbek language; now names all three.
- Strings that said "Uzbek and Russian only" updated for three languages.
- Route popup privacy text updated (it used to promise nothing leaves the device; the branch lookup now queries OpenStreetMap).

## Verification performed

- `npm test`: core, adapters, auth, ingest, **plus (new)**, **nearby (new)**, admin, admin routes, **Plus + logo routes (new)** — all pass except `contact.test.js`, which needs the `express` package (not installable in the sandbox used for the merge; it fails identically on the unmodified source).
- `npm run check:i18n`: 0 missing keys in uz, ru, en; placeholder parity checked for every key.
- The whole frontend bundles cleanly with esbuild (imports/exports resolve) and a TypeScript JS-check found no undefined names.
- **Not done here:** `npm install` / `vite build` / running against real Supabase + MongoDB (no network in the sandbox). Please run `npm install && npm run build && npm test` once on your machine.
