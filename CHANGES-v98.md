# v98 — remove SMS phone verification

- Removed the phone verification screen, SMS code flow, and phone-required gate from signup and authenticated app access.
- Removed the server SMS verification routes and configuration. Signup and account sessions no longer depend on phone verification.
- Kept email confirmation links and email password recovery. Phone numbers remain available as optional profile information.
- Updated setup guides and the environment example for the current authentication flow.
