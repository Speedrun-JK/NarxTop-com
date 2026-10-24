# v97 — make server environment loading unambiguous

- The backend now reads `.env.local` and `.env` from the project root based on the server file location, even if `npm run server` is launched with another current directory.
- Restart the backend after changing project-root environment values so they are loaded by the server.
