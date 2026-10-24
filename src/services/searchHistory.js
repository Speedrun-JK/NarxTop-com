import { apiFetch, apiUrl } from "../lib/api";

const SESSION_KEY = "narxtop_search_session";
const MAX_HISTORY = 10;

export function getGuestSearchSessionId() {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = globalThis.crypto?.randomUUID?.() ?? `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return `guest_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
  }
}

export const searchHistoryStorageKey = (ownerKey) => `narxtop_search_history:${ownerKey}`;
export const searchHistoryKey = (query) => String(query ?? "").trim().replace(/\s+/g, " ").normalize("NFKC").toLocaleLowerCase();

export function readSearchHistory(ownerKey) {
  try {
    const parsed = JSON.parse(localStorage.getItem(searchHistoryStorageKey(ownerKey)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item?.query).slice(0, MAX_HISTORY) : [];
  } catch {
    return [];
  }
}

export function writeSearchHistory(ownerKey, history) {
  try { localStorage.setItem(searchHistoryStorageKey(ownerKey), JSON.stringify(history.slice(0, MAX_HISTORY))); } catch { /* storage can be full or disabled */ }
}

export function mergeSearchHistory(...lists) {
  const entries = new Map();
  for (const item of lists.flat()) {
    const key = searchHistoryKey(item?.query);
    if (!key) continue;
    const prior = entries.get(key);
    if (!prior) { entries.set(key, item); continue; }
    const newest = Date.parse(item.createdAt ?? 0) >= Date.parse(prior.createdAt ?? 0) ? item : prior;
    const serverId = [prior, item].find((entry) => entry.id && !String(entry.id).startsWith("local-"))?.id;
    entries.set(key, serverId ? { ...newest, id: serverId } : newest);
  }
  return [...entries.values()].sort((a, b) => Date.parse(b.createdAt ?? 0) - Date.parse(a.createdAt ?? 0)).slice(0, MAX_HISTORY);
}

async function request(path, { method = "GET", sessionId, body } = {}) {
  const url = apiUrl(`/api/search/history${path}`);
  const guestQuery = sessionId ? `${url.includes("?") ? "&" : "?"}sessionId=${encodeURIComponent(sessionId)}` : "";
  const payload = body ? { ...body, ...(sessionId ? { sessionId } : {}) } : body;
  const response = await apiFetch(`${url}${guestQuery}`, {
    method,
    headers: {
      ...(payload ? { "Content-Type": "application/json" } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) throw new Error(result?.message || `Search history ${response.status}`);
  return result;
}

export const fetchSearchHistory = (sessionId) => request("", { sessionId });
export const saveSearchHistory = (query, sessionId) => request("", { method: "POST", sessionId, body: { query } });
export const removeSearchHistoryItem = (id, sessionId) => request(`/${encodeURIComponent(id)}`, { method: "DELETE", sessionId });
export const clearSearchHistory = (sessionId) => request("", { method: "DELETE", sessionId });
