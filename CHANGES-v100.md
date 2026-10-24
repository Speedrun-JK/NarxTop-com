# NARXTOP v100 — Chat and store usability polish

- Chat message bubbles now size to their contents and wrap long text at a readable maximum width. Reply excerpts are whitespace-normalized and shortened, including replies to image-only messages.
- The staff chat navbar link shows a circular unread message count. The server exposes a staff-authorized count endpoint; the navbar refreshes it on route changes, focus, visibility changes, and a 30-second interval.
- Staff navigation access is cached in memory between route-level navbar mounts, preventing the Admin and Chat links from disappearing during a fresh access check. Server authorization remains authoritative.
- Product search now aligns with the category panel and uses one focus treatment. Control and icon hit areas remain stable across language changes.
- Product preview, product cards, and cart surfaces use fewer borders, flatter surfaces, consistent corner radii, and less motion decoration. The cart list uses normal page flow with a sticky desktop summary.
- The footer is shorter and follows the selected light/dark theme. Ambient leaf illustrations, background dot patterns, animated card edges, and the large decorative footer wordmark were removed from the main layout.

## Verification

- `npm run build` — passed.
- ESLint on the changed JavaScript files — passed.
