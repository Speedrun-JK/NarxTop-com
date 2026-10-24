# v92 implementation notes

- Added a MongoDB-backed staff chat at `/chat` for CEO, superadmins, admins, and workers. It uses WebSockets for live text updates and supports emoji, image uploads, pasted images, message timestamps, self-delete, and executive history/member controls.
- Added the `superadmin` role, with server-side permissions across admin areas. Only the CEO can remove a superadmin or manage the CEO identity. Kicking someone from chat does not change their staff role.
- Staff console URLs use the signed-in account ID (`/admin-<id>`); the path is stored in MongoDB and is checked against the authenticated account.
- Enabled WebSocket forwarding through Vite's local API proxy, routed `/admin-<id>` through the SPA fallback, and removed kicked users from every active chat sidebar. Executives can restore them from the separate removed-members list.
- Reworked Security password changes into a current-password/recovery-code flow and added device/session details, revoke controls, and optional browser location capture for the current session.
- Improved Plus gift input limits and prevented duplicate gift issuance under concurrent requests. Added Products and staff-chat styling, mobile layouts, role themes, and low-power motion/blur reductions.
- Show chat members’ saved profile photos, with initials when no photo is set, and show online or relative last-active labels using the site-wide session heartbeat.
- Applied the supplied dark and light mountain backgrounds to chat. CEO and superadmins can open a member profile by clicking a name or avatar; the profile endpoint enforces the same role restriction.
- Reduced navbar height, logo and label sizes while keeping its existing visual treatment. Portaled confirmation and logout overlays to the document body and raised their stacking order so they display and remain interactive above the page.

Browser location is requested while the Security page loads when the current session has no saved location. Browser and operating-system details are shown as the device label; browsers do not expose a computer's private hostname to websites.
