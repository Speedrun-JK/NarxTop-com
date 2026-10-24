const VERSION = 2;
// v1 used the same `{ schemaVersion, value }` envelope. Keep an explicit migration
// so existing NarxTop data advances without changing its shape or being discarded.
const DEFAULT_MIGRATIONS = { 1: (value) => value };

function storageAvailable() {
  try { return typeof window !== "undefined" && Boolean(window.localStorage); } catch { return false; }
}

/** Read JSON safely. Supports legacy unwrapped values and versioned values `{ schemaVersion, value }`. */
export function safeGet(key, fallback, migrations = {}) {
  if (!storageAvailable()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    let parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && Number.isInteger(parsed.schemaVersion) && Object.hasOwn(parsed, "value")) {
      let version = parsed.schemaVersion;
      let value = parsed.value;
      while (version < VERSION) {
        const migrate = migrations[version] ?? DEFAULT_MIGRATIONS[version];
        if (typeof migrate !== "function") return fallback;
        value = migrate(value);
        version += 1;
      }
      if (version > VERSION) return fallback;
      return value;
    }
    return parsed;
  } catch {
    try { localStorage.removeItem(key); } catch { /* storage may be disabled */ }
    return fallback;
  }
}

/** Write a versioned JSON value; return false when storage is unavailable or full. */
export function safeSet(key, value) {
  if (!storageAvailable()) return false;
  try {
    localStorage.setItem(key, JSON.stringify({ schemaVersion: VERSION, value }));
    return true;
  } catch (error) {
    if (error?.name === "QuotaExceededError" || error?.code === 22) {
      try { window.dispatchEvent(new CustomEvent("narxtop:storage-quota", { detail: { key } })); } catch { /* ignore */ }
    }
    return false;
  }
}

export function safeRemove(key) {
  try { if (storageAvailable()) localStorage.removeItem(key); } catch { /* ignore */ }
}

export function onStorage(key, callback) {
  if (typeof window === "undefined") return () => {};
  const listener = (event) => {
    if (event.storageArea === localStorage && (!key || event.key === key || event.key === null)) callback(event);
  };
  window.addEventListener("storage", listener);
  return () => window.removeEventListener("storage", listener);
}
