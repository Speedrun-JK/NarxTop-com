# v111 changes

**Carousels** – every auto-advancing carousel now moves every 3 seconds (`SavingsCarousel.jsx`, `DailyPicks.jsx`; the dot progress animation follows).
**Theme** – default is now System (`ThemeContext.jsx` + the pre-paint script in `index.html`). Browsers that already saved "dark" keep it until the user picks System once.
**/chat navbar** – on `/chat` the navbar gets `is-chat-route`: full width, white, same colour as the chat (dark theme keeps a dark neutral). Every other page keeps the classic bar. (`Navbar.jsx`, `v111.css`)
**/chat styles** – white page and panels, stronger borders on sidebar, header, members, bubbles, composer, tools, badges, send button (light theme). Message area stays pale blue-grey like the reference.
**Voice messages** – Telegram-style bubble in `StaffChat.jsx` (`ChatAudio`): round play button, waveform drawn from the real audio and resampled to 44 bars (same width/height for 5 s or 5 min), click the wave to seek, shows `00:24, 492.1 KB` (KB/MB), one message plays at a time. No transcribe button.
**Admin add product** – category block is collapsible (chevron, closed by default, opens by itself if you save without a category). "SmartBuy AI ovqat vaqti" is now a multi-select (`mealTypes`). Server stores `mealTypes` and still fills `mealType` with the first one; old products keep working. Smart Buy matches on either.
**/products sidebar** – list styled like the reference: round "all" icon + wide pill, big tinted icon tiles, count badges, chevrons, chosen row = dark brown pill. Phones keep the pill row.
**Phone product preview** – `<= 640px` only: opens full screen (slides up), top half = product photo, bottom half = cream sheet (category, name, unit/stores, lowest price, prices at a glance, wide green add-to-cart). The store / "% cheaper" / "cheapest" chips on the photo are removed.

Not run here: `npm install` / build (no network). Run `npm run build` and test on a phone. Server tests: `server/__tests__/admin.test.js` passes (new meal-times test included).
