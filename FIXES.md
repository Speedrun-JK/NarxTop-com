# What was fixed

## Shop logic
- **Cart**: quantities are validated (1–99, whole numbers) everywhere, corrupt saved carts are cleaned on load,
  a guest cart is **merged into the account cart on login** (it used to be left behind), open tabs stay in sync.
- **"Sotib oldim / Я купил(а)" button** in the cart records a real shopping trip. Before, nothing ever wrote
  purchases, so "bought together" suggestions could never work.
- **Catalog**: a failed refresh no longer replaces the whole product list with an error page; the catalog is
  re-fetched when you return to the tab after 5 minutes or the network comes back; products without a usable
  price are dropped instead of crashing cards / product page / search.
- **Search & recommendations**: "cheapest" and unit prices ignore out-of-stock offers; search dropdown shows the
  real best in-stock price; a promo bundle with qty 0 no longer divides by zero.
- **Favourites / price alerts**: the sync no longer restarts on every token refresh (it could drop unsaved changes),
  failed saves are retried (on reconnect and after 15 s), malformed remote rows are ignored, alerts are not created
  for products that are out of stock everywhere.

## Auth & account
- Reset-password no longer flashes "link expired" right after a successful change.
- Resend-confirmation errors are translated; redirect timers are cleaned up.
- Account export no longer cancels its own download; deleting an account now also removes the photo and user
  record stored in MongoDB.
- A missing `.env.local` shows a readable message instead of a blank page. `.env.example` (referenced by the
  setup guide but missing from the zip) is included.

## UI
- Confirm / cheapest-plan dialogs no longer steal focus on every re-render and give focus back when closed.
- Toasts are capped at 4; unused `effects.js` removed.

## Server
- **Security**: the image checker followed redirects blindly (a public URL could point the server at
  localhost / cloud metadata); every hop is now validated. Basic security headers, `x-powered-by` off.
- Emptying the catalog in the admin panel no longer makes it re-fill itself (seed runs once per database).
- API answers 503 while MongoDB is connecting, `/api/insights` is cached (it scanned 50k rows per request),
  rate-limit memory is bounded, bad event bodies give 400, ingest runs can't overlap, non-Latin product names
  get a valid slug, graceful shutdown, clear "port in use" message, hashed assets cached for a year.
- `TRUST_PROXY` env var for correct client IPs behind Render / Nginx.

## Tests
39 → 42 tests (SSRF redirects, seeding, in-stock cheapest). Run `npm install && npm test`.
