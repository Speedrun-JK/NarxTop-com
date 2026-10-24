# v93 chat and mobile polish

- Added per-user chat display preferences for text size, spacing, enter-to-send, and validated custom or preset backgrounds.
- Added grouped chat messages, typing indicators, reply previews and navigation, group read receipts, audio recording/playback, and a new-messages control when reading older messages.
- Improved attachment validation and chat API support for replies, audio, typing, and read receipts.
- Refined mobile navigation behavior, dark select/action-menu styling, chat visual states, and reduced-motion support.
- Fixed the missing product description translation helper import used by admin product create/edit flows.
- Added English, Russian, and Uzbek chat strings and chat attachment/receipt unit coverage.

The build succeeds and the chat-specific lint, i18n check, and chat tests pass. The full existing suite previously reported five failures in unrelated admin/Plus expectations.
- Added drag-and-drop image attachment previews with image-only validation and a four-image per-message limit.
