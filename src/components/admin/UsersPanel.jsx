import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "../ui/Icon";
import { Skeleton } from "../ui/States";
import SafeImg from "./SafeImg";
import { Flag } from "../auth/PhoneField";
import { countryName, onlyDigits } from "../../lib/phone";
import { toast } from "../../lib/toast";
import { isAdminEmail } from "../../lib/admin";
import { adminApi } from "../../services/admin";
import { avatarColor, fmtDate, timeAgo } from "./format";

const SORTS = [["active", "Oxirgi faol"], ["new", "Yangi qo‘shilgan"], ["visits", "Eng faol"]];
const PROVIDERS = [["", "Hammasi"], ["google", "Google"], ["email", "Gmail / parol"]];
const stamp = (iso) => (iso ? new Date(iso).getTime() || 0 : 0);

/* Permanent account deletion: a CEO / Admin must type the account's email (or username) and tick the checkbox. */
function DeleteUserDialog({ user, busy, error, onConfirm, onCancel }) {
  const [typed, setTyped] = useState("");
  const [sure, setSure] = useState(false);
  const input = useRef(null);
  const cancel = useRef(onCancel);
  const isBusy = useRef(busy);
  useEffect(() => { cancel.current = onCancel; isBusy.current = busy; }, [onCancel, busy]);
  useEffect(() => {
    if (!user) return undefined;
    const opener = document.activeElement;
    input.current?.focus();
    const esc = (e) => e.key === "Escape" && !isBusy.current && cancel.current();
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("keydown", esc); opener?.focus?.(); };
  }, [user]);

  const word = user ? (user.email || user.username || "").trim() : "";
  const label = user ? user.name || user.username || (user.email || "—").split("@")[0] : "";
  const match = word !== "" && typed.trim().toLowerCase() === word.toLowerCase();
  const ready = match && sure && !busy;
  return (
    <AnimatePresence>
      {user && (
        <motion.div className="adm-confirm-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
          <motion.div role="alertdialog" aria-modal="true" aria-labelledby="adm-del-title" className="adm-confirm is-user adm-del" initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.97 }} transition={{ type: "spring", stiffness: 360, damping: 30 }}>
            <span className="adm-confirm-ico" aria-hidden="true"><Icon name="trash" size={26} /></span>
            <h3 id="adm-del-title">Akkauntni butunlay o‘chirasizmi?</h3>
            <div className="adm-confirm-person">
              <span className="adm-ava" style={{ background: avatarColor(user.email) }}><SafeImg src={user.avatar} fallback={(label || "?").slice(0, 1).toUpperCase()} /></span>
              <span><b>{label}</b><small>{user.email || user.username}</small></span>
            </div>
            <ul className="adm-del-list">
              <li>Profil, rasm va kirish ma’lumotlari MongoDB’dan o‘chadi</li>
              <li>Savat, sevimlilar, qidiruv tarixi, cheklar va bildirishnomalar o‘chadi</li>
              <li>Plus obunasi va uning tarixi o‘chadi</li>
              <li>Foydalanuvchining yuborgan xabarlari ham o‘chadi</li>
            </ul>
            <p className="adm-confirm-warn"><Icon name="alert" size={16} />Bu amalni qaytarib bo‘lmaydi. Foydalanuvchi qayta ro‘yxatdan o‘tishi mumkin, lekin eski ma’lumotlari tiklanmaydi.</p>
            <label className="adm-del-field">
              <span>Tasdiqlash uchun <b>{word}</b> ni yozing</span>
              <input ref={input} value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={word} autoComplete="off" autoCapitalize="off" spellCheck={false} disabled={busy} aria-invalid={typed !== "" && !match} />
            </label>
            <label className="adm-del-check"><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} disabled={busy} /><span>Men bu akkaunt butunlay o‘chirilishini tushunaman</span></label>
            {error && <p className="adm-del-error" role="alert">{error}</p>}
            <div className="adm-confirm-actions">
              <button type="button" className="adm-btn" onClick={onCancel} disabled={busy}>Bekor qilish</button>
              <button type="button" className="adm-btn is-danger-solid" onClick={() => onConfirm(typed.trim())} disabled={!ready}><Icon name="trash" size={16} />{busy ? "O‘chirilmoqda…" : "Butunlay o‘chirish"}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function UsersPanel({ version, role: viewerRole = "admin" }) {
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState(null);
  const menuRef = useRef(null);
  const [users, setUsers] = useState(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("active");
  const [prov, setProv] = useState("");
  const [shown, setShown] = useState(100);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [removing, setRemoving] = useState(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState("");

  useEffect(() => {
    if (!openMenu) return undefined;
    const close = (event) => { if (!menuRef.current?.contains(event.target)) setOpenMenu(null); };
    const escape = (event) => event.key === "Escape" && setOpenMenu(null);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [openMenu]);

  useEffect(() => {
    let off = false;
    adminApi.users().then((u) => { if (!off) { setUsers(u); setError(""); setNow(Date.now()); } }).catch((e) => { if (!off) setError(e.message); });
    return () => { off = true; };
  }, [tick, version]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rows = (users ?? []).filter((u) => (!prov || (prov === "google" ? u.provider === "google" : u.provider !== "google")) && (!s || (u.email || "").includes(s) || (u.name || "").toLowerCase().includes(s) || (u.phoneText || "").toLowerCase().includes(s) || (onlyDigits(s) && (u.phone || "").includes(onlyDigits(s))) || (u.phoneCountry && (countryName(u.phoneCountry, "uz").toLowerCase().includes(s) || countryName(u.phoneCountry, "en").toLowerCase().includes(s)))));
    const by = { active: (a, b) => stamp(b.lastSeenAt) - stamp(a.lastSeenAt), new: (a, b) => stamp(b.createdAt) - stamp(a.createdAt), visits: (a, b) => b.signIns - a.signIns };
    return [...rows].sort(by[sort]);
  }, [users, q, sort, prov]);

  const activeToday = (users ?? []).filter((u) => now - stamp(u.lastSeenAt) < 86400000).length;
  const googleCount = (users ?? []).filter((u) => u.provider === "google").length;

  const act = async (fn) => { setBusy(true); try { await fn(); } catch (e) { toast(e.message); } finally { setBusy(false); } };
  const exportCsv = () => act(async () => { toast(`${await adminApi.download("users")} yuklab olindi`); });
  const copyEmails = () => act(async () => {
    await navigator.clipboard.writeText(list.map((u) => u.email).filter(Boolean).join(", "));
    toast(`${list.length} ta gmail nusxalandi`);
  });

  const canDelete = (u) => {
    const r = (u.role === "ceo" || u.isCeo || isAdminEmail(u.email)) ? "ceo" : u.role ?? (u.isAdmin ? "admin" : "user");
    if (r === "ceo") return false;
    if (r === "superadmin") return viewerRole === "ceo";
    if (r === "admin") return viewerRole === "ceo" || viewerRole === "superadmin";
    return viewerRole === "ceo" || viewerRole === "superadmin" || viewerRole === "admin";
  };
  const closeRemove = () => { if (!removeBusy) { setRemoving(null); setRemoveError(""); } };
  const doRemove = async (typed) => {
    if (!removing) return;
    setRemoveBusy(true); setRemoveError("");
    try {
      await adminApi.deleteUser(removing.id, typed);
      setUsers((cur) => cur?.filter((x) => x.id !== removing.id) ?? cur);
      toast(`${removing.name || removing.email} o‘chirildi`);
      setRemoving(null);
    } catch (e) { setRemoveError(e.message); } finally { setRemoveBusy(false); }
  };

  if (error && !users) return <div className="adm-card adm-error" role="alert"><Icon name="alert" size={22} /><div><h3>Foydalanuvchilarni yuklab bo‘lmadi</h3><p>{error}</p></div><button type="button" className="adm-btn" onClick={() => { setError(""); setTick((v) => v + 1); }}><Icon name="refresh" size={16} />Qayta urinish</button></div>;

  return (
    <section className="adm-panel">
      <div className="adm-card adm-toolbar-card">
        <div className="adm-toolbar">
          <label className="adm-search"><Icon name="search" size={17} /><input value={q} onChange={(e) => { setQ(e.target.value); setShown(100); }} placeholder="Ism, gmail, telefon yoki davlat bo‘yicha qidirish  ( / )" aria-label="Qidirish" /></label>
          <div className="adm-seg" role="radiogroup" aria-label="Saralash">
            {SORTS.map(([k, label]) => <button key={k} type="button" role="radio" aria-checked={sort === k} className={sort === k ? "is-on" : ""} onClick={() => setSort(k)}>{label}</button>)}
          </div>
        </div>
        <div className="adm-toolbar adm-toolbar-actions">
          <div className="adm-seg" role="radiogroup" aria-label="Kirish usuli">
            {PROVIDERS.map(([k, label]) => <button key={k || "all"} type="button" role="radio" aria-checked={prov === k} className={prov === k ? "is-on" : ""} onClick={() => { setProv(k); setShown(100); }}>{label}</button>)}
          </div>
          <button type="button" className="adm-btn is-sm" onClick={copyEmails} disabled={busy || !list.length}><Icon name="copy" size={15} />Gmaillarni nusxalash</button>
          <button type="button" className="adm-btn is-sm" onClick={exportCsv} disabled={busy}><Icon name="download" size={15} />CSV eksport</button>
        </div>
        <p className="adm-count"><b>{users ? list.length : "…"}</b> ta foydalanuvchi{users && <> · bugun faol: <b>{activeToday}</b> · Google: <b>{googleCount}</b></>}</p>
      </div>

      {!users ? (
        <div className="adm-skels">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={64} r={16} />)}</div>
      ) : list.length === 0 ? (
        <div className="adm-card adm-empty"><Icon name="user" size={30} /><h3>{q || prov ? "Hech narsa topilmadi" : "Hali foydalanuvchi yo‘q"}</h3><p>{q || prov ? "Boshqa so‘z yoki filtr bilan urinib ko‘ring." : "Odamlar NarxTop’da ro‘yxatdan o‘tganda shu yerda ko‘rinadi."}</p></div>
      ) : (
        <>
          <div className="adm-urow adm-thead" aria-hidden="true"><span>Foydalanuvchi</span><span>Telefon · davlat</span><span>Usul</span><span>Qo‘shilgan</span><span>Oxirgi faollik</span><span>Kirishlar</span><span /></div>
          <ul className="adm-rows">
            <AnimatePresence initial={false}>
              {list.slice(0, shown).map((u, i) => (
                <motion.li key={u.id} className="adm-urow" layout="position" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, delay: Math.min(i, 10) * 0.02 }}>
                  <div className="adm-who">
                    <span className="adm-ava" style={{ background: avatarColor(u.email) }}><SafeImg src={u.avatar} fallback={(u.name || u.email || "?").slice(0, 1).toUpperCase()} /></span>
                    <div><b>{u.name || (u.email || "—").split("@")[0]}{(u.role === "ceo" || u.isCeo || isAdminEmail(u.email)) ? <em className="adm-tag">CEO</em> : u.role === "superadmin" ? <em className="adm-tag adm-tag-superadmin">Superadmin</em> : u.role === "admin" || (u.isAdmin && u.role !== "superadmin") ? <em className="adm-tag">Admin</em> : u.role === "worker" ? <em className="adm-tag adm-tag-worker">Worker</em> : null}</b><small>{u.email}</small></div>
                  </div>
                  <span data-label="Telefon · davlat" className="adm-phone">
                    {u.phone ? <><Flag iso={u.phoneCountry || "UN"} /><div><b>{u.phoneText || u.phone}</b><small>{u.phoneCountry ? countryName(u.phoneCountry, "uz") : "Davlat noma’lum"}</small></div></> : <em className="adm-dash">—</em>}
                  </span>
                  <span data-label="Usul"><i className={`adm-prov is-${u.provider}`}>{u.provider === "google" ? "Google" : "Gmail / parol"}</i></span>
                  <span data-label="Qo‘shilgan">{fmtDate(u.createdAt)}</span>
                  <span data-label="Oxirgi faollik">{timeAgo(u.lastSeenAt)}</span>
                  <span data-label="Kirishlar" className="adm-num">{u.signIns}</span>
                  <span className="adm-urow-act"><div className="adm-user-menu" ref={openMenu === u.id ? menuRef : null}>
                    <button type="button" className="adm-icon-btn adm-user-menu-trigger" aria-label={`${u.name || u.email} amallari`} aria-expanded={openMenu === u.id} aria-haspopup="menu" onClick={() => setOpenMenu((current) => current === u.id ? null : u.id)}><Icon name="moreVertical" size={18} /><Icon name="chevronDown" size={13} /></button>
                    <AnimatePresence>{openMenu === u.id && <motion.div className="adm-user-menu-pop" role="menu" initial={{ opacity: 0, y: 5, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.98 }}>
                      <button type="button" role="menuitem" onClick={() => { setOpenMenu(null); navigate(`/profile/${encodeURIComponent(u.id)}`); }}><Icon name="user" size={15} />Profilni ko‘rish</button>
                      {canDelete(u) && <button type="button" role="menuitem" className="is-danger" onClick={() => { setOpenMenu(null); setRemoveError(""); setRemoving(u); }}><Icon name="trash" size={15} />Foydalanuvchini o‘chirish</button>}
                    </motion.div>}</AnimatePresence>
                  </div></span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {list.length > shown && <button type="button" className="adm-btn adm-more" onClick={() => setShown((n) => n + 100)}>Yana ko‘rsatish · {list.length - shown}<Icon name="chevronDown" size={16} /></button>}
        </>
      )}
      <DeleteUserDialog user={removing} busy={removeBusy} error={removeError} onConfirm={doRemove} onCancel={closeRemove} />
    </section>
  );
}
