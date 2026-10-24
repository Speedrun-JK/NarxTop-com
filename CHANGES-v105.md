# v105 — chat: stickers, picker, message spacing

## Root causes (why v101 / v104 did not fix it)
1. **Messages collapsing / overlapping** — `.stc-messages` is a scrolling flex column, so each message row was allowed to
   *shrink* once the list overflowed. Sticker boxes also sized themselves with `height:100%` inside `height:auto` parents,
   so their measured height collapsed while the image still painted at full size, on top of the next message.
2. **Picker looked broken** — same fault in the grid (cells overlapping), plus the popup was anchored to the textarea with
   `right:-156px / -139px` hacks spread over three CSS files.

## Changes
- **New `src/styles/chat-v105.css`** (imported last). `chat-polish-v104.css` removed; the stale sticker/picker rules were
  deleted from `site-v101.css` instead of being overridden again.
- **Messages**: rows are `flex: 0 0 auto` (never shrink). Spacing is margin-based: 3px inside a group, 12px between groups
  (7px / 2px in "compact" spacing). Sticker messages get their own 8px breathing room.
- **Stickers**: 148px on desktop, 132px ≤760px, 124px ≤430px (was 216–232px). Fixed square box, image `contain`ed,
  no bubble, Telegram-style translucent time/read pill on the corner. Tapping a sticker no longer opens it in a new tab.
  A sticker sent as a reply keeps a normal bubble so the quote is still visible.
- **Sticker picker**: rebuilt. 4-column grid of true square cells (explicit `min-content` rows + square spacer, so the
  cells can no longer collapse), header with close button, themed for light/dark, anchored to the composer so it sits
  above the input on every screen size (full-width sheet on phones), pop-in animation, hover/focus/press states.
- **Emoji picker**: same shell/theme so both popups match; 8 equal columns.
- **Behaviour**: `Escape` or a click outside closes either picker.
- Respects `prefers-reduced-motion` and the existing `data-performance="low"` mode.

## Files touched
`src/styles/chat-v105.css` (new) · `src/styles/site-v101.css` (sticker rules removed) · `src/styles/chat-polish-v104.css` (deleted)
· `src/bootstrap.jsx` (import) · `src/pages/StaffChat.jsx` (picker header/close, Esc + outside click, sticker element, reply-sticker rule)

## Verification
Layout was reproduced and verified in headless Chromium against the project's real stylesheet stack (dark + light,
1280 / 390 / 320px): zero overlapping messages, zero overlapping picker cells, sticker box = 148 / 124px as specified.
The modified JSX files parse cleanly. A full `npm run build` was not run in my environment (no network for `npm install`) —
please run `npm install && npm run build` once on your side.
