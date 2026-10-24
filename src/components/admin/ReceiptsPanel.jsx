import { useEffect, useMemo, useState } from "react";
import Icon from "../ui/Icon";
import { ImageViewer } from "../ui/ImageViewer";
import { useLang } from "../../context/LanguageContext";
import { useCatalog } from "../../context/CatalogContext";
import { formatPrice } from "../../lib/constants";
import { formatDateTime } from "../../lib/dates";
import { adminApi } from "../../services/admin";
import { toast } from "../../lib/toast";
import PrivateImage from "./PrivateImage";

const PAGE_SIZE = 25;

export default function ReceiptsPanel({ version, onChanged }) {
  const { t, lang, tProduct } = useLang();
  const { bySlug } = useCatalog();
  const [status, setStatus] = useState("pending");
  const [store, setStore] = useState("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [note, setNote] = useState("");
  const [viewer, setViewer] = useState(null);
  const query = useMemo(() => ({ status, store, search, since: from, until: to, limit: PAGE_SIZE }), [status, store, search, from, to]);

  useEffect(() => {
    let live = true;
    // Clear query-specific rows immediately so receipts from the previous filter cannot be reviewed.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(""); setRows([]); setNextCursor(null); setSelected(null); setBusy(true);
    adminApi.receipts(query).then((result) => {
      if (!live) return;
      setRows(result.receipts ?? []); setTotal(result.total ?? 0); setNextCursor(result.nextCursor ?? null);
    }).catch((e) => { if (live) setError(e.message); }).finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, [query, version, retry]);

  const more = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const result = await adminApi.receipts({ ...query, cursor: nextCursor });
      setRows((current) => [...current, ...(result.receipts ?? [])]); setNextCursor(result.nextCursor ?? null); setTotal(result.total ?? total);
    } catch (e) { setError(e.message); }
    finally { setLoadingMore(false); }
  };

  const choose = (row) => { setSelected(row); setNote(row.note ?? ""); };
  const review = async (nextStatus) => {
    if (!selected || busy) return;
    setBusy(true); setError("");
    try {
      const result = await adminApi.reviewReceipt(selected.id, nextStatus, note);
      const updated = result.receipt;
      setRows((current) => current.map((r) => r.id === updated.id ? updated : r)); setSelected(updated);
      onChanged?.(); toast(t(nextStatus === "approved" ? "admin.receipts.approvedToast" : "admin.receipts.rejectedToast"));
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const formatReceiptDate = (value) => formatDateTime(value, lang);

  return (
    <section className="adm-panel adm-receipts">
      <form className="adm-receipt-filters" onSubmit={(e) => e.preventDefault()}>
        <label><span>{t("admin.receipts.status")}</span><select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="pending">{t("admin.receipts.pending")}</option><option value="approved">{t("admin.receipts.approved")}</option><option value="rejected">{t("admin.receipts.rejected")}</option><option value="all">{t("admin.receipts.all")}</option>
        </select></label>
        <label><span>{t("admin.receipts.store")}</span><select value={store} onChange={(e) => setStore(e.target.value)}>
          <option value="all">{t("admin.receipts.all")}</option><option>Korzinka</option><option>Havas</option><option>Makro</option>
        </select></label>
        <label><span>{t("admin.receipts.search")}</span><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("admin.receipts.searchPlaceholder")} /></label>
        <label><span>{t("admin.receipts.from")}</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label><span>{t("admin.receipts.to")}</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </form>
      <p className="adm-receipt-count" aria-live="polite">{t("admin.receipts.total", { n: total })}</p>
      {error && <div className="adm-error" role="alert"><Icon name="alert" size={18} />{error}<button type="button" className="adm-btn is-sm" onClick={() => setRetry((n) => n + 1)}>{t("admin.receipts.retry")}</button></div>}
      {busy && !rows.length ? <div className="adm-loading" role="status"><Icon name="refresh" size={18} />{t("admin.receipts.loading")}</div> : !rows.length ? <div className="adm-empty"><Icon name="inbox" size={24} /><p>{t("admin.receipts.empty")}</p></div> : (
        <div className="adm-receipt-layout">
          <div className="adm-receipt-list">
            {rows.map((r) => <button type="button" key={r.id} className={`adm-receipt-row ${selected?.id === r.id ? "is-selected" : ""}`} onClick={() => choose(r)}>
              <PrivateImage id={r.id} alt={t("admin.receipts.photo")} />
              <span className="adm-receipt-row-main"><b>{r.store} · {formatPrice(r.total)}</b><small>{r.name || r.email || r.userId}</small><small>{formatReceiptDate(r.createdAt)}</small></span>
              <em className={`adm-receipt-status is-${r.status}`}>{t(`admin.receipts.${r.status}`)}</em>
            </button>)}
            {nextCursor && <button type="button" className="adm-btn" disabled={loadingMore} onClick={more}>{loadingMore ? t("admin.receipts.loading") : t("admin.receipts.next")}</button>}
          </div>
          {selected && <aside className="adm-receipt-detail" aria-label={t("admin.receipts.detail")}>
            <header><div><h2>{selected.store} · {formatPrice(selected.total)}</h2><p>{t("admin.receipts.submitted")}: {formatReceiptDate(selected.createdAt)}</p></div><button type="button" className="adm-icon-btn" onClick={() => setSelected(null)} aria-label={t("common.close")}><Icon name="x" size={17} /></button></header>
            <PrivateImage id={selected.id} alt={t("admin.receipts.photo")} className="is-large" openViewer={(src, alt) => setViewer({ src, alt })} />
            <dl className="adm-receipt-meta"><div><dt>{t("admin.receipts.user")}</dt><dd>{selected.name || selected.email || selected.userId}<small>{selected.email}</small></dd></div><div><dt>{t("admin.receipts.status")}</dt><dd>{t(`admin.receipts.${selected.status}`)}</dd></div><div><dt>{t("admin.receipts.claimedTotal")}</dt><dd>{formatPrice(selected.total)}</dd></div></dl>
            <h3>{t("admin.receipts.items")}</h3>
            <ul className="adm-receipt-items">{selected.items.map((item) => <li key={item.slug}><span>{tProduct(bySlug.get(item.slug) ?? { slug: item.slug, name: item.name || item.slug }, "name")} · {item.qty} × {formatPrice(item.price)}</span><b>{formatPrice(item.cost ?? item.qty * item.price)}</b></li>)}</ul>
            {selected.status === "pending" && <div className="adm-receipt-review"><label><span>{t("admin.receipts.note")}</span><textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></label><div><button type="button" className="adm-btn is-primary" disabled={busy} onClick={() => review("approved")}><Icon name="check" size={16} />{t("admin.receipts.approve")}</button><button type="button" className="adm-btn is-danger" disabled={busy} onClick={() => review("rejected")}><Icon name="x" size={16} />{t("admin.receipts.reject")}</button></div></div>}
            {selected.status !== "pending" && selected.note && <p className="adm-receipt-note">{selected.note}</p>}
          </aside>}
        </div>
      )}
      {viewer && <ImageViewer src={viewer.src} alt={viewer.alt} onClose={() => setViewer(null)} />}
    </section>
  );
}
