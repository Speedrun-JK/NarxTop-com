import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLang } from "../../context/LanguageContext";
import Icon from "../ui/Icon";
import {
  BY_ISO, COUNTRIES, detectCountry, DEFAULT_ISO, POPULAR, countryName, dialLabel, e164, flagUrl, formatNational,
  normalizeInput, onlyDigits, parsePhone, placeholderFor,
} from "../../lib/phone";

/* Flag picture. Falls back to a neat ISO badge if the image cannot load (offline, blocked CDN). */
export function Flag({ iso, size = "md" }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={`nt-flag is-${size}`} aria-hidden="true">
      {failed
        ? <b>{iso}</b>
        : <img src={flagUrl(iso, 40)} srcSet={`${flagUrl(iso, 80)} 2x`} alt="" width="24" height="18" loading="lazy" decoding="async" draggable="false" onError={() => setFailed(true)} />}
    </span>
  );
}

const hasCountry = (raw) => Boolean(detectCountry(onlyDigits(raw).replace(/^00/, "")));
const fold = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[ʻʼ‘’'`]/g, "").toLowerCase();

/**
 * Phone input with a country picker.
 *   value    "+998901234567" (E.164) or ""      onChange(value)  -> always E.164 or ""
 * The number is spaced per country while typing (Uzbekistan: 90 123 45 67) and the caret stays where the user is editing.
 */
export default function PhoneField({ label, value, onChange, onBlur, error, valid, hint, autoFocus }) {
  const { t, lang } = useLang();
  const uid = useId();
  const [country, setCountry] = useState(() => parsePhone(value).country);
  const [national, setNational] = useState(() => parsePhone(value).national);
  const [intl, setIntl] = useState(null); // text typed after "+" while the country code is still incomplete
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef(null), input = useRef(null), search = useRef(null), list = useRef(null);
  const caret = useRef(null), emitted = useRef(value ?? "");

  /* Parent changed the value (e.g. profile loaded) -> follow it. Our own emissions are ignored. */
  useEffect(() => {
    if ((value ?? "") === emitted.current) return;
    emitted.current = value ?? "";
    const p = parsePhone(value, country);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCountry(p.country); setNational(p.national);
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = useCallback((c, n) => {
    if (c.dial === "7" && n) c = /^[67]/.test(n) ? BY_ISO.KZ : BY_ISO.RU; // +7 is shared: 6xx/7xx are Kazakh
    setCountry(c); setNational(n);
    const v = e164(c, n);
    emitted.current = v;
    onChange?.(v);
  }, [onChange]);

  const display = intl ?? formatNational(country, national);

  /* Put the caret back after the same number of digits it had before the text was re-spaced. */
  useLayoutEffect(() => {
    const el = input.current;
    if (caret.current == null || !el || document.activeElement !== el) { caret.current = null; return; }
    const target = caret.current; caret.current = null;
    let pos = 0, seen = 0;
    if (target > 0) for (pos = 0; pos < el.value.length; pos++) if (/\d/.test(el.value[pos]) && ++seen === target) { pos++; break; }
    el.setSelectionRange(pos, pos);
  });

  const handleChange = (e) => {
    const raw = e.target.value;
    const at = e.target.selectionStart ?? raw.length;
    let before = onlyDigits(raw.slice(0, at)).length;
    const prev = onlyDigits(national);
    let next;
    if (/^\s*\+/.test(raw) && !hasCountry(raw)) {
      setIntl(raw.replace(/[^\d+\s()-]/g, "")); /* "+9", "+99": wait for the rest of the code */
      return;
    }
    setIntl(null);
    if (prev && onlyDigits(raw) === prev && raw.length < display.length) {
      /* Backspace/Delete removed only a space: remove the neighbouring digit instead, so deleting never gets "stuck". */
      const cut = Math.max(0, before - 1);
      next = { country, national: prev.slice(0, cut) + prev.slice(cut + 1) };
      before = cut;
    } else {
      next = normalizeInput(raw, country);
      if (next.country !== country || /^\s*(\+|00)/.test(raw)) before = onlyDigits(next.national).length;
    }
    caret.current = before;
    commit(next.country, next.national);
  };

  /* ------------------------------ country list ------------------------------ */
  const rows = useMemo(() => {
    const named = COUNTRIES.map((c) => ({ c, name: countryName(c.iso, lang), en: countryName(c.iso, "en") }));
    const collator = new Intl.Collator(lang === "uz" ? "uz" : lang);
    const q = fold(query.trim());
    if (q) {
      const digits = q.replace(/\D/g, "");
      return named
        .filter(({ c, name, en }) => fold(name).includes(q) || fold(en).includes(q) || c.iso.toLowerCase() === q || (digits && c.dial.startsWith(digits)))
        .sort((a, b) => (fold(a.name).startsWith(q) ? 0 : 1) - (fold(b.name).startsWith(q) ? 0 : 1) || collator.compare(a.name, b.name))
        .map((r) => ({ ...r, group: "" }));
    }
    const pop = POPULAR.map((iso) => named.find((r) => r.c.iso === iso)).filter(Boolean).map((r) => ({ ...r, group: "popular" }));
    const rest = named.filter((r) => !POPULAR.includes(r.c.iso)).sort((a, b) => collator.compare(a.name, b.name)).map((r) => ({ ...r, group: "all" }));
    return [...pop, ...rest];
  }, [lang, query]);

  const close = useCallback((refocus = true) => { setOpen(false); setQuery(""); if (refocus) input.current?.focus(); }, []);
  const openList = () => {
    const i = rows.findIndex((r) => r.c.iso === country.iso);
    setActive(Math.max(0, i)); setOpen(true);
  };
  const pick = (c) => {
    const n = onlyDigits(national).slice(0, c.max);
    commit(c, n);
    close();
  };

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!root.current?.contains(e.target)) close(false); };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [open, close]);

  useEffect(() => {
    if (open && window.matchMedia?.("(pointer: fine)").matches) search.current?.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onSearchKey = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(rows.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(rows.length - 1); }
    else if (e.key === "Enter") { e.preventDefault(); if (rows[active]) pick(rows[active].c); }
    else if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "Tab") close(false);
  };
  const onButtonKey = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!open) openList(); }
  };

  const state = error ? "is-error" : valid ? "is-valid" : "";
  const range = country.min === country.max ? `${country.max}` : `${country.min}–${country.max}`;
  const cname = countryName(country.iso, lang);
  const inputId = `${uid}-n`, msgId = `${uid}-m`;

  return (
    <div className={`nt-field nt-phone-field ${state}`} ref={root}>
      <label htmlFor={inputId}>{label}</label>
      <div className={`nt-phone ${open ? "is-open" : ""}`}>
        <button type="button" className="nt-phone-cc" aria-haspopup="listbox" aria-expanded={open} aria-controls={`${uid}-l`}
          aria-label={`${t("auth.phoneCountry")}: ${cname} ${dialLabel(country)}`} title={cname}
          onClick={() => (open ? close(false) : openList())} onKeyDown={onButtonKey}>
          <Flag iso={country.iso} />
          <span className="nt-phone-dial">{dialLabel(country)}</span>
          <Icon name="chevronDown" size={15} strokeWidth={2.4} className="nt-phone-chev" />
        </button>
        <input ref={input} id={inputId} className="nt-phone-input" type="tel" inputMode="tel" autoComplete="tel-national" autoFocus={autoFocus}
          value={display} onChange={handleChange} onBlur={(e) => { setIntl(null); onBlur?.(e); }} placeholder={placeholderFor(country)}
          aria-invalid={Boolean(error)} aria-describedby={msgId} />
        <AnimatePresence>
          {valid && !error && <motion.span className="nt-ok" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}><Icon name="check" size={16} strokeWidth={2.6} /></motion.span>}
        </AnimatePresence>

        <AnimatePresence>
          {open && (
            <motion.div className="nt-phone-pop" initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} transition={{ duration: 0.16 }}>
              <label className="nt-phone-search">
                <Icon name="search" size={16} />
                <input ref={search} type="text" value={query} onChange={(e) => { setQuery(e.target.value); setActive(0); }} onKeyDown={onSearchKey}
                  placeholder={t("auth.phoneSearch")} aria-label={t("auth.phoneSearch")} role="combobox" aria-expanded="true" aria-controls={`${uid}-l`}
                  aria-activedescendant={rows[active] ? `${uid}-o-${rows[active].c.iso}` : undefined} autoComplete="off" spellCheck={false} />
              </label>
              <ul id={`${uid}-l`} ref={list} role="listbox" aria-label={t("auth.phoneCountry")} tabIndex={-1}>
                {rows.length === 0 && <li className="nt-phone-empty" role="presentation">{t("auth.phoneNone")}</li>}
                {rows.map((r, i) => (
                  <li key={r.c.iso} role="presentation" className="nt-phone-li">
                    {(i === 0 || rows[i - 1].group !== r.group) && r.group && <span className="nt-phone-group" role="presentation">{r.group === "popular" ? t("auth.phonePopular") : t("auth.phoneAll")}</span>}
                    <div id={`${uid}-o-${r.c.iso}`} data-i={i} role="option" aria-selected={r.c.iso === country.iso}
                      className={`nt-phone-opt ${i === active ? "is-active" : ""} ${r.c.iso === country.iso ? "is-picked" : ""}`}
                      onPointerEnter={() => setActive(i)} onClick={() => pick(r.c)}>
                      <Flag iso={r.c.iso} />
                      <span className="nt-phone-name">{r.name}</span>
                      <span className="nt-phone-code">{dialLabel(r.c)}</span>
                      {r.c.iso === country.iso && <Icon name="check" size={15} strokeWidth={2.6} className="nt-phone-tick" />}
                    </div>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div id={msgId} className="nt-msg">
        <AnimatePresence mode="wait" initial={false}>
          {error ? <motion.span key="e" className="is-err" initial={{ opacity: 0, y: -4, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, height: 0 }} role="alert">{error}</motion.span>
            : <motion.span key="h" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{(typeof hint === "function" ? hint({ n: range, c: cname }) : hint) ?? t("auth.phoneHintN", { n: range, c: cname })}</motion.span>}
        </AnimatePresence>
      </div>
    </div>
  );
}

export { BY_ISO, DEFAULT_ISO };
