# v85
- Light theme banner: new photo (src/assets/hero/hero-light.jpg) + re-cut basket overlay (hero-light-fg.webp). Light --hb-r/--hb-shift updated in hero-v84.css (desktop layout otherwise unchanged).
- New navbar/footer/Plus logo mark (LogoMark in components/brand/Logo.jsx) + public/favicon.svg.
- Phone banner (<=767px) redesigned in src/styles/hero-v85.css (desktop/tablet untouched).
- Admin > Admin ruxsatlari: confirmation dialog before giving/removing Admin or Ishchi role; nicer rows (AdminsPanel.jsx, admin.css).

## v85b (banner part reverted in v85c: photo, brown tint and carousel colours are back to v85)
- White theme: new banner photo (1670x941) with a re-cut basket overlay; photo aspect ratio is now a per-theme CSS variable (--hb-ar / --hb-arn) in hero-v84.css. Dark theme is unchanged.
- White theme is less bright: light brown veil on the left of the banner, warm brown glass for the savings carousel card (hero-v85.css). Phone banner uses a warm cream-brown surface.
- Users page: permanent account deletion (DELETE /api/admin/users/:id). Needs the typed email/username + a checkbox; Super Admins and your own account are protected; only a Super Admin can delete an Admin. Removes the user, avatar, user_state, auth_tokens, receipts (+images), notifications, Plus subscription + gift events, search history and contact messages from MongoDB, and writes an admin_log entry (user.delete). Test added in server/__tests__/adminRoutes.test.js.
- Signed-out visitors: new banner buttons and a warmer guest showcase (src/styles/guest-v85.css).

## v85c
- Desktop, white theme only: very slight brown veil over the left + centre of the main banner (hero-v85.css, min-width 1101px). Nothing else on desktop changed.
- Phone main banner: taller photo band, bigger headline, glow on search, entrance animation, depth (hero-v85.css, max-width 767px).
- Phone navbar + burger menu redesigned (src/styles/nav-m85.css, max-width 860px only): glass bar with accent line, round glass buttons, glowing "Kirish", menu sheet with icon chips, matching profile dropdown.

## v85d
- Desktop white theme: the brown tint now sits on the photo layer (.hb-photo::after), replacing the white wash (the earlier .hb::after attempt was stretched/animated by finish.css and never showed).
- Phone navbar rebuilt theme-aware with --nm-* tokens: cream glass + dark brown text in the white theme, dark glass + light text in the dark theme (logo, buttons, menu sheet, dropdown all follow).
