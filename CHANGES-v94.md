# v94 — cursor, chat layout, settings, and read receipts

- Added light and dark custom pointer assets for desktop fine-pointer devices. Link and button cursors follow the active theme; text fields, resize controls, and drag states retain their native cursor behavior.
- Fixed incoming message grouping so the sender avatar sits beside the final message in a group and preceding rows reserve the same avatar gutter. Removed the extra continuation offset that made grouped bubbles drift horizontally, including on mobile.
- Connected chat background presets and validated custom image URLs to the actual message-list surface. Failed saved image URLs fall back to the theme default. Text size, spacing, Enter-to-send, and the remaining display settings stay scoped to the signed-in user's browser storage.
- Added message-level Seen by: visible incoming messages are marked read only while the tab is visible, focused, and connected; live receipt updates go to the sender; only the sender can request the reader list, which includes member identity and read time.

## Verification

- `npm run build` — passed.
- `npm run check:i18n` — passed with zero missing keys.
- Modified-file ESLint — passed.
- Chat settings are persisted per user in that browser's local storage; they are not synchronized between devices.
