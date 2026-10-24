import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import Icon from "../components/ui/Icon";
import PageShell from "../components/layout/PageShell";
import ScrollBar from "../components/ui/ScrollBar";
import Gate from "../components/ui/Gate";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import StoreMark from "../components/products/StoreMark";
import { previewClick, useProductPreview } from "../components/products/ProductPreview";
import RouteModal from "../components/cart/RouteModal";
import StoreChoiceModal from "../components/cart/StoreChoiceModal";
import CheckoutModal from "../components/cart/CheckoutModal";
import { EmptyState, ErrorState, Skeleton } from "../components/ui/States";

import { useCart } from "../context/CartContext";
import { useAuth } from "../context/AuthContext";
import { useCatalog } from "../context/CatalogContext";
import { useUserData } from "../context/UserDataContext";
import { useLang } from "../context/LanguageContext";
import { formatPrice } from "../lib/constants";
import { cartBreakdown, cheapestSingleStore, storeTotals } from "../lib/product";
import useCountUp from "../hooks/useCountUp";
import useMediaQuery, { PHONE_QUERY } from "../hooks/useMediaQuery";
import { onStorage, safeGet, safeRemove, safeSet } from "../lib/storage";
import { uploadReceipt } from "../services/receipts";

const orderId = () => globalThis.crypto?.randomUUID?.() ?? `nt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const ORDER_STEPS = ["cart", "choose", "review", "route", "receipt", "confirmed"];
const NEXT_STEPS = { cart: ["choose"], choose: ["cart", "review"], review: ["choose", "route", "cart"], route: ["review", "receipt", "cart"], receipt: ["route", "confirmed", "cart"], confirmed: ["cart"] };

async function compressReceipt(file) {
  if (!file?.type?.startsWith("image/") || file.size > 12 * 1024 * 1024) throw new Error("IMAGE_TYPE");
  let bitmap;
  try { bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }); }
  catch { throw new Error("IMAGE_READ"); }
  try {
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) throw new Error("IMAGE_READ");
      ctx.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", Math.max(0.62, 0.84 - attempt * 0.06)));
      if (!blob) throw new Error("IMAGE_READ");
      if (blob.size <= 600 * 1024 || attempt === 4) {
        if (blob.size > 2 * 1024 * 1024) throw new Error("IMAGE_LARGE");
        return await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("IMAGE_READ"));
          reader.readAsDataURL(blob);
        });
      }
      width = Math.max(1, Math.round(width * 0.86));
      height = Math.max(1, Math.round(height * 0.86));
    }
  } finally { bitmap.close?.(); }
  throw new Error("IMAGE_READ");
}

function Total({ value, className }) {
  const v = useCountUp(Math.round(value));
  return <span className={className}>{formatPrice(v)}</span>;
}

/* Cart: a normal scrolling page (header, product list, sticky price summary, footer). */
export default function Cart() {
  const { t, tProduct, tUnit } = useLang();
  const { user, isAuthenticated } = useAuth();
  const { items, setQty, removeItem, removeMany, clear } = useCart();
  const { recordPurchase } = useUserData();
  const { bySlug, status, reload } = useCatalog();
  const [preview, openPreview] = useProductPreview();
  const [mode, setMode] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [off, setOff] = useState(() => new Set()); // unchecked products are left out of the calculation
  /* On phones the per-item checkboxes are not offered: everything in the cart is part of the order (remove an item with
   * the trash button). Saved "unchecked" items are ignored there so nothing can be stuck out of the total; the saved
   * choice itself is kept for larger screens. */
  const isPhone = useMediaQuery(PHONE_QUERY);
  const EMPTY = useMemo(() => new Set(), []);
  const excluded = isPhone ? EMPTY : off;
  const draftKey = `narxtop_checkout_draft_${user?.id ?? "guest"}`;
  const [draft, setDraft] = useState(null);
  const [draftLoadedKey, setDraftLoadedKey] = useState("");
  const [routeOpen, setRouteOpen] = useState(false);
  const [photo, setPhoto] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [receiptError, setReceiptError] = useState("");
  const [cameraState, setCameraState] = useState("idle");
  const [cameraError, setCameraError] = useState("");
  const sideRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const cameraRequest = useRef(0);

  const lines = useMemo(() => items.map((i) => ({ id: i.slug, product: bySlug.get(i.slug), qty: i.qty })).filter((l) => l.product), [items, bySlug]);
  const gone = items.filter((i) => !bySlug.has(i.slug));
  const active = useMemo(() => lines.filter((l) => !excluded.has(l.id)), [lines, excluded]);
  const canEditCart = !draft || draft.step === "cart";

  const totals = useMemo(() => storeTotals(active), [active]);
  const cheapest = useMemo(() => cheapestSingleStore(active), [active]);
  const selected = totals.some((s) => s.chain === mode) ? mode : cheapest?.chain ?? totals[0]?.chain ?? "";
  const b = useMemo(() => cartBreakdown(active, selected), [active, selected]);
  const view = useMemo(() => cartBreakdown(lines, selected), [lines, selected]); // every row, for display
  const complete = totals.filter((s) => s.complete);
  const worstComplete = complete.length > 1 ? Math.max(...complete.map((s) => s.total)) : null;
  const savings = worstComplete != null ? Math.max(0, worstComplete - b.total) : 0;

  useEffect(() => {
    let saved = safeGet(draftKey, null);
    if (!saved && user?.id) {
      saved = safeGet("narxtop_checkout_draft_guest", null);
      if (saved) { safeSet(draftKey, saved); safeRemove("narxtop_checkout_draft_guest"); }
    }
    const finished = saved?.step === "confirmed"; // the result of a sent receipt is shown in Notifications, never in the cart
    const step = !finished && ORDER_STEPS.includes(saved?.step) ? saved.step : "cart";
    // Checkout drafts intentionally hydrate from local storage without persisting receipt image bytes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft({ orderId: !finished && typeof saved?.orderId === "string" ? saved.orderId : orderId(), step, store: !finished && typeof saved?.store === "string" ? saved.store : "", storeConfirmed: !finished && Boolean(saved?.storeConfirmed), excluded: !finished && Array.isArray(saved?.excluded) ? saved.excluded.filter((id) => typeof id === "string") : [], receiptId: finished ? null : saved?.receiptId ?? null });
    setMode(!finished && typeof saved?.store === "string" ? saved.store : "");
    setOff(new Set(!finished && Array.isArray(saved?.excluded) ? saved.excluded : []));
    setPhoto(""); // image bytes are intentionally not persisted in localStorage
    setDraftLoadedKey(draftKey);
  }, [draftKey, user?.id]);

  useEffect(() => onStorage(draftKey, () => {
    const saved = safeGet(draftKey, null);
    if (!saved || !ORDER_STEPS.includes(saved.step) || saved.step === "confirmed") return;
    setDraft(saved); setMode(saved.store ?? ""); setOff(new Set(saved.excluded ?? [])); setPhoto("");
  }), [draftKey]);

  useEffect(() => {
    if (draftLoadedKey !== draftKey || !draft) return;
    safeSet(draftKey, { ...draft, store: selected || draft.store, excluded: [...off] });
  }, [draftKey, draftLoadedKey, draft, off, selected]);

  const setStep = (step, extra = {}) => setDraft((current) => {
    if (current && !NEXT_STEPS[current.step]?.includes(step)) return current;
    return { ...(current ?? { orderId: orderId(), store: selected, storeConfirmed: false }), ...extra, step };
  });
  const closeRoute = useCallback(() => setRouteOpen(false), []);

  const releaseCamera = useCallback(() => {
    cameraRequest.current += 1;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
  const stopCamera = useCallback(() => {
    releaseCamera();
    setCameraState("idle");
  }, [releaseCamera]);

  const startCamera = useCallback(async () => {
    stopCamera();
    const requestId = cameraRequest.current;
    setCameraError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraState("unavailable");
      setCameraError(t("cart.cameraUnavailable"));
      return;
    }
    setCameraState("opening");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      if (requestId !== cameraRequest.current) { stream.getTracks().forEach((track) => track.stop()); return; }
      streamRef.current = stream;
      setCameraState("ready");
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (error) {
      if (requestId !== cameraRequest.current) return;
      setCameraState("unavailable");
      setCameraError(error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError" ? t("cart.cameraDenied") : t("cart.cameraUnavailable"));
    }
  }, [stopCamera, t]);

  useEffect(() => {
    if (draft?.step !== "receipt") releaseCamera();
  }, [draft?.step, releaseCamera]);
  useEffect(() => () => releaseCamera(), [releaseCamera]);
  useEffect(() => {
    if (cameraState === "ready" && videoRef.current && streamRef.current) videoRef.current.srcObject = streamRef.current;
  }, [cameraState]);

  const processPhoto = async (file) => {
    if (!file) return;
    setPhotoBusy(true); setReceiptError("");
    try { setPhoto(await compressReceipt(file)); }
    catch (error) { setPhoto(""); setReceiptError(t(error.message === "IMAGE_LARGE" ? "cart.receiptTooLarge" : "cart.receiptPhotoError")); }
    finally { setPhotoBusy(false); }
  };

  const choosePhoto = (event) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    stopCamera();
    void processPhoto(file);
  };

  const captureCamera = async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) { setCameraError(t("cart.cameraUnavailable")); return; }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) { setCameraError(t("cart.cameraUnavailable")); return; }
    stopCamera();
    await processPhoto(new File([blob], "receipt-camera.jpg", { type: "image/jpeg" }));
  };

  const submitReceipt = async () => {
    if (!photo || !isAuthenticated || !b.rows.length || receiptBusy) return;
    setReceiptBusy(true); setReceiptError("");
    try {
      const result = await uploadReceipt({
        orderId: draft?.orderId ?? orderId(), store: selected,
        items: b.rows.map((r) => ({ slug: r.line.id, qty: r.line.qty, price: r.offer.price, cost: r.cost })),
        total: b.total, image: photo,
      });
      const receipt = result.receipt;
      const purchased = b.rows.map((r) => ({ slug: r.line.id, qty: r.line.qty, store: selected, price: r.offer.price }));
      recordPurchase(purchased, { status: "pending", receiptId: receipt.id, orderId: receipt.orderId });
      removeMany(purchased.map((r) => r.slug));
      setOff((cur) => { const next = new Set(cur); purchased.forEach((r) => next.delete(r.slug)); return next; });
      setStep("confirmed", { receiptId: receipt.id, store: selected });
      setPhoto("");
    } catch (error) {
      setReceiptError(t(error.message === "AUTH" ? "cart.receiptSignIn" : error.message === "OFFLINE" ? "cart.receiptOffline" : "cart.receiptSubmitError"));
    } finally { setReceiptBusy(false); }
  };

  const toggle = (id) => setOff((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const ladder = totals.map((s) => ({
    key: s.chain, label: s.chain === cheapest?.chain ? t("cart.cheapestPrice") : s.chain, total: s.total,
    partial: !s.complete, best: s.chain === cheapest?.chain,
    sub: `${s.chain} · ${s.complete ? t("p.cart.allItems") : t("p.cart.someItems", { a: s.covered, b: active.length })}`,
    delta: cheapest?.complete && s.complete ? s.total - cheapest.total : 0,
  }));

  const FLOW = { review: ["file", t("cart.reviewTitle")], route: ["navigation", t("cart.routeTitle")], receipt: ["image", t("cart.receiptTitle")], confirmed: ["clock", t("cart.receiptConfirmed")] };
  const flowOpen = Boolean(draft && FLOW[draft.step]);
  const [flowIcon, flowTitle] = FLOW[draft?.step] ?? ["check", ""];
  const closeFlow = () => {
    if (routeOpen) return;
    stopCamera();
    if (draft?.step === "confirmed") { setDraft({ orderId: orderId(), step: "cart", store: "", storeConfirmed: false, excluded: [], receiptId: null }); setMode(""); }
    else setStep("cart");
  };

  let body;
  if (status === "loading") body = <Skeleton h={300} r={20} />;
  else if (status === "error") body = <ErrorState onRetry={reload} />;
  else if (!items.length) body = <EmptyState icon="cart" title={t("cart.emptyTitle")} text={t("p.cart.emptyText")} action={<div className="nc-empty-actions"><Link to="/smart-buy" className="nt-btn nt-btn-primary"><Icon name="sparkles" size={16} />SmartBuy AI</Link><Link to="/" className="nt-btn nt-btn-ghost">{t("p.cart.browse")}</Link></div>} />;
  else body = (
    <div className="nc">
      <section className="nc-panel nt-glass" aria-label={t("cart.selected")}>
        <header className="nc-head">
          <h2>{t("cart.selected")}</h2>
          <span className="nc-count">{lines.length}</span>
          <button type="button" className="nc-clear" onClick={() => setConfirm(true)} disabled={!canEditCart}><Icon name="trash" size={15} /><span>{t("cart.deleteAll")}</span></button>
        </header>

        {/* the product list lives in its own scroll box */}
        <div className="nc-body">
          {gone.length > 0 && (
            <div className="nt-warn" role="alert">
              {t("p.cart.gone", { n: gone.length })}{" "}
              <button type="button" className="nt-link" onClick={() => gone.forEach((g) => removeItem(g.slug))}>{t("p.cart.removeGone")}</button>
            </div>
          )}
          {b.missing.length > 0 && <div className="nt-warn" role="status">{t("p.cart.missingAt", { s: selected, n: b.missing.length })}</div>}
          <ul className="nc-list">
            <AnimatePresence initial={false}>
              {lines.map((l) => {
                const row = view.rows.find((r) => r.line.id === l.id);
                const name = tProduct(l.product, "name");
                const was = row && row.regular > row.cost ? row.regular : null;
                const on = !excluded.has(l.id);
                return (
                  <motion.li key={l.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -24, transition: { duration: 0.18 } }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className={`nc-row ${row ? "" : "is-out"} ${on ? "" : "is-off"}`}>
                    {!isPhone && (
                      <label className="nc-check" title={t("cart.selectItem")}>
                        <input type="checkbox" checked={on} onChange={() => toggle(l.id)} disabled={!canEditCart} aria-label={`${t("cart.selectItem")}: ${name}`} />
                        <i aria-hidden="true"><Icon name="check" size={14} strokeWidth={3} /></i>
                      </label>
                    )}
                    <Link to={`/product/${l.id}`} className="nc-img" tabIndex={-1} onClick={previewClick(openPreview, l.product)}><img src={l.product.image} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} /></Link>
                    <div className="nc-info">
                      <Link to={`/product/${l.id}`} className="nc-name" onClick={previewClick(openPreview, l.product)}>{name}</Link>
                      <div className="nc-meta">
                        <span>{tUnit(l.product.unit)}</span>
                        {row ? (
                          <>
                            <span className="nc-chain">{row.offer.store}</span>
                            <span className="nc-unit">{formatPrice(row.offer.price)}</span>
                            {row.promo && <span className="nc-promo">{t("p.cart.promoApplied")}</span>}
                          </>
                        ) : <span className="is-warn">{t("p.unavailable")}</span>}
                      </div>
                    </div>
                    <div className="nc-qty">
                      <button type="button" onClick={() => setQty(l.id, l.qty - 1)} disabled={!canEditCart} aria-label={t("p.cart.dec")}><Icon name="minus" size={15} strokeWidth={2.4} /></button>
                      <output key={l.qty} aria-live="polite">{l.qty}</output>
                      <button type="button" onClick={() => setQty(l.id, Math.min(99, l.qty + 1))} disabled={!canEditCart} aria-label={t("p.cart.inc")}><Icon name="plus" size={15} strokeWidth={2.4} /></button>
                    </div>
                    <div className="nc-price">
                      <strong>{row ? formatPrice(row.cost) : "—"}</strong>
                      {was && <s>{formatPrice(was)}</s>}
                    </div>
                    <button type="button" className="nc-del" onClick={() => removeItem(l.id)} disabled={!canEditCart} aria-label={t("p.cart.remove")} title={t("p.cart.remove")}><Icon name="trash" size={16} /></button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>
      </section>

      <aside className="nc-side nt-glass" aria-label={t("p.cart.compare")}>
      <div className="nc-side-wrap">
      <div ref={sideRef} className="nc-side-scroll">
        <h3 className="nc-side-title"><Icon name="list" size={18} />{t("p.cart.compare")}</h3>

        <div className="nc-ladder-wrap">
        <div className="nc-ladder" role="radiogroup" aria-label={t("p.cart.compare")}>
          {ladder.map((o) => {
            const on = selected === o.key;
            return (
              <label key={o.key} className={`nc-opt ${on ? "is-on" : ""} ${o.best ? "is-best" : ""} ${o.partial ? "is-partial" : ""}`}>
                <input className="nc-opt-radio" type="radio" name="checkout-store" value={o.key} checked={on} onChange={() => setMode(o.key)} aria-label={`${o.label}: ${formatPrice(o.total)}`} />
                <span className="nc-opt-main">
                  <span className="nc-opt-ico" aria-hidden="true"><StoreMark chain={o.key} size={20} /></span>
                  <span className="nc-opt-txt">
                    <b>{o.label}</b>
                    <small className={o.partial ? "is-warn" : ""}>{o.sub}</small>
                  </span>
                  <span className="nc-opt-price">
                    <b>{formatPrice(o.total)}</b>
                    {o.delta > 0 && <small>+{formatPrice(o.delta)}</small>}
                  </span>
                  <span className="nc-opt-tick" aria-hidden="true">{on && <Icon name="check" size={13} strokeWidth={3} />}</span>
                </span>
              </label>
            );
          })}
        </div>
        </div>

        {!active.length && <p className="nt-note nc-pick" role="status">{t("cart.pickItems")}</p>}

        <div className="nc-sum">
          {b.discount > 0 && <dl className="nc-lines">
            {b.discount > 0 && <div className="is-promo"><dt>{t("p.cart.discounts")}</dt><dd>−{formatPrice(b.discount)}</dd></div>}
          </dl>}
          <p className="nt-note nc-note">{t("p.cart.noTransport")}</p>
          <dl className="nc-receipt nc-primary-total"><div className="nc-grand"><dt>{t("p.cart.total")}</dt><dd><Total value={b.total} className="nc-total" /></dd></div></dl>
          <button type="button" className="nt-btn nt-btn-primary nt-block nc-bought" onClick={() => setStep("choose", { store: selected, storeConfirmed: false })} disabled={!active.length}><Icon name="check" size={16} strokeWidth={2.6} />{t("cart.chooseStore")}</button>
        </div>
      </div>
      <ScrollBar targetRef={sideRef} axis="y" className="nc-side-bar" />
      </div>
      </aside>
      <CheckoutModal open={flowOpen} step={draft?.step} icon={flowIcon} title={flowTitle} onClose={closeFlow}>
        {draft?.step === "review" && <section className="nc-flow">
          <p className="nt-note">{t("cart.reviewStore", { store: selected })}</p>
          <ul className="nc-review-list">
            {active.map((line) => {
              const row = b.rows.find((r) => r.line.id === line.id);
              return <li key={line.id}>
                <img src={line.product.image} alt="" width="48" height="48" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                <span><b>{tProduct(line.product, "name")}</b><small>{line.qty} × {row ? formatPrice(row.offer.price) : "—"} · {row ? selected : t("p.unavailable")}</small></span>
                <strong>{row ? formatPrice(row.cost) : "—"}</strong>
              </li>;
            })}
          </ul>
          {b.missing.length > 0 && <p className="nt-warn" role="status">{t("p.cart.missingAt", { s: selected, n: b.missing.length })} {t("cart.reviewUnavailable")}</p>}
          <dl className="nc-receipt nc-primary-total"><div className="nc-grand"><dt>{t("p.cart.total")}</dt><dd><Total value={b.total} className="nc-total" /></dd></div></dl>
          <div className="nc-flow-actions"><button type="button" className="nt-btn nt-btn-ghost" onClick={() => setStep("choose")}>{t("cart.backEdit")}</button><button type="button" className="nt-btn nt-btn-primary" onClick={() => setStep("route", { store: selected })}>{t("cart.confirmReview")}</button></div>
        </section>}

        {draft?.step === "route" && <section className="nc-flow">
          <p>{t("cart.routeText", { store: selected })}</p>
          <button type="button" className="nt-btn nt-btn-ghost nt-block" onClick={() => setRouteOpen(true)}><Icon name="pin" size={17} />{t("rt.title", { c: selected })}</button>
          <dl className="nc-receipt nc-primary-total"><div className="nc-grand"><dt>{t("p.cart.total")}</dt><dd><Total value={b.total} className="nc-total" /></dd></div></dl>
          <div className="nc-flow-actions"><button type="button" className="nt-btn nt-btn-ghost" onClick={() => setStep("review")}>{t("cart.backEdit")}</button><button type="button" className="nt-btn nt-btn-primary" onClick={() => { setPhoto(""); setReceiptError(""); setStep("receipt"); void startCamera(); }}>{t("cart.markBought")}</button></div>
        </section>}

        {draft?.step === "receipt" && <section className="nc-flow">
          <p>{t("cart.receiptInstruction")}</p>
          {!isAuthenticated && <p className="nt-warn" role="alert">{t("cart.receiptSignIn")} <Link className="nt-link" to="/auth?next=%2Fcart">{t("nav.login")}</Link></p>}
          {photo ? <div className="nc-receipt-preview"><img src={photo} alt={t("cart.receiptPreview")} /><button type="button" className="nt-btn nt-btn-ghost" onClick={() => { setPhoto(""); setReceiptError(""); if (navigator.mediaDevices?.getUserMedia) void startCamera(); }}>{t("cart.receiptRetake")}</button></div> : <>
            {cameraState === "ready" && <div className="nc-camera"><video ref={videoRef} autoPlay muted playsInline aria-label={t("cart.cameraPreview")} /><div className="nc-flow-actions"><button type="button" className="nt-btn nt-btn-primary" onClick={captureCamera} disabled={photoBusy}>{t("cart.cameraCapture")}</button><button type="button" className="nt-btn nt-btn-ghost" onClick={stopCamera}>{t("cart.cameraClose")}</button></div></div>}
            {cameraState !== "ready" && <button type="button" className="nt-btn nt-btn-ghost" onClick={() => void startCamera()} disabled={cameraState === "opening"}>{cameraState === "opening" ? t("cart.cameraOpening") : t("cart.cameraOpen")}</button>}
            {cameraError && <p className="nt-note" role="status">{cameraError}</p>}
            <label className="nc-receipt-pick"><Icon name="image" size={24} /><span>{photoBusy ? t("cart.receiptCompressing") : t("cart.receiptChoose")}</span><input type="file" accept="image/*" capture="environment" onChange={choosePhoto} disabled={photoBusy} /></label>
          </>}
          {receiptError && <p className="nt-warn" role="alert">{receiptError}</p>}
          <p className="nt-note">{t("cart.receiptPrivacy")}</p>
          <div className="nc-flow-actions"><button type="button" className="nt-btn nt-btn-ghost" onClick={() => { stopCamera(); setStep("route"); }}>{t("cart.backEdit")}</button><button type="button" className="nt-btn nt-btn-primary" onClick={submitReceipt} disabled={!photo || !isAuthenticated || receiptBusy || photoBusy}>{receiptBusy ? t("cart.receiptSending") : t("cart.receiptSubmit")}</button></div>
        </section>}

        {draft?.step === "confirmed" && <section className="nc-flow nc-receipt-success" role="status">
          <span className="nc-success-icon is-pending"><Icon name="clock" size={30} /></span>
          <p>{t("cart.receiptReviewPending")}</p>
          <Link to="/account?tab=notifications" className="nt-btn nt-btn-ghost nt-block" onClick={() => { setDraft({ orderId: orderId(), step: "cart", store: "", excluded: [], receiptId: null }); setMode(""); }}><Icon name="bell" size={16} />{t("cart.viewNotifs")}</Link>
          <button type="button" className="nt-btn nt-btn-primary nt-block" onClick={() => { setDraft({ orderId: orderId(), step: "cart", store: "", excluded: [], receiptId: null }); setMode(""); }}>{t("cart.continueShopping")}</button>
        </section>}
      </CheckoutModal>
      <StoreChoiceModal
        open={draft?.step === "choose" && active.length > 0}
        options={ladder.map((o) => ({ key: o.key, total: o.total, best: o.best, partial: o.partial, delta: o.delta, coverage: o.partial ? t("p.cart.someItems", { a: totals.find((s) => s.chain === o.key)?.covered ?? 0, b: active.length }) : t("p.cart.allItems") }))}
        selected={selected} onSelect={setMode} savings={savings}
        onClose={() => setStep("cart")} onConfirm={() => setStep("review", { store: selected, storeConfirmed: true })}
      />
      {routeOpen && selected && <RouteModal chain={selected} onClose={closeRoute} />}

      <ConfirmDialog open={confirm} danger title={t("p.cart.clearTitle")} text={t("p.cart.clearText")} confirmLabel={t("p.cart.clear")} onCancel={() => setConfirm(false)} onConfirm={() => { clear(); setOff(new Set()); setConfirm(false); }} />
    </div>
  );

  return (
    <PageShell>
      <div className="nc-page">
        <motion.header className="nc-top" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
          <h1>{t("nav.cart")}</h1>
          <p>{t("cart.subtitle")}</p>
        </motion.header>
        <Gate>{body}</Gate>
      </div>
      {preview}
    </PageShell>
  );
}
