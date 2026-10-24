import { useEffect, useId, useRef, useState } from "react";

import Icon from "../ui/Icon";
import { useLang } from "../../context/LanguageContext";
import { SORT_OPTIONS } from "../../lib/sortProducts";

/* "Tartiblash: Eng arzon avval" pill. Opens a small listbox; closes on outside click / Escape; arrow keys move. */
export default function SortSelect({ value, onChange, className = "" }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const root = useRef(null);
  const id = useId();
  const current = SORT_OPTIONS.find(([key]) => key === value) ?? SORT_OPTIONS[0];

  useEffect(() => {
    if (!open) return undefined;
    const away = (e) => { if (!root.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") { setOpen(false); root.current?.querySelector("button")?.focus(); } };
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", esc); };
  }, [open]);

  const choose = (key) => { onChange(key); setOpen(false); };
  const move = (e) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const at = SORT_OPTIONS.findIndex(([key]) => key === current[0]);
    const next = SORT_OPTIONS[(at + (e.key === "ArrowDown" ? 1 : -1) + SORT_OPTIONS.length) % SORT_OPTIONS.length][0];
    onChange(next);
  };

  return (
    <div className={`srt ${open ? "is-open" : ""} ${className}`} ref={root}>
      <button type="button" className="srt-btn" aria-haspopup="listbox" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} onKeyDown={move}>
        <Icon name="sliders" size={17} />
        <span className="srt-text"><span className="srt-label">{t("p.sort.label")}:</span> <b>{t(current[1])}</b></span>
        <Icon name="chevronDown" size={16} className="srt-chev" />
      </button>
      {open && (
        <ul className="srt-list" id={id} role="listbox" aria-label={t("p.sort.label")}>
          {SORT_OPTIONS.map(([key, label]) => (
            <li key={key} role="option" aria-selected={key === current[0]}>
              <button type="button" className={key === current[0] ? "is-on" : ""} onClick={() => choose(key)}>
                <span>{t(label)}</span>{key === current[0] && <Icon name="check" size={16} strokeWidth={2.6} />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
