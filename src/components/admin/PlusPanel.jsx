import { useEffect, useMemo, useState } from "react";

import Icon from "../ui/Icon";
import { Skeleton } from "../ui/States";
import { toast } from "../../lib/toast";
import { adminApi } from "../../services/admin";
import { fmtDate, timeAgo } from "./format";
import { useLang } from "../../context/LanguageContext";
import { displayPremiumName } from "../../../shared/translations.js";

const UNITS = [["days", "Kun"], ["months", "Oy"]];

/* Admin → Plus: the plan (price / benefits), a user directory for gifting access, gift-card fulfilment and members.
 * Data: GET /api/plus/admin/overview. Uzbek only, like the rest of the admin panel. */
export default function PlusPanel({ version }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const reload = () => setTick((n) => n + 1);

  useEffect(() => {
    let off = false;
    adminApi.plusOverview().then((d) => { if (!off) { setData({ ...d, plan: { ...d.plan, name: "NarxTop Premium", description: displayPremiumName(d.plan?.description ?? ""), features: (d.plan?.features ?? []).map(displayPremiumName) } }); setError(""); } }).catch((e) => { if (!off) setError(e.message); });
    return () => { off = true; };
  }, [tick, version]);

  if (error && !data) {
    return <div className="adm-card adm-error" role="alert"><Icon name="alert" size={22} /><div><h3>Premium ma’lumotlarini yuklab bo‘lmadi</h3><p>{error}</p></div><button type="button" className="adm-btn" onClick={reload}><Icon name="refresh" size={16} />Qayta urinish</button></div>;
  }
  if (!data) return <div className="adm-skels">{[0, 1, 2].map((i) => <Skeleton key={i} h={120} r={20} />)}</div>;

  return (
    <section className="adm-panel adm-plus">
      <Stats stats={data.stats} />
      <div className="adm-plus-grid">
        <PlanCard plan={data.plan} onSaved={reload} />
        <GiftAccessCard users={data.users} ready={data.usersDirectoryReady} onDone={reload} />
        <SubscriptionAccessCard users={data.users} onDone={reload} />
      </div>
      <GiftCardsCard version={version + tick} onDone={reload} />
      <MembersCard subscriptions={data.subscriptions} />
    </section>
  );
}

function Stats({ stats }) {
  const items = [["badgeCheck", "Faol a’zolar", stats.active], ["user", "Jami obunalar", stats.total], ["gift", "Berilishi kerak sovg‘alar", stats.giftsPending]];
  return (
    <div className="adm-plus-stats">
      {items.map(([icon, label, n]) => <div key={label} className="adm-card"><Icon name={icon} size={20} /><strong>{n}</strong><span>{label}</span></div>)}
    </div>
  );
}

function PlanCard({ plan, onSaved }) {
  const [price, setPrice] = useState(plan.price ?? "");
  const [description, setDescription] = useState(plan.description ?? "");
  const [features, setFeatures] = useState((plan.features ?? []).join("\n"));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await adminApi.plusSavePlan({ price: Number(price), description, features: features.split("\n").map((s) => s.trim()).filter(Boolean) });
      toast("Premium rejasi saqlandi");
      onSaved();
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  };
  return (
    <section className="adm-card">
      <header className="adm-card-head"><h3><Icon name="crown" size={18} />Premium rejasi</h3></header>
      <div className="adm-plus-form">
        <label className="adm-field"><span>Oylik narx (so‘m)</span><input type="number" min="1" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Masalan: 29900" /></label>
        <label className="adm-field"><span>Qisqa tavsif</span><textarea rows={2} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Premium sahifasida ko‘rinadi (bo‘sh qoldirsangiz — standart matn)" /></label>
        <label className="adm-field"><span>Qo‘shimcha imkoniyatlar (har qatorda bittadan)</span><textarea rows={3} value={features} onChange={(e) => setFeatures(e.target.value)} /></label>
        <p className="adm-logo-hint">Bepul sinov: {plan.trialMonths} oy (har bir hisobga bir marta). To‘lov Click ulangandan keyin yoqiladi.</p>
        <button type="button" className="adm-btn is-primary" disabled={busy || !Number(price)} onClick={save}><Icon name="check" size={16} />Saqlash</button>
      </div>
    </section>
  );
}

