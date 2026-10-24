/* Narx.top — Windows desktop shell (Electron main process).
 *
 * The React site is NOT changed: the packaged app serves the same Vite build (dist/) from a private
 * app://narx.top origin, so BrowserRouter routes, absolute asset paths (/favicon.svg, /stickers/...) and the
 * "/api/..." calls all behave exactly as they do on the website. "/api/*" is forwarded to the live backend, so
 * prices are always fresh and never baked into the .exe.
 *
 * Window behaviour:
 *   - starts in full screen (like F11)
 *   - Esc  -> leaves full screen (the window stays open, it does NOT close)
 *   - F11  -> toggles full screen
 */
const { app, BrowserWindow, Menu, protocol, net, shell, session, dialog } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs");
const crypto = require("node:crypto");

const config = require("./config.cjs");

const SCHEME = "app";
const APP_HOST = "narx.top";
const APP_ORIGIN = `${SCHEME}://${APP_HOST}`;
const DEV_URL = process.env.NARX_DEV_URL || ""; // e.g. http://127.0.0.1:5173 (npm run electron:dev)
const DIST_DIR = path.join(__dirname, "..", "dist");
const API_ORIGIN = String(process.env.NARX_API_ORIGIN || config.apiOrigin).replace(/\/+$/, "");

// Must run before app "ready": makes app:// behave like a normal secure https origin (cookies, fetch, history API).
protocol.registerSchemesAsPrivileged([
  { scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
]);

// Only one copy of the app at a time; a second launch just focuses the first window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
}

let mainWindow = null;

/* ------------------------- Google sign-in (system browser) -------------------------
 * Google does not allow sign-in inside an embedded window, and the server's callback would log in the *browser*,
 * not this app. So: open the real browser with a secret challenge -> server redirects to narxtop://auth?code=...
 * -> we swap code + secret verifier for a session cookie in THIS app's cookie jar, then reload. */
const PROTOCOL = "narxtop";
let pendingGoogle = null; // { verifier, at }

function startGoogleSignIn(next) {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  pendingGoogle = { verifier, at: Date.now() };
  const url = new URL(API_ORIGIN + "/api/auth/google");
  if (next && next.startsWith("/") && !next.startsWith("//")) url.searchParams.set("next", next);
  url.searchParams.set("desktop_challenge", challenge);
  shell.openExternal(url.toString());
}

async function handleDeepLink(raw) {
  let url;
  try { url = new URL(raw); } catch { return; }
  if (url.protocol !== `${PROTOCOL}:` || url.hostname !== "auth") return;
  const code = url.searchParams.get("code");
  const pending = pendingGoogle;
  pendingGoogle = null; // single use
  if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.focus(); }
  if (!code || !pending || Date.now() - pending.at > 10 * 60 * 1000) return;
  let target = "/auth?error=google";
  try {
    const response = await fetchApi("/api/auth/desktop-exchange", {
      method: "POST",
      headers: new Headers({ "content-type": "application/json" }),
      body: Buffer.from(JSON.stringify({ code, verifier: pending.verifier })),
    });
    const body = await response.json().catch(() => null);
    if (response.ok && body?.success) target = typeof body.next === "string" && body.next.startsWith("/") && !body.next.startsWith("//") ? body.next : "/";
  } catch (error) { console.error("[narx] desktop sign-in failed:", error.message); }
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(DEV_URL ? DEV_URL + target : APP_ORIGIN + target);
}

/* ----------------------------- app:// handler ----------------------------- */

const HOP_BY_HOP = new Set(["host", "origin", "referer", "cookie", "connection", "content-length", "accept-encoding"]);

const SITE_HOSTS = new Set(["narx.top", "www.narx.top"]); // redirects between these two are followed safely

/** Call the real backend. Redirects (e.g. narx.top <-> ye.narx.top, http -> https) are followed ONLY to our own
 *  hosts, and the method + body are kept (a plain fetch would turn a redirected POST into a GET). */
