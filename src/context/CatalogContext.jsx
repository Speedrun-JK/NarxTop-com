import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { loadCatalog, loadInsights } from "../services/catalog";
import { buildSearchIndex, searchProducts } from "../../shared/core/matching.js";

const CatalogContext = createContext(null);

export function CatalogProvider({ children }) {
  const [state, setState] = useState({ status: "loading", products: [], source: null, generatedAt: null, error: null });
  const [insights, setInsights] = useState({ drops: [], trending: [] });
  const run = useRef(0);
  const inflight = useRef(null);
  const loadedAt = useRef(0);

  const reload = useCallback(() => {
    const id = ++run.current; // later call wins; earlier results are ignored
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    setState((s) => ({ ...s, status: s.products.length ? "refreshing" : "loading", error: null }));
    loadCatalog(controller.signal)
      .then((c) => {
        if (id !== run.current) return;
        loadedAt.current = Date.now();
        setState({ status: "ready", products: c.products, source: c.source, generatedAt: c.generatedAt, error: null });
        loadInsights(controller.signal).then((i) => id === run.current && setInsights(i)).catch(() => {});
      })
      .catch((e) => {
        if (e.name === "AbortError" || id !== run.current) return;
        // a failed refresh must not wipe a catalog that is already on screen
        setState((s) => (s.products.length ? { ...s, status: "ready", error: null } : { ...s, status: "error", error: e.message }));
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    // Kick off the initial catalog request from the lifecycle; later refreshes expose their pending state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const cancel = reload();
    return () => cancel?.();
  }, [reload]);

  /* keep prices fresh: refetch when the tab becomes visible again (or the network returns) after 5 minutes */
  useEffect(() => {
    const STALE_MS = 5 * 60 * 1000;
    const refresh = () => { if (document.visibilityState === "visible" && Date.now() - loadedAt.current > STALE_MS) reload(); };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("online", refresh);
    return () => { document.removeEventListener("visibilitychange", refresh); window.removeEventListener("online", refresh); };
  }, [reload]);

  const index = useMemo(() => buildSearchIndex(state.products), [state.products]);
  const bySlug = useMemo(() => new Map(state.products.map((p) => [p.slug, p])), [state.products]);
  const categories = useMemo(() => [...new Set(state.products.map((p) => p.category))], [state.products]);
  const drops = useMemo(() => new Map(insights.drops.map((d) => [d.slug, d])), [insights.drops]);
  const search = useCallback((q, opts) => searchProducts(index, q, opts), [index]);

  const value = useMemo(() => ({ ...state, insights, drops, bySlug, categories, search, reload }), [state, insights, drops, bySlug, categories, search, reload]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const c = useContext(CatalogContext);
  if (!c) throw new Error("useCatalog must be used inside CatalogProvider");
  return c;
}
