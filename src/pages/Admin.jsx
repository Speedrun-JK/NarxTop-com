import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { AnimatePresence, LayoutGroup, MotionConfig, motion } from "framer-motion";

import PageShell from "../components/layout/PageShell";
import Icon from "../components/ui/Icon";
import { Skeleton } from "../components/ui/States";
import Overview from "../components/admin/Overview";
import ProductsPanel from "../components/admin/ProductsPanel";
import ProductDrawer from "../components/admin/ProductDrawer";
import UsersPanel from "../components/admin/UsersPanel";
import MessagesPanel from "../components/admin/MessagesPanel";
import ActivityPanel from "../components/admin/ActivityPanel";
import SettingsPanel from "../components/admin/SettingsPanel";
import { ThumbsContext } from "../components/admin/thumbsContext";
import { accentStyle } from "../components/admin/themes";
import { useAuth } from "../context/AuthContext";
import { useCatalog } from "../context/CatalogContext";
import { useLang } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import useAdminPrefs from "../hooks/useAdminPrefs";
import useServerHealth from "../hooks/useServerHealth";
import { useAdminAccess } from "../lib/admin";
import { toast } from "../lib/toast";
import { adminApi } from "../services/admin";

const PlusPanel = lazy(() => import("../components/admin/PlusPanel"));
const ReceiptsPanel = lazy(() => import("../components/admin/ReceiptsPanel"));
const PurchasesPanel = lazy(() => import("../components/admin/PurchasesPanel"));
const LeaderboardPanel = lazy(() => import("../components/admin/LeaderboardPanel"));
const AdminsPanel = lazy(() => import("../components/admin/AdminsPanel"));

const NAV = [
  ["overview", "Boshqaruv", "chart", "Umumiy ko‘rinish va tezkor amallar"],
  ["products", "Mahsulotlar", "package", "Mahsulotlar va do‘kon narxlarini boshqarish"],
  ["users", "Foydalanuvchilar", "user", "Saytga kirgan odamlar"],
  ["messages", "Xabarlar", "inbox", "“Aloqa” sahifasidan kelgan xabarlar"],
  ["plus", "Premium", "crown", "NarxTop Premium: reja, obunachilar va sovg‘alar"],
  ["activity", "Faollik", "activity", "Admin panelda bajarilgan amallar tarixi"],
  ["settings", "Sozlamalar", "settings", "Ko‘rinish, ma’lumotlar va tizim"],
  ["receipts", "admin.receipts", "image", "admin.receipts.sub"],
  ["purchases", "Xaridlar tarixi", "cart", "Kim nima sotib olgan: cheklar, xaridorlar va mahsulotlar"],
  ["leaderboard", "Xaridorlar reytingi", "chart", "Supermarketlar bo‘yicha eng faol xaridorlar"],
  ["admins", "Adminlar", "shield", "Admin ruxsatlarini berish va boshqarish"],
];
function ServerBanner({ health, onRecheck }) {
  return (
    <div className="adm-banner" role="alert">
      <Icon name={health.state === "stale" ? "refresh" : "alert"} size={20} />
      <div>
        <b>{health.state === "stale" ? "Server qayta ishga tushirilishi kerak" : health.state === "db" ? "Baza ulanmagan" : "Server bilan aloqa yo‘q"}</b>
        <p>{health.message}</p>
      </div>
      <button type="button" className="adm-btn is-sm" onClick={onRecheck}><Icon name="refresh" size={15} />Qayta tekshirish</button>
    </div>
  );
}

