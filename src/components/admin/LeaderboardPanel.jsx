import { useEffect, useMemo, useState } from "react";
import Icon from "../ui/Icon";
import { adminApi } from "../../services/admin";
import { avatarColor, fmtDateTime, spaced } from "./format";

const STORES = ["Havas", "Korzinka", "Makro"];
const money = (value) => spaced(Math.round(Number(value) || 0)) + " UZS";

export default function LeaderboardPanel({ version }) {
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      setBusy(true);
      setError("");
      adminApi.leaderboard(search.trim()).then((result) => {
        if (live) setData(result);
      }).catch((e) => {
        if (live) setError(e.message || "Reytingni yuklab bo‘lmadi.");
      }).finally(() => { if (live) setBusy(false); });
    }, search ? 220 : 0);
    return () => { live = false; clearTimeout(timer); };
  }, [search, version, retry]);

  const rows = data?.leaderboard ?? [];
  const summary = useMemo(() => rows.reduce((all, user) => ({
    buyers: all.buyers + 1,
    orders: all.orders + user.orders,
    spent: all.spent + user.spent,
    threeStores: all.threeStores + Number(user.storeCount === 3),
  }), { buyers: 0, orders: 0, spent: 0, threeStores: 0 }), [rows]);

  return (
    <section className="adm-panel adl">
      <div className="adl-intro">
        <div>
          <span className="adm-eyebrow"><Icon name="crown" size={16} /> Xaridorlar reytingi</span>
          <p>Avval uchala supermarketdan xarid qilganlar, keyin xaridlar soni va jami sarf bo‘yicha tartiblangan.</p>
        </div>
        <div className="adl-order-note"><Icon name="badgeCheck" size={17} /> Rad etilmagan cheklar hisobga olinadi</div>
      </div>

      <div className="adl-stats">
        <div><span><Icon name="user" size={17} /></span><small>Xaridorlar</small><b>{summary.buyers}</b></div>
        <div><span><Icon name="cart" size={17} /></span><small>Jami xaridlar</small><b>{summary.orders}</b></div>
        <div><span><Icon name="store" size={17} /></span><small>3 do‘kondan xarid qilganlar</small><b>{summary.threeStores}</b></div>
        <div><span><Icon name="wallet" size={17} /></span><small>Jami sarflangan</small><b>{money(summary.spent)}</b></div>
      </div>

      <label className="adl-search">
        <Icon name="search" size={18} />
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Foydalanuvchi ismi yoki emailini qidiring…" />
        {search && <button type="button" onClick={() => setSearch("")} aria-label="Qidiruvni tozalash"><Icon name="x" size={16} /></button>}
      </label>

      {error && <div className="adm-error" role="alert"><Icon name="alert" size={18} />{error}<button type="button" className="adm-btn is-sm" onClick={() => setRetry((n) => n + 1)}>Qayta urinish</button></div>}
      {busy && !data ? <div className="adm-loading" role="status"><Icon name="refresh" size={18} />Yuklanmoqda…</div>
        : !rows.length && !busy ? <div className="adm-empty"><Icon name="chart" size={24} /><p>{search ? "Qidiruv bo‘yicha xaridor topilmadi." : "Hozircha reyting uchun xaridlar yo‘q."}</p></div>
          : data && (
            <div className="adl-table-wrap">
              <table className="adl-table">
                <thead>
                  <tr><th>O‘rin</th><th>Foydalanuvchi</th><th>Supermarketlar</th>{STORES.map((store) => <th key={store}>{store}</th>)}<th>Umumiy xaridlar</th></tr>
                </thead>
                <tbody>
                  {rows.map((user, index) => (
                    <tr key={user.userId}>
                      <td><span className={"adl-rank " + (index < 3 ? "is-top is-top-" + (index + 1) : "")}>{index + 1}</span></td>
                      <td><div className="adl-user"><span style={{ background: avatarColor(user.userId) }}>{(user.name || user.email || "?").slice(0, 1).toUpperCase()}</span><div><b>{user.name || user.email || user.userId}</b><small>{user.email}</small></div></div></td>
                      <td><span className={"adl-coverage " + (user.storeCount === 3 ? "is-complete" : "")}>{user.storeCount} / 3</span></td>
                      {STORES.map((store) => {
                        const value = user.stores?.[store] ?? { orders: 0, spent: 0 };
                        return <td key={store} className={value.orders ? "" : "is-zero"}><b>{value.orders} ta xarid</b><small>{money(value.spent)}</small></td>;
                      })}
                      <td className="adl-overall"><b>{user.orders} ta xarid</b><small>{money(user.spent)}</small><small>Oxirgi: {user.lastAt ? fmtDateTime(user.lastAt) : "—"}</small></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
    </section>
  );
}