function GiftAccessCard({ users, ready, onDone }) {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState(null);
  const [unit, setUnit] = useState("days");
  const [amount, setAmount] = useState(7);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const found = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? users.filter((u) => (u.email || "").toLowerCase().includes(s) || (u.name || "").toLowerCase().includes(s) || (u.username || "").toLowerCase().includes(s)).slice(0, 6) : [];
  }, [users, q]);
  const give = async () => {
    setBusy(true);
    try {
      await adminApi.plusGift({ userId: picked.id, email: picked.email, name: picked.name, unit, amount: Number(amount), message: message.trim() });
      toast(`${picked.email || picked.name}: ${amount} ${unit === "months" ? "oy" : "kun"} Premium berildi`);
      setPicked(null); setQ(""); setMessage("");
      onDone();
    } catch (e) { toast(e.message); } finally { setBusy(false); }
  };
  return (
    <section className="adm-card">
      <header className="adm-card-head"><h3><Icon name="gift" size={18} />Premium vaqtini sovg‘a qilish</h3></header>
      {!ready && <p className="adm-logo-hint">Foydalanuvchilar ro‘yxati hali bo‘sh. Odamlar NarxTop’da ro‘yxatdan o‘tganda ular shu yerda ko‘rinadi.</p>}
      {picked ? (
        <div className="adm-plus-picked">
          <div><b>{picked.name || (picked.email || "").split("@")[0]}</b><small>{picked.email}</small>{picked.subscription?.active && <em className="adm-tag">Premium · {picked.subscription.daysLeft} kun</em>}</div>
          <button type="button" className="adm-icon-btn" onClick={() => setPicked(null)} aria-label="Boshqa foydalanuvchi"><Icon name="x" size={16} /></button>
        </div>
      ) : (
        <>
          <label className="adm-search"><Icon name="search" size={17} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Email, ism yoki username bo‘yicha qidirish" aria-label="Foydalanuvchini qidirish" /></label>
          <ul className="adm-plus-found">
            {found.map((u) => <li key={u.id}><button type="button" onClick={() => setPicked(u)}><b>{u.name || (u.email || "").split("@")[0]}</b><small>{u.email}{u.username ? ` · @${u.username.replace(/^@/, "")}` : ""}</small>{u.subscription?.active && <em className="adm-tag">Premium</em>}</button></li>)}
            {q.trim() && found.length === 0 && <li className="adm-logo-hint">Hech kim topilmadi.</li>}
          </ul>
        </>
      )}
      <div className="adm-plus-give">
        <div className="adm-seg" role="radiogroup" aria-label="Birlik">
          {UNITS.map(([k, label]) => <button key={k} type="button" role="radio" aria-checked={unit === k} className={unit === k ? "is-on" : ""} onClick={() => setUnit(k)}>{label}</button>)}
        </div>
        <input className="adm-select" type="number" min="1" max={unit === "months" ? 24 : 365} value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Miqdor" />
        <button type="button" className="adm-btn is-primary" disabled={!picked || busy || !(Number(amount) >= 1) || Number(amount) > (unit === "months" ? 24 : 365)} onClick={give}><Icon name="gift" size={16} />Berish</button>
      </div>
      <label className="adm-field adm-plus-message"><span>Foydalanuvchiga xabar (ixtiyoriy)</span><textarea rows={3} maxLength={500} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Bu xabar foydalanuvchining bildirishnomasida ko‘rinadi" /></label>
      <p className="adm-logo-hint">Faol bo‘lsa — mavjud muddatga qo‘shiladi. “Oy” tanlansa, har oy uchun tasodifiy supermarket sovg‘asi yoziladi.</p>
    </section>
  );
}

