/* Where the API lives. By default the website and API share one origin and the browser calls "/api/..." (the Vite dev
 * proxy or the Express server answers). To host the website separately (e.g. Netlify) while the API runs elsewhere,
 * set VITE_API_ROOT=https://your-api-host/api at build time. Every request goes through apiUrl(). */
const ROOT = String(import.meta.env.VITE_API_ROOT || "/api").replace(/\/+$/, "");

/** apiUrl("/api/catalog?x=1") -> "<ROOT>/catalog?x=1". Non-API paths pass through untouched. */
export const apiUrl = (path) => (/^\/api(\/|\?|$)/.test(path) ? ROOT + path.slice(4) : path);

/** All app API calls include the NarxTop HttpOnly session cookie, including a separately hosted API. */
export const apiFetch = (path, options = {}) => fetch(apiUrl(path), { credentials: "include", ...options });
