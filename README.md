# NarxTop

Supermarket price comparison for Uzbekistan — compare Korzinka, Makro, Havas and more, build a basket, find the cheapest
store and the nearest branch.

This repository is the **merge** of two earlier builds: the design, routing, catalogue, admin panel and tests of
*narxinitope-fixed* with the features that only *NarxTop-complete-source* had (NarxTop Plus, quick-view, store logos,
English, privacy/terms, nearest-branch lookup). See **MERGE_NOTES.md** for exactly what came from where.

## Highlights

- **Compare** every store's price per product, with promos, stock, unit prices, price history and "price drop" signals.
- **Smart search** — typo-tolerant, Latin/Cyrillic, synonyms ("eng arzon kola"), with ten recent searches cached locally and synced to MongoDB for accounts or guest sessions.
- **Basket** — cheapest single store vs. cheapest mix, per-store plan, promos applied, purchase history.
- **Biggest savings** on the home page; desktop product cards have a **quick-view pop-up**, while mobile taps open the product page.
- **NarxTop Plus** — lifts the free 1 000 000 UZS basket limit; free 2-month launch trial; monthly supermarket gifts; admins can find users by email or username and revoke access.
- **Route popup** — nearest real branches (OpenStreetMap) with direct directions in Google / Yandex / 2GIS / Waze.
- **Three languages** — O‘zbekcha, Русский, English.
- **Accounts** (NarxTop sessions + MongoDB): Google OAuth, email verification, six-digit email password recovery, device/session list with individual sign-out, favourites, price alerts, profile photo and data export/delete.
- **Admin panel** (`/admin`): products & prices, users, messages, activity log, **Plus** (plan, gifting, gift cards),
  store logos, appearance settings, clipboard image paste in product editing and a shopper leaderboard ranked by three-store coverage and total purchases.

The manual Biggest Sale management tab is disabled. Existing public sale assignments remain readable and unchanged.

## Quick start

```bash
npm install
cp .env.example .env.local      # fill in Google OAuth, SMTP + MongoDB values
npm run server                  # API on :5000   (terminal 1)
npm run dev                     # website on :5173 (terminal 2)
```

Setup: **SETUP-UZ.md** (Uzbek) and **SETUP.md** (English), including Google callback, SMTP email confirmation, admin access, Plus, and hosting.

## Scripts

| command | what it does |
|---|---|
| `npm run dev` / `npm run build` | Vite dev server / production build into `dist/` |
| `npm run server` | Express API (also serves `dist/` in production) |
| `npm run seed` | import `src/data/products.json` into MongoDB (`-- --force` refreshes) |
| `npm test` | unit + route tests (core logic, adapters, auth, ingest, Plus, nearby, admin routes) |
| `npm run check:i18n` | every translation key used in the UI exists in uz, ru **and** en |

## Layout

```
server/   Express API: catalogue, admin, Plus, store logos, contact, avatar, ingest …
shared/   code used by BOTH server and browser: translations, core logic (matching, promos, price intel, Plus rules)
src/      React app: pages/, components/, context/, lib/, styles/ (the nt-* design system), data/
scripts/  seed, i18n/branch checks
```

Design system: tokens in `src/styles/tokens.css`; new feature styles are in `plus.css` and `extras.css` and use only those tokens.
