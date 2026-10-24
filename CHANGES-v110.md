# v110 changes

**Theme** – Settings > Theme now has System / Light / Dark. "System" follows the phone or PC live (matchMedia). Also in the burger menu and admin settings.
**Navbar** – rectangular bar (no pill ends), logo glow, gold crown halo, chat icon replaced (`chat` icon). Styles: `src/styles/navbar-v110.css`.
**Burger menu (phone)** – sheet is `position: fixed`, placed under the bar from JS (`--nt-menu-top`), above sticky content; no blur on the bar while open. Switching theme/language/motion no longer closes it.
**Team chat** – side gaps, separate sidebar/conversation cards, light theme like the reference, Telegram-style panel (Emoji | Stickers) opened by one smile button, 3 packs (NarxTop 28, NarxTop Team 25, NarxTop Mood 14) with pack names + pack strip. New files `public/stickers/narxtop-b01..b25`, `narxtop-c01..c14`. Styles: `chat-v110.css`.
**Phone product page** – `MobileProductView.jsx` (<= 640px only). Desktop unchanged.
**Home** – desktop shows 4 cards; phone carousel shows 2 side by side.
**/products** – category tiles restyled (`pages-v110.css`).
**Admin** – category picker rebuilt as icon chips; new-product draft autosaves to localStorage until saved or cleared.
**Smart Buy** – budget accepts any amount (`step="any"`; the old `step=1000` + `min=1` forced 25001), "which item" input removed, only one meal period selectable.

Not run here: `npm install` / build / tests (no network). Please run `npm run build` and test on a phone.