function SubscriptionAccessCard({ users, onDone }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState(null);
  const [busy, setBusy] = useState(false);
  const found = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    return needle ? users.filter((u) => [u.email, u.username, u.name].some((value) => String(value ?? "").toLocaleLowerCase().includes(needle))).slice(0, 6) : [];
  }, [users, query]);

  const revoke = async () => {
    if (!picked?.subscription?.active) return;
    setBusy(true);
    try {
      const result = await adminApi.revokePlus(picked.id);
      setPicked((current) => current ? { ...current, subscription: result.subscription } : current);
      toast("NarxTop Premium obunasi bekor qilindi");
      onDone();
    } catch (error) {
      toast(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="adm-card adm-plus-access">
      <header className="adm-card-head"><h3><Icon name="user" size={18} />Premium obunasini boshqarish</h3></header>
      {picked ? (
        <div className="adm-plus-access-user">
          <div className="adm-plus-picked">
            <div><b>{picked.name || (picked.email || "").split("@")[0] || picked.id}</b><small>{picked.email}{picked.username ? ` · @${picked.username.replace(/^@/, "")}` : ""}</small></div>
            <button type="button" className="adm-icon-btn" onClick={() => setPicked(null)} aria-label="Boshqa foydalanuvchini tanlash"><Icon name="x" size={16} /></button>
          </div>
          <p className="adm-plus-status">
            {picked.subscription?.active ? `Faol obuna · ${picked.subscription.daysLeft} kun qoldi` : picked.subscription?.status === "revoked" ? "Obuna administrator tomonidan bekor qilingan" : picked.subscription ? "Obuna muddati tugagan" : "Faol Premium obunasi yo‘q"}
          </p>
          {picked.subscription?.active && <button type="button" className="adm-btn is-danger adm-plus-revoke" disabled={busy} onClick={revoke}><Icon name="x" size={17} />{busy ? "Bekor qilinmoqda…" : "NarxTop Premium obunasini bekor qilish"}</button>}
        </div>
      ) : (
        <>
          <label className="adm-search"><Icon name="search" size={17} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Email yoki username bo‘yicha qidirish" aria-label="Email yoki username bo‘yicha foydalanuvchini qidirish" /></label>
          <ul className="adm-plus-found">
            {found.map((user) => <li key={user.id}><button type="button" onClick={() => setPicked(user)}><b>{user.name || (user.email || "").split("@")[0] || user.id}</b><small>{user.email}{user.username ? ` · @${user.username.replace(/^@/, "")}` : ""}</small><em className={`adm-tag ${user.subscription?.active ? "is-active" : ""}`}>{user.subscription?.active ? `Premium · ${user.subscription.daysLeft} kun` : user.subscription?.status === "revoked" ? "bekor qilingan" : "Premium yo‘q"}</em></button></li>)}
            {query.trim() && found.length === 0 && <li className="adm-logo-hint">Hech kim topilmadi.</li>}
          </ul>
          <p className="adm-logo-hint">Foydalanuvchi topilgach, obuna holati ko‘rinadi va faol Premium obunasi bekor qilinishi mumkin.</p>
        </>
      )}
    </section>
  );
}

function GiftCardsCard({ version, onDone }) {
  const { t } = useLang();
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const requestKey = JSON.stringify([all, page, query.trim(), version]);
  const [response, setResponse] = useState({ key: "", status: "loading", data: { gifts: [], total: 0, pending: 0 }, error: "" });
  useEffect(() => {
    let off = false;
    adminApi.plusGifts({ offset: page * pageSize, limit: pageSize, pending: !all, q: query.trim() })
      .then((data) => { if (!off) setResponse({ key: requestKey, status: "ready", data, error: "" }); })
      .catch((e) => { if (!off) setResponse({ key: requestKey, status: "error", data: { gifts: [], total: 0, pending: 0 }, error: e.message }); });
    return () => { off = true; };
  }, [all, page, pageSize, query, requestKey]);
  const loading = response.key !== requestKey || response.status === "loading";
  const error = response.key === requestKey && response.status === "error" ? response.error : "";
  const result = response.key === requestKey && response.status === "ready" ? response.data : { gifts: [], total: 0, pending: 0 };
  const list = result.gifts ?? [];
  const pageCount = Math.max(1, Math.ceil((result.total ?? 0) / pageSize));
  const issue = async (g) => {
    setBusy(g.id);
    try { await adminApi.plusIssueGift(g.id); toast("Sovg‘a berilgan deb belgilandi"); onDone(); } catch (e) { toast(e.message); } finally { setBusy(""); }
  };
  return (
    <details className="adm-card adm-gifts">
      <summary className="adm-card-head"><h3><Icon name="gift" size={18} />{t("admin.gifts.title")}</h3><span className="adm-tag">{result.pending}</span><Icon name="chevronDown" size={16} className="adm-gift-chevron" /></summary>
      <div className="adm-gift-tools">
        <button type="button" className="adm-link" onClick={() => { setAll((v) => !v); setPage(0); }}>{all ? t("admin.gifts.pending") : t("admin.gifts.all")}</button>
        <input type="search" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder={t("admin.gifts.searchPlaceholder")} aria-label={t("admin.gifts.search")} />
      </div>
      {error && <p className="adm-error" role="alert">{error} <button type="button" className="adm-link" onClick={() => onDone()}>{t("admin.gifts.retry")}</button></p>}
      {loading ? <p className="adm-logo-hint" role="status">{t("admin.gifts.loading")}</p> : list.length === 0 ? <p className="adm-logo-hint">{t("admin.gifts.empty")}</p> : (
        <ul className="adm-plus-rows adm-gift-rows">
          {list.map((g) => (
            <li key={g.id}>
              <span className="adm-plus-store">{g.store}</span>
              <div><b>{g.name || (g.email || "").split("@")[0] || g.userId}</b><small>{g.email} · {g.period} {t("admin.gifts.month")} · {fmtDate(g.dueAt)}</small></div>
              {g.issuedAt ? <em className="adm-tag">{t("admin.gifts.issued")} · {timeAgo(g.issuedAt)}</em> : <button type="button" className="adm-icon-btn is-sm" disabled={busy === g.id} onClick={() => issue(g)} aria-label={t("admin.gifts.issue")} title={t("admin.gifts.issue")}><Icon name="check" size={15} /></button>}
            </li>
          ))}
        </ul>
      )}
      {(result.total ?? 0) > 0 && <div className="adm-gift-pages"><span>{t("admin.gifts.count", { a: page * pageSize + 1, b: Math.min(page * pageSize + list.length, result.total), n: result.total })}</span><button type="button" className="adm-link" disabled={!page} onClick={() => setPage((p) => p - 1)}>{t("admin.gifts.previous")}</button><span>{page + 1} / {pageCount}</span><button type="button" className="adm-link" disabled={page + 1 >= pageCount} onClick={() => setPage((p) => p + 1)}>{t("admin.gifts.next")}</button></div>}
    </details>
  );
}

function MembersCard({ subscriptions }) {
  return (
    <section className="adm-card">
      <header className="adm-card-head"><h3><Icon name="badgeCheck" size={18} />Obunachilar</h3></header>
      {subscriptions.length === 0 ? <p className="adm-logo-hint">Hali obuna yo‘q.</p> : (
        <ul className="adm-plus-rows">
          {subscriptions.slice(0, 100).map((s) => (
            <li key={s.userId}>
              <span className={`adm-plus-dot ${s.active ? "is-on" : ""}`} aria-hidden="true" />
              <div><b>{s.name || (s.email || "").split("@")[0] || s.userId}</b><small>{s.email} · {s.source === "launch-trial" ? "sinov" : s.source === "admin-gift" ? "sovg‘a" : s.source || "—"}</small></div>
              <span className="adm-plus-until">{s.active ? `${s.daysLeft} kun qoldi` : s.status === "revoked" ? "bekor qilingan" : "tugagan"}<small>{fmtDate(s.expiresAt)}</small></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
