import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import Icon from "../ui/Icon";
import { useLang } from "../../context/LanguageContext";
import { SEARCH_RADIUS_KM, branchRoute, findBranches, formatKm } from "../../lib/nearby";

/*
 * "Yo‘lni ko‘rish" popup for one chain (Macro / Havas / Karzinka …).
 * Asks the browser for the current position once when it opens, then offers four map apps.
 * Every link searches for the chain NAME around the user's position, so the map app itself
 * picks the nearest branch. Without a position (denied / unavailable) the links still work:
 * the map app uses its own location. With a position it also looks up the nearest real branches in
 * OpenStreetMap (lib/nearby.js) and offers direct directions to each. Nothing is stored by this site.
 */
let lastFix = null; // { lat, lng, at } — reused for 2 minutes so re-opening does not re-prompt

const q = (s) => encodeURIComponent(s);
const APPS = (chain, p) => [
  {
    key: "google", name: "Google Maps", d: "rt.google.d", tone: "g",
    href: p ? `https://www.google.com/maps/search/${q(chain)}/@${p.lat},${p.lng},13z` : `https://www.google.com/maps/search/?api=1&query=${q(chain)}`,
  },
  {
    key: "yandex", name: "Yandex Maps", d: "rt.yandex.d", tone: "y",
    href: p ? `https://yandex.com/maps/?text=${q(chain)}&ll=${p.lng}%2C${p.lat}&z=13` : `https://yandex.com/maps/?text=${q(chain)}`,
  },
  {
    key: "gis", name: "2GIS", d: "rt.gis.d", tone: "d",
    href: p ? `https://2gis.uz/search/${q(chain)}?m=${p.lng}%2C${p.lat}%2F13` : `https://2gis.uz/search/${q(chain)}`,
  },
  {
    key: "waze", name: "Waze", d: "rt.waze.d", tone: "w",
    href: p ? `https://waze.com/ul?q=${q(chain)}&ll=${p.lat}%2C${p.lng}&navigate=yes&zoom=13` : `https://waze.com/ul?q=${q(chain)}&navigate=yes`,
  },
];

