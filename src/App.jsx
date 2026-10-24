import { Component, lazy, Suspense, useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useNavigationType } from "react-router-dom";

import PlusPrompt from "./components/ui/PlusPrompt";
import PageShell from "./components/layout/PageShell";
import Toaster from "./components/ui/Toaster";
import ChatNotifier from "./components/ui/ChatNotifier";
import LogoutOverlay from "./components/ui/LogoutOverlay";
import PhoneGate, { needsPhone } from "./components/auth/PhoneGate";
import { EmptyState, Skeleton } from "./components/ui/States";

import { useAuth } from "./context/AuthContext";
import { useLang } from "./context/LanguageContext";
import { useTheme } from "./context/ThemeContext";
import { useUserData } from "./context/UserDataContext";
import { toast } from "./lib/toast";
import { safeNext } from "./lib/authUtils";
import { loadProductDetail } from "./lib/preload";

const Home = lazy(() => import("./pages/Home"));
const Products = lazy(() => import("./pages/Products"));
const Cart = lazy(() => import("./pages/Cart"));
const ProductDetail = lazy(loadProductDetail);
const Auth = lazy(() => import("./pages/Auth"));
const AuthConfirm = lazy(() => import("./pages/AuthConfirm"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Account = lazy(() => import("./pages/Account"));
const Contact = lazy(() => import("./pages/Contact"));
const About = lazy(() => import("./pages/About"));
const Plus = lazy(() => import("./pages/Plus"));
const SmartBuy = lazy(() => import("./pages/SmartBuy"));
const Legal = lazy(() => import("./pages/Legal"));
const Admin = lazy(() => import("./pages/Admin"));
const StaffChat = lazy(() => import("./pages/StaffChat"));
const AdminUserProfile = lazy(() => import("./pages/AdminUserProfile"));

function lazyPage(Page, props = {}, wide = false) {
  return <Suspense fallback={<PageShell wide={wide}><Skeleton h={260} r={28} /></PageShell>}><Page {...props} /></Suspense>;
}

/* Greets the user (once per tab) right after sign-in. */
function WelcomeWatcher() {
  const { user, displayName } = useAuth();
  const { t } = useLang();
  useEffect(() => {
    if (!user) return;
    const key = `narxtop_welcomed_${user.id}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* ignore */ }
    toast(t("auth.welcome", { name: displayName }), { confetti: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
  return null;
}

/* After Google OAuth the browser lands on "/"; send the user where they wanted to go. */
function PostAuthRedirect() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    if (!user || pathname !== "/") return;
    try {
      const next = sessionStorage.getItem("narxtop_next");
      if (next) { sessionStorage.removeItem("narxtop_next"); navigate(safeNext(next), { replace: true }); }
    } catch { /* ignore */ }
  }, [user, pathname, navigate]);
  return null;
}

/* New page -> scroll to the top. Back / Forward restore the scroll position the page had when it was left. */
const scrollMemory = new Map();
function ScrollTop() {
  const { pathname, key } = useLocation();
  const navType = useNavigationType();
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  }, []);
  useEffect(() => {
    const save = () => scrollMemory.set(key, window.scrollY);
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [key]);
  useEffect(() => {
    const target = navType === "POP" ? scrollMemory.get(key) ?? 0 : 0;
    window.scrollTo({ top: target });
    if (!target) return undefined;
    // the page body may still be mounting (lazy chunk / grid) -> retry for a moment until it is tall enough
    let frames = 0, raf = 0;
    const retry = () => {
      if (Math.abs(window.scrollY - target) < 2 || ++frames > 40) return;
      window.scrollTo({ top: target });
      raf = requestAnimationFrame(retry);
    };
    raf = requestAnimationFrame(retry);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  return null;
}

function SiteAccentSync() {
  const { prefs } = useUserData();
  const { setAccent } = useTheme();
  useEffect(() => { setAccent(prefs.siteAccent ?? "brown"); }, [prefs.siteAccent, setAccent]);
  return null;
}

/* The dedicated search page is gone: old /search and /search?q=… links land on /products (the query is kept). */
function SearchRedirect() {
  const { search } = useLocation();
  return <Navigate to={`/products${search}`} replace />;
}

function legacyProfileId(path) {
  const prefix = "/profile-";
  if (!path.startsWith(prefix) || path.length <= prefix.length) return null;
  try { return decodeURIComponent(path.slice(prefix.length)); }
  catch { return null; }
}

function NotFound() {
  const { t } = useLang();
  return <PageShell><EmptyState icon="compass" title={t("p.notFound")} action={<Link to="/" className="nt-btn nt-btn-primary">{t("nav.home")}</Link>} /></PageShell>;
}

class Boundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { console.error("UI crashed:", error); }
  render() {
    if (!this.state.error) return this.props.children;
    return <div className="nt-state" role="alert"><h3>Something went wrong</h3><button type="button" className="nt-btn nt-btn-primary" onClick={() => { this.setState({ error: null }); window.location.assign("/"); }}>Reload</button></div>;
  }
}

export default function App() {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  /* The first paint waits for the session check (so a signed-in user without a phone never sees the site flash by),
     but never for more than 3.5 s: if the API is slow or offline the website shows up as usual. */
  const [bootSlow, setBootSlow] = useState(false);
  useEffect(() => {
    if (!authLoading) return undefined;
    const timer = window.setTimeout(() => setBootSlow(true), 3500);
    return () => window.clearTimeout(timer);
  }, [authLoading]);
  const path = location.pathname.replace(/\/+$/, "") || "/";
  const oldProfileId = legacyProfileId(path);
  const staffId = /^\/admin-([^/]+)$/.exec(path)?.[1] ?? null;
  /* A signed-in user without a phone number sees only the phone pop-up: no navbar, no pages, nothing else works. */
  if (authLoading && !bootSlow) return <div className="nt-boot" role="status" aria-busy="true"><i /></div>;
  if (needsPhone(user)) return <Boundary><PhoneGate /><Toaster /><LogoutOverlay /></Boundary>;
  return (
    <Boundary>
      <ScrollTop />
      <SiteAccentSync />
      <Routes location={{ ...location, pathname: path }}>
          <Route path="/" element={lazyPage(Home)} />
          <Route path="/products" element={lazyPage(Products)} />
          <Route path="/search" element={<SearchRedirect />} />
          <Route path="/cart" element={lazyPage(Cart)} />
          <Route path="/product/:slug" element={lazyPage(ProductDetail)} />
          <Route path="/stores" element={<Navigate to="/" replace />} />
          <Route path="/auth" element={lazyPage(Auth)} />
          <Route path="/auth/confirm" element={lazyPage(AuthConfirm)} />
          <Route path="/reset-password" element={lazyPage(ResetPassword)} />
          <Route path="/account" element={lazyPage(Account)} />
          <Route path="/contact" element={lazyPage(Contact)} />
          <Route path="/about" element={lazyPage(About)} />
          <Route path="/premium" element={lazyPage(Plus)} />
          <Route path="/plus" element={<Navigate to="/premium" replace />} />
          <Route path="/smart-buy" element={lazyPage(SmartBuy)} />
          <Route path="/privacy" element={lazyPage(Legal, { kind: "privacy" })} />
          <Route path="/terms" element={lazyPage(Legal, { kind: "terms" })} />
          <Route path="/admin" element={lazyPage(Admin, {}, true)} />
          <Route path="/chat" element={lazyPage(StaffChat, {}, true)} />
          <Route path="/profile/:id" element={lazyPage(AdminUserProfile, {}, true)} />
          <Route path="*" element={oldProfileId ? lazyPage(AdminUserProfile, { userId: oldProfileId }, true) : staffId ? lazyPage(Admin, { staffId }, true) : <NotFound />} />
      </Routes>
      <PlusPrompt />
      <WelcomeWatcher />
      <PostAuthRedirect />
      <Toaster />
      <ChatNotifier />
      <LogoutOverlay />
    </Boundary>
  );
}
