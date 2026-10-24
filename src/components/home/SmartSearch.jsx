import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { useCatalog } from "../../context/CatalogContext";
import { useLang } from "../../context/LanguageContext";
import { formatPrice } from "../../lib/constants";
import { summarize } from "../../lib/product";
import { parseQuery } from "../../../shared/core/matching.js";
import useSearchHistory from "../../hooks/useSearchHistory";
import Icon from "../ui/Icon";

/* `onSearch(text)`: when given (the /products page), a search updates that page in place instead of navigating, and emptying the field clears it. */
export default function SmartSearch({ autoFocus = false, initial = "", compact = false, shortHint = false, onSearch }) {
  const { t, tProduct, tUnit } = useLang();
  const { search, status } = useCatalog();
  const navigate = useNavigate();
  const { history, record, remove, clear: clearHistory } = useSearchHistory();
  const [q, setQ] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const box = useRef(null);
  const panelRef = useRef(null);
  const input = useRef(null);
  const [panelStyle, setPanelStyle] = useState(null);

  // keep the field in step with the page (Back / Forward, or the page clearing the search)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setQ(initial); }, [initial]);

  const parsed = useMemo(() => parseQuery(q), [q]);
  const results = useMemo(() => (q.trim().length >= 2 && status !== "loading" ? search(q, { limit: 6 }).results : []), [q, search, status]);
  const typed = q.trim().length >= 2 && status !== "loading";
  const showPanel = open && (typed || (!q.trim() && history.length > 0));

  useEffect(() => {
    const close = (e) => box.current && !box.current.contains(e.target) && !panelRef.current?.contains(e.target) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);

  // The floating list lives under document.body so hero/section overflow cannot clip it.
  useEffect(() => {
    if (!showPanel || !input.current) { setPanelStyle(null); return undefined; }
    const position = () => {
      const rect = input.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      const leftEdge = viewport?.offsetLeft ?? 0;
      const topEdge = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const left = Math.max(leftEdge + 8, Math.min(rect.left, leftEdge + width - rect.width - 8));
      const spaceBelow = Math.max(0, topEdge + height - rect.bottom - 12);
      const spaceAbove = Math.max(0, rect.top - topEdge - 12);
      const openAbove = spaceBelow < 240 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(80, openAbove ? spaceAbove : spaceBelow);
      // Opening upward must be anchored by its BOTTOM edge to the field. Anchoring by `top` (the old code)
      // assumed the list always fills maxHeight, so a short list jumped to the very top of the screen.
      const base = { position: "fixed", left, width: Math.max(1, Math.min(rect.width, width - 16)), maxHeight };
      setPanelStyle(openAbove
        ? { ...base, top: "auto", bottom: Math.max(8, document.documentElement.clientHeight - rect.top + 10), above: true }
        : { ...base, top: rect.bottom + 10, bottom: "auto", above: false });
    };
    position();
    window.addEventListener("scroll", position, true);
    window.addEventListener("resize", position);
    window.visualViewport?.addEventListener("resize", position);
    window.visualViewport?.addEventListener("scroll", position);
    return () => {
      window.removeEventListener("scroll", position, true);
      window.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("resize", position);
      window.visualViewport?.removeEventListener("scroll", position);
    };
  }, [showPanel, q, results.length, history.length]);

  /* press "/" anywhere (outside form fields) to jump to search */
  useEffect(() => {
    const k = (e) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || document.activeElement?.isContentEditable) return;
      e.preventDefault(); input.current?.focus();
    };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, []);

  const runSearch = (text) => (onSearch ? onSearch(text) : navigate(`/products?q=${encodeURIComponent(text)}`));

  const go = (e) => {
    e?.preventDefault();
    if (q.trim()) record(q.trim());
    if (active >= 0 && results[active]) navigate(`/product/${results[active].product.slug}`);
    else if (q.trim()) runSearch(q.trim());
    setOpen(false);
  };

  const onKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setActive((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(-1, i - 1)); }
    else if (e.key === "Escape") setOpen(false);
  };

  const clear = () => { setQ(""); setActive(-1); input.current?.focus(); if (onSearch) onSearch(""); };

  return (
    <div className={`nt-ss ${open ? "is-open" : ""} ${compact ? "is-compact" : ""}`} ref={box}>
      <form onSubmit={go} role="search">
        <span className="nt-ss-icon" aria-hidden="true"><Icon name="search" size={19} /></span>
        <input
          ref={input} type="search" value={q} autoFocus={autoFocus} autoComplete="off" spellCheck={false} maxLength={160}
          placeholder={t(compact || shortHint ? "p.search.placeholderShort" : "p.search.placeholder")} aria-label={t("nav.search")}
          aria-expanded={showPanel} aria-controls="nt-ss-list" aria-activedescendant={active >= 0 && results[active] ? `nt-ss-opt-${active}` : undefined} role="combobox"
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); if (onSearch && !e.target.value.trim()) onSearch(""); }}
          onFocus={() => setOpen(true)} onKeyDown={onKey}
        />
        {parsed.cheapest && <motion.span className="nt-chip" initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}><Icon name="tag" size={14} /> {t("p.search.cheapest")}</motion.span>}
        {q ? (
          <button type="button" className="nt-ss-clear" onClick={clear} aria-label={t("p.search.clear")} title={t("p.search.clear")}><Icon name="x" size={15} /></button>
        ) : (
          <kbd className="nt-kbd" aria-hidden="true">/</kbd>
        )}
        <button type="submit" className="nt-btn nt-btn-primary nt-ss-go"><span>{t("nav.search")}</span><Icon name="arrowRight" size={16} className="nt-ss-go-ico" /></button>
      </form>

      {createPortal(
        <AnimatePresence>
          {showPanel && panelStyle && (
          <motion.div key="panel" ref={panelRef} style={{ ...panelStyle, above: undefined }} className={`nt-ss-panel ${panelStyle.above ? "is-above" : ""}`} initial={{ opacity: 0, y: panelStyle.above ? 8 : -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: panelStyle.above ? 6 : -6 }} transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}>
            {!q.trim() && history.length > 0 ? (
              <section className="nt-ss-history" aria-label={t("p.search.history")}>
                <header><b>{t("p.search.history")}</b><button type="button" onClick={clearHistory}>{t("p.search.historyClear")}</button></header>
                <ul id="nt-ss-list" role="listbox">
                  {history.map((entry) => (
                    <li key={entry.id || entry.query} role="presentation">
                      <button type="button" role="option" className="nt-ss-history-query" onClick={() => { record(entry.query); setQ(entry.query); runSearch(entry.query); setOpen(false); }}>
                        <Icon name="clock" size={16} /><span>{entry.query}</span>
                      </button>
                      <button type="button" className="nt-ss-history-remove" aria-label={t("p.search.historyRemove", { q: entry.query })} title={t("p.search.historyRemove", { q: entry.query })} onClick={() => remove(entry)}><Icon name="x" size={15} /></button>
                    </li>
                  ))}
                </ul>
              </section>
            ) : results.length > 0 ? (
              <>
                <ul id="nt-ss-list" role="listbox" className="nt-ss-list">
                  {results.map((r, i) => {
                    const best = summarize(r.product).best.price;
                    return (
                      <li key={r.product.slug} role="presentation" onMouseEnter={() => setActive(i)}>
                        <button type="button" id={`nt-ss-opt-${i}`} role="option" aria-selected={i === active} className={i === active ? "is-active" : ""} onClick={() => { record(q.trim()); navigate(`/product/${r.product.slug}`); setOpen(false); }}>
                          <span className="nt-ss-thumb">{r.product.image ? <img src={r.product.image} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} /> : <Icon name="package" size={18} />}</span>
                          <span className="nt-ss-name">{tProduct(r.product, "name")}<small>{tUnit(r.product.unit)}</small></span>
                          <b className="nt-ss-price">{formatPrice(best)}</b>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <button type="button" className="nt-ss-all" onClick={() => { record(q.trim()); runSearch(q.trim()); setOpen(false); }}>
                  <span>{t("p.search.all", { q: q.trim() })}</span>
                  <Icon name="arrowRight" size={15} />
                </button>
              </>
            ) : (
              <div className="nt-ss-none"><Icon name="search" size={20} /><b>{t("p.search.none", { q: q.trim() })}</b><span>{t("p.search.noneHint")}</span></div>
            )}
          </motion.div>
          )}
        </AnimatePresence>, document.body
      )}
    </div>
  );
}