async function fetchApi(pathAndSearch, { method = "GET", headers = new Headers(), body } = {}) {
  let target = API_ORIGIN + pathAndSearch;
  for (let hop = 0; hop < 4; hop++) {
    const response = await net.fetch(target, {
      method, headers, body: body && body.length ? body : undefined,
      redirect: "manual", credentials: "include", bypassCustomProtocolHandlers: true,
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      let next;
      try { next = new URL(location, target); } catch { return response; }
      if (next.protocol === "https:" && SITE_HOSTS.has(next.hostname) || next.origin === new URL(API_ORIGIN).origin) { target = next.toString(); continue; }
    }
    return response;
  }
  return new Response(JSON.stringify({ success: false, code: "redirect_loop" }), { status: 508, headers: { "content-type": "application/json" } });
}

/** Forward /api/* to the real backend. Origin/Referer are dropped (the API only checks Origin when present) and
 *  the session cookie lives in Electron's own cookie jar for the API host, so login keeps working. */
async function proxyApi(request, url) {
  const headers = new Headers();
  for (const [key, value] of request.headers) {
    const k = key.toLowerCase();
    if (!HOP_BY_HOP.has(k) && !k.startsWith("sec-")) headers.set(key, value);
  }
  const hasBody = !["GET", "HEAD"].includes(request.method);
  try {
    const body = hasBody ? Buffer.from(await request.arrayBuffer()) : undefined;
    return await fetchApi(url.pathname + url.search, { method: request.method, headers, body });
  } catch (error) {
    // Offline / DNS / TLS failure: answer like a normal API error so the site shows its own error state.
    return new Response(JSON.stringify({ success: false, code: "offline", message: "Server bilan aloqa yo‘q." }), {
      status: 503,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  }
}

function resolveDistFile(pathname) {
  let rel;
  try { rel = decodeURIComponent(pathname); } catch { return null; }
  const file = path.normalize(path.join(DIST_DIR, rel));
  if (file !== DIST_DIR && !file.startsWith(DIST_DIR + path.sep)) return null; // path traversal guard
  return file;
}

function handleAppRequest(request) {
  const url = new URL(request.url);
  if (url.hostname !== APP_HOST) return new Response("Not found", { status: 404 });
  if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return proxyApi(request, url);

  const file = resolveDistFile(url.pathname === "/" ? "/index.html" : url.pathname);
  const isFile = file && fs.existsSync(file) && fs.statSync(file).isFile();
  // Real file -> serve it. Anything else (/products, /account, /admin ...) -> index.html so React Router takes over.
  const target = isFile ? file : path.join(DIST_DIR, "index.html");
  return net.fetch(pathToFileURL(target).toString(), { bypassCustomProtocolHandlers: true });
}

/* -------------------------------- window -------------------------------- */

function isInternalUrl(raw) {
  try {
    const u = new URL(raw);
    if (DEV_URL && u.origin === new URL(DEV_URL).origin) return true;
    return u.protocol === `${SCHEME}:` && u.hostname === APP_HOST;
  } catch { return false; }
}

function openExternalSafely(raw) {
  try {
    const u = new URL(raw);
    if (["https:", "http:", "mailto:", "tel:"].includes(u.protocol)) shell.openExternal(u.toString());
  } catch { /* ignore malformed URLs */ }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 860,
    minWidth: 360,
    minHeight: 560,
    show: false,
    fullscreen: true, // <- opens in full screen, like F11
    autoHideMenuBar: true,
    backgroundColor: "#0b0705",
    title: "Narx.top",
    icon: path.join(__dirname, "..", "build", "icon.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged,
    },
  });
  mainWindow = win;

  /* ---- full-screen controls ---- */
  let htmlFullscreen = false; // a page element (e.g. a video) went fullscreen via the web API; Chromium handles Esc itself
  win.webContents.on("enter-html-full-screen", () => { htmlFullscreen = true; });
  win.webContents.on("leave-html-full-screen", () => { htmlFullscreen = false; });

  win.webContents.on("before-input-event", (event, input) => {
    if (input.type !== "keyDown" || input.isAutoRepeat) return;
    if (input.key === "F11") {
      event.preventDefault();
      win.setFullScreen(!win.isFullScreen());
    } else if (input.key === "Escape" && win.isFullScreen() && !htmlFullscreen) {
      // Leave full screen only. The key is NOT swallowed, so a modal on the page can still close with the same Esc.
      win.setFullScreen(false);
    }
  });

  // After leaving full screen, fill the desktop (maximised window) instead of a small floating one.
  win.on("leave-full-screen", () => { if (!win.isDestroyed() && !win.isMaximized()) win.maximize(); });

  win.once("ready-to-show", () => win.show());

  /* ---- navigation safety ---- */
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!isInternalUrl(url)) openExternalSafely(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    try {
      const u = new URL(url);
      if (isInternalUrl(url) && u.pathname === "/api/auth/google") {
        event.preventDefault();
        startGoogleSignIn(u.searchParams.get("next") || "");
        return;
      }
    } catch { /* fall through */ }
    if (!isInternalUrl(url)) {
      event.preventDefault();
      openExternalSafely(url);
    }
  });

  win.webContents.on("render-process-gone", (_e, details) => {
    if (details.reason !== "clean-exit" && !win.isDestroyed()) win.reload();
  });

  win.loadURL(DEV_URL || `${APP_ORIGIN}/`).catch((error) => console.error("[narx] load failed:", error));
  win.on("closed", () => { mainWindow = null; });
}

