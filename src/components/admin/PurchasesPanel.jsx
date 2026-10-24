import { useEffect, useMemo, useState } from "react";

import Icon from "../ui/Icon";
import { ImageViewer } from "../ui/ImageViewer";
import PrivateImage from "./PrivateImage";
import { adminApi } from "../../services/admin";
import { avatarColor, fmtDateTime, spaced } from "./format";

const VIEWS = [["orders", "Cheklar", "image"], ["buyers", "Xaridorlar", "user"], ["products", "Mahsulotlar", "package"]];
const STATUS = { pending: "Kutilmoqda", approved: "Tasdiqlangan", rejected: "Rad etilgan" };
const som = (n) => `${spaced(Math.round(n))} UZS`;
const who = (r) => r.name || r.email || r.userId;

/* Admin → Purchase history. Every check (receipt) saved in MongoDB, who bought it and what was in it,
 * with roll-ups by buyer and by product. Rejected checks are excluded unless the status filter asks for them. */
export default function PurchasesPanel({ version }) {
  const [view, setView] = useState("orders");
  const [status, setStatus] = useState("all");
  const [store, setStore] = useState("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState(null);
  const [orders, setOrders] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [openBuyer, setOpenBuyer] = useState("");
  const [busy, setBusy] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [viewer, setViewer] = useState(null);
  const query = useMemo(() => ({ status, store, search, since: from, until: to, limit: 30 }), [status, store, search, from, to]);

  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(true); setError("");
    const timer = setTimeout(() => {
      adminApi.purchases(query).then((r) => {
        if (!live) return;
        setData(r); setOrders(r.orders ?? []); setCursor(r.nextCursor ?? null); setSelected(null);
      }).catch((e) => { if (live) setError(e.message); }).finally(() => { if (live) setBusy(false); });
    }, query.search ? 250 : 0);
    return () => { live = false; clearTimeout(timer); };
  }, [query, version, retry]);

  const loadMore = async () => {
    if (!cursor || more) return;
    setMore(true);
    try { const r = await adminApi.purchases({ ...query, cursor }); setOrders((cur) => [...cur, ...(r.orders ?? [])]); setCursor(r.nextCursor ?? null); }
    catch (e) { setError(e.message); }
    finally { setMore(false); }
  };

  const sum = data?.summary;
  return (
    <section className="adm-panel adp">
      <div className="adp-stats">
        {[["Cheklar", sum?.orders, "image"], ["Xaridorlar", sum?.buyers, "user"], ["Jami summa", sum && som(sum.spent), "wallet"], ["O‘rtacha chek", sum && som(sum.avgOrder), "chart"], ["Sotib olingan dona", sum?.units, "package"]].map(([label, value, icon]) => (
          <div key={label} className="adp-stat"><span><Icon name={icon} size={18} /></span><div><small>{label}</small><b>{value ?? "—"}</b></div></div>
        ))}
      </div>

      <form className="adp-filters" onSubmit={(e) => e.preventDefault()}>
        <div className="adp-tabs" role="tablist">
          {VIEWS.map(([k, label, icon]) => <button key={k} type="button" role="tab" aria-selected={view === k} className={view === k ? "is-on" : ""} onClick={() => setView(k)}><Icon name={icon} size={15} />{label}</button>)}
        </div>
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Xaridor yoki mahsulot qidirish…" aria-label="Qidirish" />
        <select value={store} onChange={(e) => setStore(e.target.value)} aria-label="Do‘kon"><option value="all">Barcha do‘konlar</option><option>Korzinka</option><option>Havas</option><option>Makro</option></select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Holat"><option value="all">Rad etilmaganlar</option><option value="pending">Kutilmoqda</option><option value="approved">Tasdiqlangan</option><option value="rejected">Rad etilgan</option></select>
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Boshlanish sanasi" />
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Tugash sanasi" />
      </form>

      {error && <div className="adm-error" role="alert"><Icon name="alert" size={18} />{error}<button type="button" className="adm-btn is-sm" onClick={() => setRetry((n) => n + 1)}>Qayta urinish</button></div>}
      {busy && !data ? <div className="adm-loading" role="status"><Icon name="refresh" size={18} />Yuklanmoqda…</div> : !data?.total && !busy ? <div className="adm-empty"><Icon name="inbox" size={24} /><p>Hozircha xaridlar yo‘q.</p></div> : data && (
        <>
          {view === "orders" && (
            <div className="adp-layout">
              <div className="adp-list">
                {orders.map((r) => (
                  <button type="button" key={r.id} className={`adp-order ${selected?.id === r.id ? "is-selected" : ""}`} onClick={() => setSelected(r)}>
                    <PrivateImage id={r.id} alt="Chek" />
                    <span className="adp-order-main">
                      <b>{who(r)}</b>
                      <small>{r.items.slice(0, 3).map((i) => `${i.name} × ${i.qty}`).join(", ")}{r.items.length > 3 ? ` +${r.items.length - 3}` : ""}</small>
                      <small>{r.store} · {fmtDateTime(r.createdAt)}</small>
                    </span>
                    <span className="adp-order-side"><b>{som(r.total)}</b><em className={`adm-receipt-status is-${r.status}`}>{STATUS[r.status]}</em></span>
                  </button>
                ))}
                {cursor && <button type="button" className="adm-btn" disabled={more} onClick={loadMore}>{more ? "Yuklanmoqda…" : "Yana ko‘rsatish"}</button>}
              </div>
              {selected && (
                <aside className="adp-detail" aria-label="Chek tafsilotlari">
                  <header><div><h2>{selected.store} · {som(selected.total)}</h2><p>{fmtDateTime(selected.createdAt)} · №{selected.orderId.slice(0, 8)}</p></div><button type="button" className="adm-icon-btn" onClick={() => setSelected(null)} aria-label="Yopish"><Icon name="x" size={17} /></button></header>
                  <PrivateImage id={selected.id} alt="Chek rasmi" className="is-large" openViewer={(src, alt) => setViewer({ src, alt })} />
                  <dl className="adp-buyer"><div><dt>Xaridor</dt><dd>{who(selected)}{selected.email && selected.name && <small>{selected.email}</small>}</dd></div><div><dt>Holat</dt><dd>{STATUS[selected.status]}</dd></div></dl>
                  <h3>Nima sotib olingan</h3>
                  <ul className="adp-items">{selected.items.map((i) => <li key={i.slug}><span>{i.name}<small>{i.qty} × {som(i.price)}</small></span><b>{som(i.qty * i.price)}</b></li>)}</ul>
                  <p className="adp-total"><span>Jami</span><b>{som(selected.total)}</b></p>
                  {selected.note && <p className="adm-receipt-note">{selected.note}</p>}
                </aside>
              )}
            </div>
          )}

          {view === "buyers" && (
            <ul className="adp-buyers">
              {data.buyers.map((b) => (
                <li key={b.userId} className={openBuyer === b.userId ? "is-open" : ""}>
                  <button type="button" onClick={() => setOpenBuyer(openBuyer === b.userId ? "" : b.userId)} aria-expanded={openBuyer === b.userId}>
                    <span className="adp-ava" style={{ background: avatarColor(b.userId) }}>{(b.name || b.email || "?").slice(0, 1).toUpperCase()}</span>
                    <span className="adp-buyer-main"><b>{b.name || b.email || b.userId}</b><small>{b.orders} ta chek · {b.units} dona · {b.stores.join(", ")} · oxirgi: {fmtDateTime(b.lastAt)}</small></span>
                    <b className="adp-money">{som(b.spent)}</b>
                    <Icon name="arrowRight" size={16} className="adp-caret" />
                  </button>
                  {openBuyer === b.userId && <ul className="adp-items adp-sub">{b.items.map((i) => <li key={i.slug}><span>{i.name}<small>{i.qty} dona</small></span><b>{som(i.spent)}</b></li>)}</ul>}
                </li>
              ))}
            </ul>
          )}

          {view === "products" && (
            <ul className="adp-products">
              {data.products.map((p, i) => (
                <li key={p.slug}><span className="adp-rank">{i + 1}</span><span className="adp-buyer-main"><b>{p.name}</b><small>{p.buyers} xaridor · {Object.entries(p.stores).map(([s, q]) => `${s} ${q}`).join(" · ")}</small></span><span className="adp-qty">{p.qty} dona</span><b className="adp-money">{som(p.spent)}</b></li>
              ))}
            </ul>
          )}
        </>
      )}
      {viewer && <ImageViewer src={viewer.src} alt={viewer.alt} onClose={() => setViewer(null)} />}
    </section>
  );
}