export default function RouteModal({ chain, onClose }) {
  const { t } = useLang();
  const [state, setState] = useState(() => (lastFix && Date.now() - lastFix.at < 120000 ? "ok" : (typeof navigator !== "undefined" && navigator.geolocation ? "locating" : "unavailable")));
  const [pos, setPos] = useState(() => (lastFix && Date.now() - lastFix.at < 120000 ? lastFix : null));
  const closeBtn = useRef(null);
  const dialogRef = useRef(null);
  const openerRef = useRef(null);
  const live = useRef(true);
  const [branches, setBranches] = useState({ key: "", status: "idle", list: [] }); // idle | loading | ok | fail
  const [manualLat, setManualLat] = useState("");
  const [manualLng, setManualLng] = useState("");
  const [manualError, setManualError] = useState("");

  // Branch status is keyed to the requested place, so a previous place is never shown as current.
  const branchKey = pos ? `${chain}:${pos.lat}:${pos.lng}` : "";
  const branchView = branches.key === branchKey ? branches : { status: branchKey ? "loading" : "idle", list: [] };

  // nearest real branches (OpenStreetMap) once a position is known
  useEffect(() => {
    if (!pos) return undefined;
    const ctrl = new AbortController();
    findBranches(chain, pos, { signal: ctrl.signal })
      .then((list) => { if (!ctrl.signal.aborted) setBranches({ key: branchKey, status: "ok", list }); })
      .catch(() => { if (!ctrl.signal.aborted) setBranches({ key: branchKey, status: "fail", list: [] }); });
    return () => ctrl.abort();
  }, [branchKey, chain, pos]);

  const acceptPosition = useCallback((r) => {
    if (!live.current) return;
    lastFix = { lat: +r.coords.latitude.toFixed(5), lng: +r.coords.longitude.toFixed(5), at: Date.now() };
    setPos(lastFix); setState("ok");
  }, []);
  const rejectPosition = useCallback((err) => { if (live.current) setState(err.code === 1 ? "denied" : "unavailable"); }, []);
  const locate = useCallback(() => {
    if (!navigator.geolocation) { setState("unavailable"); return; }
    setState("locating");
    navigator.geolocation.getCurrentPosition(acceptPosition, rejectPosition, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }, [acceptPosition, rejectPosition]);

  useEffect(() => {
    if (!pos && navigator.geolocation) navigator.geolocation.getCurrentPosition(acceptPosition, rejectPosition, { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 });
  }, [acceptPosition, pos, rejectPosition]);

  useEffect(() => {
    live.current = true;
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeBtn.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      const focusable = [...(dialog?.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])]
        .filter((element) => element instanceof HTMLElement && element.getClientRects().length > 0);
      if (!focusable.length) { e.preventDefault(); closeBtn.current?.focus(); return; }
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { live.current = false; window.removeEventListener("keydown", onKey); openerRef.current?.focus?.({ preventScroll: true }); };
  }, [onClose]);

  const apps = useMemo(() => APPS(chain, pos), [chain, pos]);
  const note = { locating: "rt.locating", ok: "rt.located", denied: "rt.denied", unavailable: "rt.unavailable" }[state];
  const useManualLocation = (event) => {
    event.preventDefault();
    const lat = Number(manualLat), lng = Number(manualLng);
    if (!manualLat || !manualLng || !Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setManualError(t("rt.manualInvalid"));
      return;
    }
    const fix = { lat: +lat.toFixed(5), lng: +lng.toFixed(5), at: Date.now() };
    lastFix = fix;
    setPos(fix);
    setManualError("");
    setState("ok");
  };

  return createPortal(
    <div className="rt-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="rt-title" className="rt">
        <header className="rt-head">
          <span className="rt-ico" aria-hidden="true"><Icon name="navigation" size={20} /></span>
          <div>
            <h3 id="rt-title">{t("rt.title", { c: chain })}</h3>
            <p>{t("rt.sub", { c: chain })}</p>
          </div>
          <button ref={closeBtn} type="button" className="rt-x" onClick={onClose} aria-label={t("nav.close")} title={t("nav.close")}><Icon name="x" size={18} /></button>
        </header>

        <p className={`rt-status is-${state}`} role="status">
          {state === "locating" ? <span className="nt-spin" aria-hidden="true" /> : <Icon name={state === "ok" ? "checkCircle" : "alert"} size={16} />}
          <span>{t(note)}</span>
          {(state === "denied" || state === "unavailable") && <button type="button" className="rt-retry" onClick={locate}>{t("rt.retry")}</button>}
        </p>

        {(state === "denied" || state === "unavailable") && !pos && <form className="rt-manual" onSubmit={useManualLocation}>
          <h4>{t("rt.manualTitle")}</h4>
          <div className="rt-manual-fields">
            <label><span>{t("rt.latitude")}</span><input type="number" step="any" min="-90" max="90" inputMode="decimal" value={manualLat} onChange={(e) => setManualLat(e.target.value)} required /></label>
            <label><span>{t("rt.longitude")}</span><input type="number" step="any" min="-180" max="180" inputMode="decimal" value={manualLng} onChange={(e) => setManualLng(e.target.value)} required /></label>
          </div>
          {manualError && <p role="alert">{manualError}</p>}
          <button type="submit" className="nt-btn nt-btn-ghost">{t("rt.useManual")}</button>
        </form>}

        {pos && (
          <section className="rt-br" aria-live="polite">
            <h4>{t("rt.nearest")}</h4>
            {branchView.status === "loading" && <p className="rt-br-msg"><span className="nt-spin" aria-hidden="true" />{t("rt.searching")}</p>}
            {branchView.status === "fail" && <p className="rt-br-msg">{t("rt.lookupFail")}</p>}
            {branchView.status === "ok" && branchView.list.length === 0 && <p className="rt-br-msg">{t("rt.none", { c: chain, r: SEARCH_RADIUS_KM })}</p>}
            {branchView.list.length > 0 && (
              <ul>
                {branchView.list.map((b, i) => (
                  <li key={`${b.lat}-${b.lng}`} className={i === 0 ? "is-first" : ""}>
                    <span className="rt-br-km">{formatKm(b.km)}</span>
                    <b>{b.name}</b>
                    <span className="rt-br-go">
                      {[["google", "Google"], ["yandex", "Yandex"], ["gis", "2GIS"], ["waze", "Waze"]].map(([k, label]) => (
                        <a key={k} href={branchRoute(k, pos, b)} target="_blank" rel="noopener noreferrer" aria-label={`${t("rt.route")}: ${label}`}>{label}</a>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {branchView.status === "ok" && branchView.list.length > 0 && <small>{t("rt.any")}</small>}
          </section>
        )}

        <ul className="rt-apps">
          {apps.map((a) => (
            <li key={a.key}>
              <a className={`rt-app is-${a.tone}`} href={a.href} target="_blank" rel="noopener noreferrer">
                <span className="rt-app-logo" aria-hidden="true">{a.key === "gis" ? "2G" : a.name[0]}</span>
                <span className="rt-app-txt"><b>{a.name}</b><small>{t(a.d, { c: chain })}</small></span>
                <span className="rt-app-go">{t("rt.open")}<Icon name="external" size={14} /></span>
              </a>
            </li>
          ))}
        </ul>

        <p className="rt-note">{t("rt.privacy")}</p>
      </div>
    </div>,
    document.body
  );
}