/* ------------------------------ auto-update ------------------------------
 * New app versions are published as GitHub Releases by .github/workflows/desktop.yml. The installed app checks on
 * start and every 4 hours, downloads in the background, then offers a restart (otherwise installs when closed).
 * Prices/products never go through this — they come from the server. */
function setupAutoUpdate() {
  if (!app.isPackaged || process.env.PORTABLE_EXECUTABLE_DIR) return; // not in dev, and the portable .exe cannot self-update
  let autoUpdater;
  try { ({ autoUpdater } = require("electron-updater")); } catch (error) { console.warn("[narx] updater unavailable:", error.message); return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("error", (error) => console.warn("[narx] update check failed:", error?.message));
  autoUpdater.on("update-downloaded", async (info) => {
    try {
      const { response } = await dialog.showMessageBox(mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined, {
        type: "info",
        title: "Narx.top",
        message: `Narx.top ${info.version} tayyor`,
        detail: "Yangi versiya yuklab olindi. Hozir qayta ishga tushirib yangilaymizmi? (Keyinroq bo‘lsa, dastur yopilganda yangilanadi.)",
        buttons: ["Hozir yangilash", "Keyinroq"],
        defaultId: 0,
        cancelId: 1,
      });
      if (response === 0) autoUpdater.quitAndInstall();
    } catch { /* ignore */ }
  });
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  setTimeout(check, 10 * 1000);
  setInterval(check, 4 * 60 * 60 * 1000);
}

/* --------------------------------- app ---------------------------------- */

// Windows: the narxtop:// link arrives as a command-line argument of a second launch.
app.on("second-instance", (_event, argv) => {
  const link = (argv || []).find((arg) => String(arg).startsWith(`${PROTOCOL}://`));
  if (link) handleDeepLink(link);
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null); // no File/Edit/View bar
  if (app.isPackaged) app.setAsDefaultProtocolClient(PROTOCOL); // narxtop:// opens this app (the installer also registers it)

  protocol.handle(SCHEME, handleAppRequest);

  // Permissions: only our own pages, and only what the site actually uses (location for "nearest store", mic for chat).
  const allowed = new Set(["geolocation", "media", "fullscreen", "clipboard-sanitized-write"]);
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    callback(allowed.has(permission) && isInternalUrl(details.requestingUrl || wc.getURL()));
  });
  session.defaultSession.setPermissionCheckHandler((wc, permission, origin) => allowed.has(permission) && isInternalUrl(origin));

  createWindow();
  setupAutoUpdate();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