function AdminApp({ name, role }) {
  const [params, setParams] = useSearchParams();
  const canManageAdmins = ["ceo", "superadmin"].includes(role);
  const isWorker = role === "worker";
  const visibleNav = isWorker
    ? NAV.filter(([key]) => key === "products" || key === "settings")
    : canManageAdmins
      ? NAV
      : NAV.filter(([key]) => key !== "admins" && key !== "messages" && key !== "plus");
  const visibleTabKeys = visibleNav.map(([key]) => key);
  const defaultTab = isWorker ? "products" : "overview";
  const tab = visibleTabKeys.includes(params.get("tab")) ? params.get("tab") : defaultTab;
  const { prefs, set, reset } = useAdminPrefs();
  const { t, lang, setLang, languages } = useLang();
  const { isDark, toggleTheme, preference: themePreference, setPreference: setThemePreference } = useTheme();
  const { health, recheck } = useServerHealth();
  const { reload } = useCatalog();

  const [version, setVersion] = useState(0);
  const [drawer, setDrawer] = useState(null); // { product } | null
  const [imagesOpen, setImagesOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [pendingReceipts, setPendingReceipts] = useState(0);

  const go = useCallback((k) => setParams(k === "overview" ? {} : { tab: k }, { replace: true }), [setParams]);
  const changed = useCallback(() => { setVersion((v) => v + 1); reload(); }, [reload]); // refresh panels + the public catalog
  const openDrawer = useCallback((product = null) => setDrawer({ product }), []);
  const closeDrawer = useCallback(() => setDrawer(null), []);
  const saved = useCallback(() => { setDrawer(null); changed(); }, [changed]);

  useEffect(() => {
    if (isWorker) return undefined;
    let off = false;
    Promise.all([adminApi.stats(), adminApi.receipts({ status: "pending", limit: 1 })]).then(([s, receipts]) => {
      if (!off) { setUnread(s.counts.unread); setPendingReceipts(receipts.total ?? 0); }
    }).catch(() => {});
    return () => { off = true; };
  }, [version, isWorker]);

  const act = useCallback(async (what) => {
    try {
      if (what === "add") openDrawer(null);
      else if (what === "images") { go("products"); setImagesOpen(true); }
      else if (what.startsWith("export-")) toast(`${await adminApi.download(what.slice(7))} yuklab olindi`);
    } catch (e) { toast(e.message); }
  }, [go, openDrawer]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target;
      if (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (document.querySelector(".adm-drawer, .nt-modal-bg")) return;
      if (e.key === "/") { const i = document.querySelector(".adm-main .adm-search input"); if (i) { e.preventDefault(); i.focus(); } }
      else if (e.key === "n" || e.key === "N") { e.preventDefault(); openDrawer(null); }
      else if (/^[1-9]$/.test(e.key)) {
        const shortcutTab = visibleNav[Number(e.key) - 1]?.[0];
        if (shortcutTab) go(shortcutTab);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, openDrawer, visibleNav]);

  const [, title, , subtitle] = visibleNav.find(([k]) => k === tab);
  const translatedTab = tab === "receipts";
  const titleText = translatedTab ? t(title) : title;
  const subtitleText = translatedTab ? t(subtitle) : subtitle;
  const led = { ok: "Server ishlayapti", checking: "Tekshirilmoqda…", stale: "Server eski versiyada", offline: "Server o‘chiq", db: "Baza ulanmagan" }[health.state];

  return (
    <MotionConfig reducedMotion={prefs.motion ? "user" : "always"}>
      <ThumbsContext.Provider value={prefs.thumbs}>
        <div className="adm" data-role={role} data-density={prefs.density} data-corners={prefs.corners} data-motion={prefs.motion ? "on" : "off"} data-side={prefs.sidebar} style={accentStyle(prefs.accent, isDark)}>
          <aside className="adm-side">
            <div className="adm-brand">
              <span className={`adm-brand-ico ${role === "ceo" ? "is-ceo" : ""}`} aria-hidden="true">{role === "ceo" ? <svg viewBox="0 0 32 32" focusable="false"><path d="M5 22.5 3.8 10l7.1 5.2L16 5l5.1 10.2 7.1-5.2-1.2 12.5H5Z" fill="currentColor"/><path d="M7 25h18M7.8 22.5v2.2m16.4-2.2v2.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="4" cy="8" r="1.5" fill="currentColor"/><circle cx="16" cy="3.5" r="1.5" fill="currentColor"/><circle cx="28" cy="8" r="1.5" fill="currentColor"/></svg> : <Icon name="shield" size={20} />}</span>
              <div><b>NarxTop</b><small>{role === "ceo" ? "CEO" : role === "superadmin" ? "Superadmin" : role === "worker" ? "Console" : "Admin"}</small></div>
            </div>

            <LayoutGroup id="admin-nav">
              <nav className="adm-nav" role="tablist" aria-orientation="vertical" aria-label="Admin bo‘limlari">
                {visibleNav.map(([k, label, icon]) => {
                  const labelText = k === "receipts" ? t(label) : label;
                  return <button key={k} type="button" role="tab" aria-selected={tab === k} title={labelText} className={tab === k ? "is-on" : ""} onClick={() => go(k)}>
                    {tab === k && <motion.i layoutId="adm-nav-pill" className="adm-nav-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} aria-hidden="true" />}
                    <Icon name={icon} size={18} /><span>{labelText}</span>
                    {k === "messages" && unread > 0 && <em className="adm-nav-badge" aria-label={`${unread} ta yangi`}>{unread > 99 ? "99+" : unread}</em>}
                    {k === "receipts" && pendingReceipts > 0 && <em className="adm-nav-badge" aria-label={t("admin.receipts.pendingCount", { n: pendingReceipts })}>{pendingReceipts > 99 ? "99+" : pendingReceipts}</em>}
                  </button>
                })}
              </nav>
            </LayoutGroup>

            <div className="adm-side-foot">
              <button type="button" className={`adm-status is-${health.state}`} onClick={recheck} title="Qayta tekshirish"><i className="adm-led" /><span>{led}</span></button>
              <div className="adm-side-actions">
                <button type="button" className="adm-icon-btn" onClick={toggleTheme} aria-label="Mavzuni almashtirish" title="Yorug‘ / qorong‘i"><Icon name={isDark ? "sun" : "moon"} size={17} /></button>
                <button type="button" className="adm-icon-btn adm-side-collapse" onClick={() => set({ sidebar: prefs.sidebar === "mini" ? "full" : "mini" })} aria-label="Yon panelni kichraytirish" title="Yon panel"><Icon name="panelLeft" size={17} /></button>
                <Link to="/" className="adm-icon-btn" aria-label="Saytni ko‘rish" title="Saytni ko‘rish"><Icon name="external" size={17} /></Link>
              </div>
            </div>
          </aside>

          <div className="adm-main">
            {(health.state === "stale" || health.state === "offline" || health.state === "db") && <ServerBanner health={health} onRecheck={recheck} />}

            <header className="adm-top">
              <div><h1>{titleText}</h1><p>{subtitleText}</p></div>
              <div className="adm-top-act">
                <div className="adm-language" role="radiogroup" aria-label={t("acc.language")}>
                  {languages.map((language) => <button key={language} type="button" role="radio" aria-checked={lang === language} className={lang === language ? "is-on" : ""} onClick={() => setLang(language)}>{language.toUpperCase()}</button>)}
                </div>
                {tab === "products" && <button type="button" className="adm-btn is-primary" onClick={() => openDrawer(null)}><Icon name="plus" size={17} />Mahsulot qo‘shish</button>}
              </div>
            </header>

            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tab} role="tabpanel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.2 }}>
                <Suspense fallback={<Skeleton h={260} r={24} />}>
                  {tab === "overview" && <Overview version={version} onGo={go} onAction={act} name={name} hero={prefs.hero} isCeo={role === "ceo"} />}
                  {tab === "products" && <ProductsPanel version={version} view={prefs.view} imagesOpen={imagesOpen} onOpenImages={() => setImagesOpen(true)} onCloseImages={() => setImagesOpen(false)} onOpenDrawer={openDrawer} onChanged={changed} />}
                  {tab === "users" && <UsersPanel version={version} role={role} />}
                  {tab === "admins" && canManageAdmins && <AdminsPanel version={version} role={role} />}
                  {tab === "messages" && <MessagesPanel onUnread={setUnread} />}
                  {tab === "plus" && <PlusPanel version={version} />}
                  {tab === "purchases" && <PurchasesPanel version={version} />}
                  {tab === "leaderboard" && <LeaderboardPanel version={version} />}
                  {tab === "receipts" && <ReceiptsPanel version={version} onChanged={changed} />}
                  {tab === "activity" && <ActivityPanel version={version} />}
                  {tab === "settings" && <SettingsPanel prefs={prefs} set={set} reset={reset} themePreference={themePreference} setThemePreference={setThemePreference} health={health} recheck={recheck} onChanged={changed} role={role} />}
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {drawer && <ProductDrawer key={drawer.product?.slug ?? "new"} product={drawer.product} onClose={closeDrawer} onSaved={saved} />}
          </AnimatePresence>
        </div>
      </ThumbsContext.Provider>
    </MotionConfig>
  );
}

/* The server re-checks the signed-in staff role on every privileged API call. */
export default function Admin({ staffId: requestedStaffId }) {
  const { isAuthenticated, loading, displayName, user } = useAuth();
  const { staffId: routeStaffId } = useParams();
  const staffId = requestedStaffId ?? routeStaffId;
  const { isAdmin, role, staffPath, loading: accessLoading } = useAdminAccess();
  if (loading || accessLoading) return <PageShell wide><Skeleton h={260} r={28} /></PageShell>;
  if (!isAuthenticated) return <Navigate to="/auth?next=%2Fadmin" replace />;
  if (staffId && staffId !== user?.id) return <Navigate to="/" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  if (!staffId && staffPath) return <Navigate to={staffPath} replace />;
  return <PageShell wide className="adm-shell-main"><AdminApp name={displayName} role={role} /></PageShell>;
}
