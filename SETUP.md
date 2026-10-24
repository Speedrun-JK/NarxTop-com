# NarxTop — setup guide

## 1. Install and run

```bash
npm install
cp .env.example .env.local     # fill in your MongoDB, Google OAuth and SMTP values
npm run server                 # terminal 1 → NarxTop API + MongoDB (port 5000)
npm run dev                    # terminal 2 → website (http://127.0.0.1:5173)
```

Open **http://127.0.0.1:5173**. No Supabase project or Supabase keys are used by this build.

## 2. NarxTop authentication

Google authenticates Google accounts directly. NarxTop verifies the returned Google profile, creates or links a user in
MongoDB, and issues its own HttpOnly session cookie. Email/password signup sends an email confirmation link through
SMTP. Phone numbers are optional profile information and do not require SMS verification.

The confirmation email is sent by the NarxTop server, not Supabase. Local development can print the one-time email link
or recovery code to the server terminal when SMTP is not configured (`EMAIL_DEV_LOG_LINKS=true`). Production requires working SMTP.

## 3. Google OAuth setup

1. In Google Cloud Console, configure the OAuth consent screen and create a **Web application** OAuth client.
2. Add your app origin under **Authorized JavaScript origins**. For local development use `http://127.0.0.1:5173`.
3. Add this exact **Authorized redirect URI**: `http://127.0.0.1:5173/api/auth/google/callback`.
4. Put the Client ID and Client Secret in `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`.
5. Set `GOOGLE_REDIRECT_URI` to that exact callback URL and `FRONTEND_URL=http://127.0.0.1:5173`.

For production, replace the local origin with your public HTTPS site URL. The Google redirect URI must point directly to
NarxTop's `/api/auth/google/callback` endpoint; it must not point to a Supabase callback. In Google Cloud Console and
`.env.local`, the redirect URI must match exactly.

## 4. Email confirmation and password recovery

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `EMAIL_FROM`. The same SMTP settings can
also send Contact form messages; set `CONTACT_TO` for the destination inbox. For Gmail, use an App Password rather
than your normal account password. Confirmation links expire after 24 hours. Password reset uses a six-digit email code
that expires after 15 minutes and locks after five incorrect attempts.

Generate a long random value for `AUTH_SESSION_SECRET` and keep it on the server only. Never prefix Google Client Secret
or `AUTH_SESSION_SECRET` with `VITE_`; browser code must not receive these secrets.

## 5. Production cookies and separate frontend hosting

When NarxTop serves the frontend and API from one HTTPS domain, set `FRONTEND_URL` and `GOOGLE_REDIRECT_URI` to that
domain and leave `AUTH_COOKIE_SAME_SITE=Lax`. If the API is on a different site, set `AUTH_COOKIE_SAME_SITE=None`,
serve the API over HTTPS, set `CORS_ORIGINS` to the frontend origin, and build the frontend with
`VITE_API_ROOT=https://your-api-host/api`. The browser client sends the session cookie with API calls.
When deploying behind a trusted proxy, set `TRUST_PROXY` as appropriate for the host. Device settings can show a coarse
city/country when the proxy supplies geolocation headers; otherwise they show that location is unavailable.

## 6. Languages in MongoDB

On start, `server/index.js` copies every text from `shared/translations.js` into the
`translations` collection (one document per language: `uz`, `ru`, `en`). The website loads
them from `GET /api/translations/:lang`. To change a text without redeploying, edit it
in MongoDB (keys use `|` instead of `.`, e.g. `nav|home`) — note that the next server
start re-seeds keys that exist in `shared/translations.js`, so edit that file too for
permanent changes.

## 7. Notes

- Guests (not signed in) see a "register to continue" card instead of products,
  product pages, cart and search.
- Cart is saved per user in the browser (`localStorage`).
- NarxTop owns the account/session layer. Google verifies Google identities; the server stores NarxTop users and
  email/password confirmation tokens in MongoDB.

---

# NarxTop platform — added in the full upgrade

## User accounts and private data (MongoDB)

NarxTop stores accounts, email verification/reset tokens, and account state in MongoDB. The API checks the signed
NarxTop session cookie before reading or changing private account data. `user_state` and `avatars` are MongoDB
collections; indexes are created automatically on server start. Existing Supabase account records or `user_state`
rows are not copied automatically. Existing users can sign in with Google using the same verified email address;
email/password users need to create a new NarxTop password and confirm their email.

## 5. Real product data (supermarket adapters)
```
partner API → adapter (shared/adapters) → normalization → canonical product → MongoDB (products, offers, price_history, stores)
```
1. Set `KORZINKA_API_URL` / `HAVAS_API_URL` / `MAKRO_API_URL` (+ key) in `.env.local`.
2. Map the partner's field names with `*_PRODUCT_MAP` / `*_STORE_MAP` (JSON, dotted paths). Defaults are
   `id, name, price, old_price, in_stock, stock, store_id, unit, image, category, barcode, promos, updated_at`.
   Required per product: id, name, price > 0 and an `updated_at` timestamp — rows without them are **rejected, never repaired**.
