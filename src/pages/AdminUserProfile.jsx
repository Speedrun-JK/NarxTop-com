import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import PageShell from "../components/layout/PageShell";
import Icon from "../components/ui/Icon";
import SafeImg from "../components/admin/SafeImg";
import { Skeleton } from "../components/ui/States";
import { useAuth } from "../context/AuthContext";
import { useAdminAccess } from "../lib/admin";
import { adminApi } from "../services/admin";
import { avatarColor, fmtDate, timeAgo } from "../components/admin/format";
import { countryName } from "../lib/phone";

const ROLE_LABEL = { user: "Foydalanuvchi", worker: "Mahsulot ishchisi", admin: "Admin", ceo: "CEO" };

function InfoCard({ icon, label, value, hint, accent }) {
  return <article className={`adm-profile-info ${accent ? "is-accent" : ""}`}><span><Icon name={icon} size={17} /></span><div><small>{label}</small><b>{value || "—"}</b>{hint && <em>{hint}</em>}</div></article>;
}

function AdminUserProfileContent({ id, role }) {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [draftRole, setDraftRole] = useState("user");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    adminApi.userProfile(id).then((result) => {
      if (!active) return;
      setUser(result);
      setDraftRole(result.role === "ceo" ? "admin" : result.role || "user");
      setError("");
    }).catch((e) => { if (active) setError(e.message || "Foydalanuvchi ma’lumotlarini yuklab bo‘lmadi."); });
    return () => { active = false; };
  }, [id]);

  const fullName = useMemo(() => user?.fullName || [user?.name, user?.secondName].filter(Boolean).join(" ") || user?.email?.split("@")[0] || "Foydalanuvchi", [user]);
  const isCeo = role === "ceo";

  const saveRole = async () => {
    if (!user || !isCeo || user.role === "ceo" || draftRole === user.role) return;
    setSaving(true); setSaved(false); setError("");
    try {
      const updated = await adminApi.setUserRole(user.id, draftRole);
      setUser((current) => ({ ...current, ...updated }));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } catch (e) { setError(e.message || "Ruxsat darajasini saqlab bo‘lmadi."); }
    finally { setSaving(false); }
  };

  if (!user && !error) return <PageShell wide><div className="adm-profile-load"><Skeleton h={180} r={28} /><Skeleton h={320} r={24} /></div></PageShell>;
  if (error && !user) return <PageShell wide><div className="adm-profile-error"><Icon name="alert" size={24} /><div><h1>Profil ochilmadi</h1><p>{error}</p><Link className="adm-btn" to="/admin?tab=users">Foydalanuvchilarga qaytish</Link></div></div></PageShell>;

  const providers = user.authMethods?.length ? user.authMethods : [user.provider || "email"];
  return (
    <PageShell wide className="adm-profile-shell">
      <div className="adm-user-profile">
        <aside className="adm-profile-sidebar">
          <Link to="/admin?tab=users" className="adm-profile-back"><Icon name="arrowLeft" size={17} />Foydalanuvchilarga qaytish</Link>
          <div className="adm-profile-side-card">
            <span className="adm-profile-side-mark"><Icon name="user" size={18} /></span>
            <b>Foydalanuvchi</b>
            <small>Hisob ma’lumotlari va ruxsatlar</small>
            <a href="#profile-overview"><Icon name="layoutGrid" size={16} />Umumiy ma’lumot</a>
            <a href="#profile-access"><Icon name="shield" size={16} />Ruxsat darajasi</a>
          </div>

          <section className="adm-profile-role-card" id="profile-access">
            <span className="adm-eyebrow">Kirish huquqi</span>
            <h3>{ROLE_LABEL[user.role] || ROLE_LABEL.user}</h3>
            <p>{isCeo ? "Hisobning admin paneldagi ruxsatini shu yerdan o‘zgartiring." : "Ruxsatlarni faqat CEO o‘zgartira oladi."}</p>
            {isCeo && user.role !== "ceo" && <>
              <label><span>Yangi rol</span><select value={draftRole} onChange={(event) => setDraftRole(event.target.value)}><option value="user">Foydalanuvchi</option><option value="worker">Mahsulot ishchisi</option><option value="admin">Admin</option></select></label>
              <button type="button" className="adm-btn is-primary" onClick={saveRole} disabled={saving || draftRole === user.role}><Icon name={saved ? "check" : "shield"} size={15} />{saving ? "Saqlanmoqda…" : saved ? "Saqlandi" : "Ruxsatni saqlash"}</button>
            </>}
            {user.role === "ceo" && <span className="adm-profile-protected"><Icon name="lock" size={15} />Himoyalangan CEO hisobi</span>}
          </section>
        </aside>

        <main className="adm-profile-main" id="profile-overview">
          <header className="adm-profile-hero">
            <span className="adm-profile-avatar" style={{ background: avatarColor(user.email) }}><SafeImg src={user.avatar} fallback={fullName.slice(0, 1).toUpperCase()} /></span>
            <div className="adm-profile-identity"><span className="adm-eyebrow">NarxTop hisobi</span><h1>{fullName}</h1><p>{user.email || "Email ko‘rsatilmagan"}</p><div className="adm-profile-badges"><span className={`adm-profile-badge r-${user.role}`}><i />{ROLE_LABEL[user.role] || ROLE_LABEL.user}</span>{user.emailConfirmedAt && <span className="adm-profile-badge is-verified"><Icon name="badgeCheck" size={13} />Email tasdiqlangan</span>}</div></div>
            <Link to="/admin?tab=users" className="adm-btn"><Icon name="arrowLeft" size={16} />Ro‘yxat</Link>
          </header>

          {error && <p className="adm-profile-inline-error" role="alert"><Icon name="alert" size={15} />{error}</p>}

          <section className="adm-profile-section">
            <div className="adm-profile-section-head"><div><span className="adm-eyebrow">Profil ma’lumotlari</span><h2>Asosiy ma’lumotlar</h2></div><span className="adm-profile-section-icon"><Icon name="user" size={19} /></span></div>
            <div className="adm-profile-info-grid">
              <InfoCard icon="mail" label="Gmail / email" value={user.email} hint={user.emailConfirmedAt ? "Tasdiqlangan" : "Tasdiqlanmagan"} />
              <InfoCard icon="phone" label="Telefon raqami" value={user.phoneText || user.phone} hint={user.phoneCountry ? countryName(user.phoneCountry, "uz") : user.phone ? "Davlat aniqlanmadi" : "Raqam kiritilmagan"} accent={!user.phone} />
              <InfoCard icon="shield" label="Kirish usuli" value={providers.map((provider) => provider === "google" ? "Google" : "Email va parol").join(" · ")} />
              <InfoCard icon="calendar" label="Ro‘yxatdan o‘tgan" value={fmtDate(user.createdAt)} />
              <InfoCard icon="clock" label="Oxirgi faollik" value={timeAgo(user.lastSeenAt)} hint={fmtDate(user.lastSeenAt)} />
              <InfoCard icon="activity" label="Kirishlar soni" value={String(user.signIns ?? 0)} />
              {user.username && <InfoCard icon="user" label="Username" value={`@${user.username.replace(/^@/, "")}`} />}
            </div>
          </section>

          <section className="adm-profile-section adm-profile-account">
            <div className="adm-profile-section-head"><div><span className="adm-eyebrow">Hisob nazorati</span><h2>Ro‘yxatga olish va himoya</h2></div><span className="adm-profile-section-icon"><Icon name="lock" size={18} /></span></div>
            <dl><div><dt>Foydalanuvchi ID</dt><dd>{user.id}</dd></div><div><dt>Google bilan bog‘langan</dt><dd>{providers.includes("google") ? "Ha" : "Yo‘q"}</dd></div><div><dt>Ruxsatni oxirgi o‘zgartirgan</dt><dd>{user.adminUpdatedAt ? fmtDate(user.adminUpdatedAt) : "Hali o‘zgartirilmagan"}</dd></div></dl>
          </section>
        </main>
      </div>
    </PageShell>
  );
}

export default function AdminUserProfile({ userId }) {
  const { id: routeId } = useParams();
  const id = userId || routeId;
  const { isAuthenticated, loading } = useAuth();
  const { role, loading: accessLoading } = useAdminAccess();
  if (loading || accessLoading) return <PageShell wide><Skeleton h={300} r={28} /></PageShell>;
  if (!isAuthenticated) return <Navigate to={`/auth?next=${encodeURIComponent(`/profile/${id}`)}`} replace />;
  if (role !== "admin" && role !== "ceo") return <Navigate to="/" replace />;
  return <AdminUserProfileContent id={id} role={role} />;
}
