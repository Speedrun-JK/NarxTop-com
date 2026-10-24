# v106 changes

- **/products crash**: `CategorySidebar.jsx` now destructures `t` from `useLang()`.
- **Chat alignment**: own long messages no longer sit left of short ones (`styles/chat-v106.css`).
- **Microphone**: `/chat` asks for mic permission on every load (phone + PC); banner with "Allow" if dismissed, how-to if blocked.
  `server/index.js` Permissions-Policy changed to `microphone=(self)` (it was blocking the mic entirely).
- **Stickers**: press & hold = big preview until release (slide to switch), tap = send (`StickerPicker` in `StaffChat.jsx`).
- **Phone gate**: signed-in users without a valid phone see only a popup (`components/auth/PhoneGate.jsx`);
  saved via `PUT /api/auth/phone` into MongoDB `users.phone`. Profile can no longer clear the phone.
- **Chat background**: URL works without http(s), Ctrl+V of an image, file picker.
- **Mobile navbar**: language switch moved into the burger menu; favourites added there (`navbar-v106.css`, `Navbar.jsx`).
- Translations: `shared/translations.v106.js` (uz/ru/en).

Run `npm install && npm run build` before deploying — these changes were checked with a syntax pass, unit tests and
browser renders of the CSS, but not with a full app build.