3. Ingest: `INGEST_INTERVAL_MINUTES=30` or `curl -X POST -H "x-ingest-token: …" http://127.0.0.1:5000/api/ingest/korzinka`.
   The response lists matched / created / rejected counts and rejection reasons. Ambiguous matches go to `match_review`.
4. Promotions (`promos`) must be `{type:"multibuy",minQty,unitPrice}`, `{type:"percent",minQty,percent}`,
   `{type:"bundle",qty,price}` or `{type:"amount",minQty,off}`.
5. Store records need `lat`/`lng`; branches without coordinates are ignored by the map and nearest-store logic.
6. To support another supermarket add one line to `PARTNERS` in `shared/adapters/index.js` (or write a custom adapter implementing the interface documented in `shared/adapters/base.js`).

Without a configured adapter the site shows an error state in production. In development it falls back to the
bundled demo file and shows a **demo data** banner (`VITE_ALLOW_FIXTURE`).

## 6. Maps and routes
Set a routing provider in `.env.local` (see `.env.example`): OSRM-compatible servers or OpenRouteService.
Travel times, route alternatives (fastest / shortest / alternative, up to 5) and route-aware Smart Basket
all come from that provider. **Public transport is not offered** by OSRM/ORS, so it is shown as unavailable.
No provider → distances/times are simply not shown; nothing is estimated. User location stays in the browser tab
(sessionStorage) and is never sent to the server.

## 7. Intelligence & tests
Pure logic lives in `shared/core` (search/matching, units, promotions, optimizer, price intelligence,
recommendations, analytics, geo) and is covered by `npm test`. `npm run check:i18n` verifies that every
text key used in the UI exists in Uzbek and Russian.

## 8. Not implemented (extension points only)
Receipt OCR, receipt-to-cart matching, recipe-to-basket, AI assistant, nutrition-aware optimization, e-mail/push
delivery of alerts (alerts are in-app), global co-purchase mining from other users' baskets,
inflation analytics. Hook points: `shared/core/analytics.js` (purchase log schema), `shared/adapters` (data in),
`user_state.purchases` (receipts would write here).

## 5. Profile photos in MongoDB

Photos are saved in MongoDB's `avatars` collection (one document per user, `_id` = NarxTop user id) by
`server/avatar.js` — `GET/PUT/DELETE /api/avatar`, authenticated with the NarxTop session cookie. The browser resizes
photos to 256 px before upload.


## Contact page and e-mail

`/contact` (button in the footer, also in the phone menu) works for guests and signed-in users.
Signed-in users send only the message; their name and e-mail come from the verified account.
Guests type a name and e-mail. Each message is saved in MongoDB (`contact_messages`) and e-mailed
to the admin with Reply-To set to the sender, so **Reply** in Gmail answers the user.

1. Add `SMTP_USER`, `SMTP_PASS` (Gmail App Password), and `CONTACT_TO` to `.env.local` (see `.env.example`).
3. Restart `npm run server`. The log says whether e-mail is enabled.

Texts live in `shared/translations.contact.js`. Phone styles live in `src/styles/mobile.css`.

## Admin panel (/admin)

1. In **`.env.local`** add your Gmail (several: separate with commas):
   ```
   ADMIN_GMAIL=you@gmail.com
   VITE_ADMIN_GMAIL=you@gmail.com
   ```
   (`ADMIN_EMAILS` can contain several comma-separated addresses. The `VITE_` value is used only for the browser UI.)
   Restart `npm run dev` and `npm run server` after changing it. Sign in to the site with that Gmail →
   an **Admin** link appears in the navbar. The configured account is the primary admin; only it can grant or revoke
   admin access from **Adminlar**. Granted users see the same navbar link and can manage the other admin sections.
   Every `/api/admin/*` request is checked on the server and the user's e-mail must be confirmed. Delegated roles are
   stored on the MongoDB `users` record (`isAdmin`) and can only be changed by the primary admin.
2. **Products → MongoDB.** On the first server start, if the `products` collection is empty,
   `src/data/products.json` is imported automatically. You can also run `npm run seed`
   (adds only what is missing) or `npm run seed -- --force` (refreshes everything in the file),
   or press **products.json import** in the panel. After that the website reads products from MongoDB only.
3. In the panel you can add / edit / delete products and their store prices. Changes are written to MongoDB
   (`products`, `offers`, `price_history`) and show up on the public site immediately.
   Prices that come from supermarket APIs (ingestion) are shown with a lock and are not edited by hand.
4. **Users**: NarxTop creates MongoDB user records during Google sign-in or email/password signup. Accounts from an old
   Supabase project are not imported by this build. A Google user can sign in with the same verified email; an old
   email/password account must be registered again and set a new NarxTop password.

### Admin panel — what's new (v3)

