import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Icon from "../ui/Icon";
import { Skeleton } from "../ui/States";
import { toast } from "../../lib/toast";
import { isAdminEmail } from "../../lib/admin";
import { adminApi } from "../../services/admin";

const ROLE_META = {
  user: { name: "Foydalanuvchi", icon: "user", text: "Oddiy foydalanuvchi: admin panelga kira olmaydi." },
  worker: { name: "Ishchi", icon: "tag", text: "Mahsulotlarni qo‘shishi va tahrirlashi mumkin. Foydalanuvchilar va sozlamalarga ruxsati yo‘q." },
  superadmin: { name: "Superadmin", icon: "shield", text: "Barcha admin bo‘limlarini boshqaradi. CEO akkaunti va superadmin rollarini faqat CEO boshqaradi." },
  admin: { name: "Admin", icon: "shield", text: "Admin bo‘limlaridan foydalanadi: mahsulotlar, foydalanuvchilar, xaridlar va hisobotlar." },
};

/* Asks the CEO to confirm before anyone gets (or loses) admin / worker access. */
function RoleConfirm({ pending, busy, onConfirm, onCancel }) {
  const confirmBtn = useRef(null);
  const cancel = useRef(onCancel);
  const isBusy = useRef(busy);
  useEffect(() => { cancel.current = onCancel; isBusy.current = busy; }, [onCancel, busy]);
  const open = Boolean(pending);
  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    confirmBtn.current?.focus();
    const esc = (e) => e.key === "Escape" && !isBusy.current && cancel.current();
    window.addEventListener("keydown", esc);
    return () => { window.removeEventListener("keydown", esc); opener?.focus?.(); };
  }, [open]);

  const user = pending?.user;
  const to = pending?.to;
  const from = pending?.from;
  const grant = to === "admin" || to === "superadmin" || to === "worker";
  const label = user ? user.name || user.username || (user.email || "—").split("@")[0] : "";
  const tone = to === "admin" || to === "superadmin" ? "is-admin" : to === "worker" ? "is-worker" : "is-user";
  const verb = to === "user" ? "Ruxsatni olib tashlash" : to === "admin" ? "Admin qilish" : to === "superadmin" ? "Superadmin qilish" : "Ishchi qilish";

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="adm-confirm-bg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && !busy && onCancel()}>
          <motion.div role="alertdialog" aria-modal="true" aria-labelledby="adm-confirm-title" aria-describedby="adm-confirm-text" className={`adm-confirm ${tone}`} initial={{ opacity: 0, y: 24, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.97 }} transition={{ type: "spring", stiffness: 360, damping: 30 }}>
            <span className="adm-confirm-ico" aria-hidden="true"><Icon name={ROLE_META[to].icon} size={26} /></span>
            <h3 id="adm-confirm-title">{grant ? `${ROLE_META[to].name} ruxsatini berasizmi?` : "Ruxsatni olib tashlaysizmi?"}</h3>
            <div className="adm-confirm-person">
              <span className="adm-admin-avatar"><Icon name="user" size={18} /></span>
              <span><b>{label}</b><small>{user.email || user.username || "Email ko‘rsatilmagan"}</small></span>
            </div>
            <div className="adm-confirm-flow" aria-label="Rol o‘zgarishi">
              <span className={`adm-confirm-role r-${from}`}>{ROLE_META[from]?.name ?? from}</span>
              <Icon name="arrowRight" size={18} />
              <span className={`adm-confirm-role r-${to}`}>{ROLE_META[to].name}</span>
            </div>
            <p id="adm-confirm-text">{grant ? ROLE_META[to].text : "Bu odam endi oddiy foydalanuvchi bo‘ladi va admin panelga kira olmaydi."}</p>
            {(to === "admin" || to === "superadmin") && <p className="adm-confirm-warn"><Icon name="alert" size={16} />Admin ruxsatini faqat ishonchli odamga bering. CEO superadmin ruxsatini olib tashlashi mumkin.</p>}
            <div className="adm-confirm-actions">
              <button type="button" className="adm-btn" onClick={onCancel} disabled={busy}>Bekor qilish</button>
              <button ref={confirmBtn} type="button" className={`adm-btn ${to === "user" ? "is-danger-solid" : "is-primary"}`} onClick={onConfirm} disabled={busy}>{busy ? "Saqlanmoqda…" : verb}</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function AdminsPanel({ version, role: viewerRole = "ceo" }) {
  const [users, setUsers] = useState(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [reload, setReload] = useState(0);
  const [pending, setPending] = useState(null);

  useEffect(() => {
    let active = true;
    adminApi.users().then((rows) => {
      if (!active) return;
      setUsers(rows);
      setError("");
    }).catch((e) => {
      if (active) setError(e.message);
    });
    return () => { active = false; };
  }, [version, reload]);

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    if (!text) return users ?? [];
    return (users ?? []).filter((u) => `${u.name ?? ""} ${u.username ?? ""} ${u.email ?? ""}`.toLowerCase().includes(text));
  }, [users, query]);
  const adminCount = (users ?? []).filter((u) => ["admin", "superadmin", "ceo"].includes(u.role) || isAdminEmail(u.email)).length;

  const setRole = async (user, role) => {
    setBusy(user.id);
    try {
      const updated = await adminApi.setUserRole(user.id, role);
      setUsers((current) => current?.map((row) => row.id === updated.id ? { ...row, ...updated } : row) ?? current);
      const roleName = { user: "foydalanuvchi", admin: "admin", superadmin: "superadmin", worker: "ishchi" }[role];
      toast(`${user.name || user.email} → ${roleName}`);
      setPending(null);
    } catch (e) {
      toast(e.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="adm-panel adm-admins">
      <div className="adm-card adm-admins-intro">
        <span className="adm-admins-mark"><Icon name="shield" size={23} /></span>
        <div className="adm-admins-intro-copy">
          <h2>Admin ruxsatlari</h2>
          <p>Har bir kishiga oddiy foydalanuvchi, mahsulot ishchisi yoki admin rolini bering. CEO ruxsati alohida himoyalangan.</p>
        </div>
        <div className="adm-admins-stat"><b>{users ? adminCount : "—"}</b><span>admin</span></div>
      </div>

      <div className="adm-card adm-admins-tools">
        <label className="adm-search"><Icon name="search" size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ism, username yoki email bo‘yicha qidirish" aria-label="Foydalanuvchini qidirish" /></label>
        <button type="button" className="adm-btn is-sm" onClick={() => setReload((value) => value + 1)} disabled={busy !== ""}><Icon name="refresh" size={15} />Yangilash</button>
      </div>

      {error && !users && <div className="adm-card adm-error" role="alert"><Icon name="alert" size={20} /><p>{error}</p><button type="button" className="adm-btn is-sm" onClick={() => setReload((value) => value + 1)}>Qayta urinish</button></div>}
      {!users && !error && <div className="adm-skels">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} h={72} r={18} />)}</div>}
      {users && filtered.length === 0 && <div className="adm-card adm-empty"><Icon name="user" size={28} /><h3>{query ? "Foydalanuvchi topilmadi" : "Foydalanuvchilar ro‘yxati bo‘sh"}</h3><p>{query ? "Boshqa ism yoki email bilan qidirib ko‘ring." : "Odamlar NarxTop’da ro‘yxatdan o‘tganda shu yerda ko‘rinadi."}</p></div>}
      {users && filtered.length > 0 && (
        <ul className="adm-admin-list">
          {filtered.map((user) => {
            const root = user.role === "ceo" || user.isCeo || isAdminEmail(user.email);
            const role = root ? "ceo" : user.role ?? (user.isAdmin ? "admin" : "user");
            const protectedStaff = root || (role === "superadmin" && viewerRole !== "ceo");
            const label = user.name || user.username || (user.email || "—").split("@")[0];
            return (
              <li className="adm-card adm-admin-row" key={user.id}>
                <span className="adm-admin-avatar"><Icon name="user" size={19} /></span>
                <span className="adm-admin-person"><b>{label}</b><small>{user.email || user.username || "Email ko‘rsatilmagan"}</small></span>
                <span className={`adm-admin-state ${role === "superadmin" ? "is-superadmin" : role === "admin" || root ? "is-admin" : role === "worker" ? "is-worker" : ""}`}><i />{root ? "CEO" : role === "superadmin" ? "Superadmin" : role === "admin" ? "Admin" : role === "worker" ? "Ishchi" : "Foydalanuvchi"}</span>
                {protectedStaff ? <span className="adm-admin-protected"><Icon name="lock" size={15} />Himoyalangan</span> : (
                  <div className="adm-role-options" role="radiogroup" aria-label={`${label} uchun ruxsat darajasi`}>
                    {[["user", "Foydalanuvchi"], ["worker", "Ishchi"], ["admin", "Admin"], ["superadmin", "Superadmin"]].map(([value, title]) => <button key={value} type="button" role="radio" aria-checked={role === value} disabled={busy !== ""} onClick={() => role !== value && setPending({ user, from: role, to: value })}>{title}</button>)}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <RoleConfirm pending={pending} busy={busy !== ""} onConfirm={() => pending && setRole(pending.user, pending.to)} onCancel={() => setPending(null)} />
    </section>
  );
}
