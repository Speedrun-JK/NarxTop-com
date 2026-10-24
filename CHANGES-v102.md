# NARXTOP v102 — Stickers, cursors, and smoother chat

- Added 28 individual transparent NARXTOP stickers from the supplied sticker sheets. The sticker picker sits beside emoji, and selecting a sticker sends it as a large standalone chat image. Added Uzbek, Russian, and English labels.
- Added theme-aware hand cursors for clickable controls and a compressed hand cursor while a button is pressed. Text entry and touch devices keep their native cursors.
- Reduced reply previews to 22 characters and capped message bubbles at 440 px on desktop, with responsive limits for smaller screens.
- Chat attachment downloads now begin near the visible area, and audio metadata waits until needed. Read receipts use one shared visibility observer instead of scanning every message during each scroll event.
- Low-power devices now reduce chat shadows/background paint and use instant auto-scroll. Device capability and small-screen status update when the viewport or data-saver setting changes.
- Added a consistent, subtle pressed state to site-wide buttons.

## Verification

- `npm run build` — passed.
- ESLint on `src/pages/StaffChat.jsx` and `src/context/MotionPrefsContext.jsx` — passed.
