# Narx.top — Windows desktop app (.exe)

The website is unchanged. The desktop app is an extra target that lives in `electron/` and `build/`.

## Route path (how a request travels inside the .exe)
- Window loads `app://narx.top/` -> `electron/main.cjs` serves files from `dist/` (the normal `vite build`).
- Any URL that is not a real file (`/products`, `/account`, `/admin` ...) returns `dist/index.html`, so React Router (BrowserRouter) works unchanged.
- Any `/api/...` request is forwarded to the live backend (`electron/config.cjs` -> `apiOrigin`, or env `NARX_API_ORIGIN`). Prices are never stored in the .exe; login cookies stay in the app's own cookie jar.
- Links to other websites open in the user's normal browser.

## Window behaviour
- Starts in full screen (like F11). **Esc** leaves full screen (the app stays open). **F11** toggles it. After leaving full screen the window is maximised.
- Close with the X button / Alt+F4.

## Commands (run on Windows)
    npm install
    npm run electron:dev        # Vite + desktop window (hot reload)
    npm run electron:start      # build site, open desktop window from dist/
    npm run electron:installer  # release/Narx.top-Setup-<version>.exe
    npm run electron:portable   # release/Narx.top-Portable-<version>.exe
    npm run electron:build      # both
    npm run electron:dir        # unpacked folder release/win-unpacked/ (for quick testing)
The website still uses `npm run dev` / `npm run build` exactly as before.

## Before you ship
- Check `apiOrigin` in `electron/config.cjs` is https://www.narx.top (narx.top also works).
- Unsigned installers show a Windows SmartScreen warning; a code-signing certificate removes it.
