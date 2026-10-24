# NARXTOP v101 — Chat bubble width fix

- Long chat messages now have a hard 560 px desktop bubble cap (78vw on narrow screens) with explicit wrapping for long unbroken strings. Horizontal overflow is clipped from the message pane.
- Reply excerpts are shortened to at most 36 characters, including the composer preview.

## Verification

- `npm run build` — passed.
- ESLint on `src/pages/StaffChat.jsx` — passed.
