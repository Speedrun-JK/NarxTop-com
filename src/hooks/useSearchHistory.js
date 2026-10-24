import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import {
  clearSearchHistory,
  fetchSearchHistory,
  getGuestSearchSessionId,
  mergeSearchHistory,
  readSearchHistory,
  removeSearchHistoryItem,
  saveSearchHistory,
  searchHistoryKey,
  writeSearchHistory,
} from "../services/searchHistory";

const localId = () => `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

export default function useSearchHistory() {
  const { user } = useAuth();
  const [sessionId] = useState(getGuestSearchSessionId);
  const ownerKey = user?.id ? `user:${user.id}` : `guest:${sessionId}`;
  const [byOwner, setByOwner] = useState(() => ({ [ownerKey]: readSearchHistory(ownerKey) }));
  const history = byOwner[ownerKey] ?? readSearchHistory(ownerKey);

  const store = useCallback((next) => {
    const entries = typeof next === "function" ? next(byOwner[ownerKey] ?? readSearchHistory(ownerKey)) : next;
    writeSearchHistory(ownerKey, entries);
    setByOwner((prior) => ({ ...prior, [ownerKey]: entries }));
  }, [byOwner, ownerKey]);

  useEffect(() => {
    let cancelled = false;
    fetchSearchHistory(sessionId).then((result) => {
      if (cancelled) return;
      const merged = mergeSearchHistory(result.history, readSearchHistory(ownerKey));
      writeSearchHistory(ownerKey, merged);
      setByOwner((prior) => ({ ...prior, [ownerKey]: merged }));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [ownerKey, sessionId]);

  const record = useCallback((query) => {
    const value = String(query ?? "").trim().replace(/\s+/g, " ").slice(0, 160);
    if (!value) return;
    const entry = { id: localId(), query: value, createdAt: new Date().toISOString() };
    store((current) => mergeSearchHistory([entry], current));
    saveSearchHistory(value, sessionId).then((result) => {
      const merged = mergeSearchHistory(result.history, readSearchHistory(ownerKey));
      writeSearchHistory(ownerKey, merged);
      setByOwner((prior) => ({ ...prior, [ownerKey]: merged }));
    }).catch(() => {});
  }, [ownerKey, sessionId, store]);

  const remove = useCallback((entry) => {
    store((current) => current.filter((item) => searchHistoryKey(item.query) !== searchHistoryKey(entry.query)));
    if (entry.id && !String(entry.id).startsWith("local-")) removeSearchHistoryItem(entry.id, sessionId).catch(() => {});
  }, [sessionId, store]);

  const clear = useCallback(() => {
    store([]);
    clearSearchHistory(sessionId).catch(() => {});
  }, [sessionId, store]);

  return { history, record, remove, clear };
}
