import { useEffect, useSyncExternalStore } from "react";
import { apiUrl } from "./api";

/* Store logos uploaded in the admin panel (MongoDB, GET /api/store-logos). A tiny shared store so every <StoreMark>
 * on the page updates together; bundled files in src/assets/stores still work as the fallback. */
export const logoKey = (chain) => String(chain ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");

let logos = {};
let state = "idle"; // idle | loading | done
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export function loadStoreLogos(force = false) {
  if (state === "loading" || (state === "done" && !force)) return;
  state = "loading";
  fetch(apiUrl("/api/store-logos"))
    .then((r) => (r.ok ? r.json() : null))
    .then((body) => { if (body?.logos) logos = body.logos; })
    .catch(() => { /* no API (demo / offline): bundled logos or the neutral icon are used */ })
    .finally(() => { state = "done"; emit(); });
}

/** Used by the admin panel right after an upload/removal so the change shows instantly. */
export function setStoreLogo(chain, dataUrl) {
  const next = { ...logos };
  if (dataUrl) next[logoKey(chain)] = dataUrl; else delete next[logoKey(chain)];
  logos = next;
  emit();
}

export function useStoreLogos() {
  useEffect(() => { loadStoreLogos(); }, []);
  return useSyncExternalStore((fn) => { listeners.add(fn); return () => listeners.delete(fn); }, () => logos, () => logos);
}