Sections (sidebar, or the top bar on phones): **Boshqaruv** (dashboard), **Mahsulotlar**, **Foydalanuvchilar**,
**Xabarlar** (contact-form inbox), **Faollik** (who changed what), **Sozlamalar**.

- **Products**: search, category/sort/stock filters, list or card view, select several → change category, mark in/out of stock,
  delete; duplicate a product; open it on the site; CSV export; editor with live card preview, price history, `Ctrl+S` to save.
- **Image check**: *Rasmlarni tekshirish* makes the **server** test every product image address and lets you blank the dead ones.
  A dead image URL is what shows up as `404` in the browser console (the browser always logs failed image loads itself),
  so clearing/replacing those addresses is the real fix. Settings → *Ro‘yxatlarda rasmlarni yuklash* can also turn remote thumbnails off.
- **Messages**: read/unread, reply by e-mail, delete, CSV export, unread badge in the sidebar.
- **Look & feel** (Settings): light/dark, 6 accent colours, corner style, density, list/card view, compact sidebar, animations on/off.
  Stored in this browser only (`narxtop_admin_prefs`).
- **Shortcuts**: `N` new product · `/` search · `1`–`6` switch section · `Esc` close.

**404s / "Server eski versiyada"**: after updating the code, **restart `npm run server`**. The panel compares its API version with
`/api/health` and shows a banner (and a status light in the sidebar) when the server is not running, is outdated, or MongoDB is down.
Unknown `/api/*` paths now answer JSON instead of an HTML error page.

Tests: `npm test` (includes `server/__tests__/adminRoutes.test.js`, which runs every admin route against an in-memory database).

---

# Merged build — NarxTop Plus, quick-view, store logos, English

## NarxTop Plus (`/plus`, admin → Plus)

- **Free plan:** a basket may cost at most **1 000 000 UZS** (the cheapest complete single-store total, promos and stock
  honoured). Reducing an already-over-limit basket is always allowed. When the limit blocks an add, a notice with a link to
  `/plus` appears. **Plus** removes the limit.
- **Launch trial:** 2 months per account, once (enforced atomically by a unique index on `plus_subscriptions.userId`), no card,
  no auto-renewal. Each covered month gets a randomly chosen supermarket gift record (Korzinka / Makro / Havas).
- **Checkout is deliberately closed** (`POST /api/plus/checkout` → 503) until a Click merchant account exists. When you
  connect Click, implement the payment inside `server/plus.js` and flip `paymentsReady` there.
- **Admin → Plus:** set the monthly price/description/benefits, gift days or months to any user (stacks on active access),
  hand out gift cards (mark as issued), see all members. Everything is written to the admin activity log.
- Collections: `plus_subscriptions`, `plus_settings`, `plus_gift_events` (indexes are created on server start).
- Server routes: see the header of `server/plus.js`. Business rules are pure functions in `shared/core/plus.js` (unit-tested).

## Store logos (admin → Sozlamalar → Do‘kon logotiplari)

Upload a logo per supermarket; it is shrunk in the browser (≤160 px), stored in MongoDB (`store_logos`) and shown to
**every visitor** next to prices and in the cart. Files in `src/assets/stores/` still work as the fallback.

## Product quick-view

Clicking a product card opens a pop-up over the current page (Back closes it; Ctrl/⌘-click or a pasted link opens the full
page). Guests keep normal navigation. Implemented as a "modal route" (`location.state.backgroundLocation`).

## Nearest branches in the route popup

After the browser gives a position, `src/lib/nearby.js` asks the free **OpenStreetMap Overpass** API for the nearest branches
of that chain (≤30 km) and offers direct directions to each. Only the rounded search area is sent to Overpass; nothing is stored.
If Overpass is unreachable the popup falls back to the four map-app links.

## English

`shared/translations.en.*.js` (all ~750 keys). `npm run check:i18n` verifies every key used in the UI exists in **uz, ru and en**.
Russian/English product names live in `shared/translations.js` / `translations.plus.js` (`prod.<slug>.name|desc`); a product an
admin has renamed shows the admin's text, not a stale translation.

## Hosting the site and API separately

Default: one Node server serves `dist/` and `/api` (see section 1). To put the site on Netlify instead: build with
`VITE_API_ROOT=https://your-api-host/api`, set `CORS_ORIGINS=https://your-site.netlify.app` on the API, and use `netlify.toml`.

## 6. Product description translations
Admins write a product description in Uzbek. When the product is saved the server generates Uzbek / Russian / English
versions and stores them with the product in MongoDB (`products.descriptionI18n = { uz, ru, en }`).
- Optional `GOOGLE_TRANSLATE_API_KEY` — use the Google Cloud Translation API. Without it the keyless Google endpoint is used.
- `DESCRIPTION_TRANSLATE=off` — store Uzbek only (no outbound translation requests).
- `DESCRIPTION_BACKFILL=false` — skip the background pass at server start that translates existing products with missing ru/en text.
A failed translation never blocks saving; the Uzbek text is shown until the missing language is filled in.
Site-wide UI translations (`shared/translations*.js`) are not affected.

