import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation as useRoute } from "react-router-dom";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";

import Avatar from "../ui/Avatar";
import Icon from "../ui/Icon";
import ConfirmDialog from "../ui/ConfirmDialog";
import Logo from "../brand/Logo";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { useLang } from "../../context/LanguageContext";
import { useTheme } from "../../context/ThemeContext";
import { useUserData } from "../../context/UserDataContext";
import { useAdminAccess } from "../../lib/admin";
import { useMotionPrefs } from "../../context/MotionPrefsContext";
import { usePlus } from "../../context/PlusContext";
import useLogout from "../../hooks/useLogout";
import { apiFetch } from "../../lib/api";

const LINKS = [["/", "nav.home", "package"], ["/products", "nav.products", "layoutGrid"]];

export default function Navbar() {
  const { t, lang, setLang, languages } = useLang();
  const { isDark, toggleTheme, preference, setPreference } = useTheme();
  const { isAuthenticated, displayName, user } = useAuth();
  const { role, staffPath } = useAdminAccess();
  const isAdmin = role !== "user";
  const logout = useLogout();
  const { count } = useCart();
  const { notifications, setPref, favorites } = useUserData();
  const { isPlus } = usePlus();
  const { disabled: motionDisabled, setMode: setMotionMode } = useMotionPrefs();
  const { pathname } = useRoute();
  const [menu, setMenu] = useState(false);
  const [drop, setDrop] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const box = useRef(null);
  const navBox = useRef(null);
  const [scrolled, setScrolled] = useState(false);
  const [chatUnread, setChatUnread] = useState(0);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !isAdmin) return undefined;
    let active = true;
    const refreshUnread = async () => {
      try {
        const response = await apiFetch("/api/chat/unread-count", { cache: "no-store" });
        const result = response.ok ? await response.json().catch(() => null) : null;
        if (active && result?.success) setChatUnread(Math.max(0, Number(result.count) || 0));
      } catch { /* the badge can refresh on the next interval or focus */ }
    };
    refreshUnread();
    const timer = window.setInterval(refreshUnread, 30_000);
    window.addEventListener("focus", refreshUnread);
    document.addEventListener("visibilitychange", refreshUnread);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshUnread);
      document.removeEventListener("visibilitychange", refreshUnread);
    };
  }, [isAuthenticated, isAdmin, user?.id, pathname]);

  useEffect(() => {
    // Route changes can come from browser history as well as clicks, so close transient menus here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenu(false); setDrop(false);
  }, [pathname]);
  useEffect(() => {
    const close = (e) => box.current && !box.current.contains(e.target) && setDrop(false);
    const esc = (e) => { if (e.key === "Escape") { setDrop(false); setMenu(false); } };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", esc); };
  }, []);

  /* phones: the burger menu closes only when the user taps a link, taps outside the sheet, presses Escape or
   * leaves the phone layout. Changing the theme / language / motion inside the sheet keeps it open. */
  useEffect(() => {
    if (!menu) return undefined;
    const root = document.documentElement;
    const nav = navBox.current;
    // The sheet is `position: fixed`; measure where the bar ends so it always hangs right under it,
    // however far the page is scrolled (this is what stopped it from showing after scrolling down).
    const place = () => {
      const bar = nav?.querySelector(".nt-nav-in");
      const bottom = bar ? Math.round(bar.getBoundingClientRect().bottom) : 70;
      nav?.style.setProperty("--nt-menu-top", `${Math.max(bottom, 0) + 8}px`);
    };
    place();
    root.classList.add("nt-menu-lock");
    const outside = (e) => { if (nav && !nav.contains(e.target)) setMenu(false); };
    const onViewportChange = () => { if (window.innerWidth > 860) setMenu(false); else place(); };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", onViewportChange, { passive: true });
    window.addEventListener("orientationchange", onViewportChange, { passive: true });
    window.visualViewport?.addEventListener("resize", onViewportChange, { passive: true });
    return () => {
      root.classList.remove("nt-menu-lock");
      nav?.style.removeProperty("--nt-menu-top");
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("orientationchange", onViewportChange);
      window.visualViewport?.removeEventListener("resize", onViewportChange);
    };
  }, [menu]);

  const toggleMotion = () => {
    const nextMode = motionDisabled ? "on" : "off";
    setMotionMode(nextMode);
    setPref({ animations: nextMode });
  };

  return (
    <header className={`nt-nav ${scrolled ? "is-scrolled" : ""} ${menu ? "is-menu-open" : ""} ${!isAuthenticated && pathname.startsWith("/auth") ? "is-guest-auth" : ""} ${pathname.startsWith("/chat") ? "is-chat-route" : ""}`} ref={navBox}>
      <div className="nt-nav-in">
        <Logo isPlus={isPlus} bare size={42} />

        <LayoutGroup id="nav">
          <nav id="nt-primary-navigation" className={`nt-nav-links ${menu ? "is-open" : ""}`} aria-label="main" aria-hidden={!menu && window.matchMedia?.("(max-width: 860px)").matches} onClick={(e) => { if (e.target.closest("a")) setMenu(false); }}>
            {LINKS.map(([to, key, icon]) => (
              <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => (isActive ? "is-active" : "")}>
                {({ isActive }) => (
                  <>
                    <Icon name={icon} size={17} className="nt-nav-ico" />
                    <span>{t(key)}</span>
                    {isActive && <motion.i layoutId="nav-pill" className="nt-nav-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} aria-hidden="true" />}
                  </>
                )}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink to={staffPath || "/admin"} className={({ isActive }) => `nt-nav-admin ${isActive ? "is-active" : ""}`}>
                {({ isActive }) => (
                  <>
                    {role === "ceo" ? <svg className="nt-nav-ico nt-nav-ceo-mark" width="19" height="19" viewBox="0 0 100 100" fill="none" aria-hidden="true"><circle cx="50" cy="24" r="15" stroke="currentColor" strokeWidth="7"/><path d="M18 83V71c0-13 10-23 23-23h18c13 0 23 10 23 23v12M41 51l9 13 9-13M50 64l-7 19h14l-7-19Z" stroke="currentColor" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/></svg> : <Icon name="shield" size={17} className="nt-nav-ico" />}
                    <span>{role === "ceo" ? "CEO" : role === "superadmin" ? "Superadmin" : role === "worker" ? "Console" : "Admin"}</span>
                    {isActive && <motion.i layoutId="nav-pill" className="nt-nav-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} aria-hidden="true" />}
                  </>
                )}
              </NavLink>
            )}
            {isAdmin && <NavLink to="/chat" className={({ isActive }) => isActive ? "nt-nav-admin nt-nav-chat is-active" : "nt-nav-admin nt-nav-chat"}>
              {({ isActive }) => <><Icon name="chat" size={17} className="nt-nav-ico" /><span>{t("chat.nav")}</span>{chatUnread > 0 && <em className="nt-nav-unread" aria-label={`${chatUnread} unread messages`}>{chatUnread > 99 ? "99+" : chatUnread}</em>}{isActive && <motion.i layoutId="nav-pill" className="nt-nav-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} aria-hidden="true" />}</>}
            </NavLink>}
            {/* Phone-only extras (hidden on desktop by CSS): the language switch is not in the top bar on phones. */}
            <div className="nt-nav-extra">
              <NavLink to="/account?tab=favorites" className={({ isActive }) => (isActive ? "is-active" : "")}>
                <Icon name="heart" size={17} className="nt-nav-ico" />
                <span>{t("nav.favorites")}</span>{isAuthenticated && favorites?.length > 0 && <em>{favorites.length}</em>}
              </NavLink>
              {isAuthenticated && <NavLink to="/account?tab=notifications" className={({ isActive }) => (isActive ? "is-active" : "")}>
                <Icon name="bell" size={17} className="nt-nav-ico" />
                <span>{t("acc.notifTitle")}</span>{notifications.length > 0 && <em>{notifications.length}</em>}
              </NavLink>}
              <NavLink to="/contact" className={({ isActive }) => (isActive ? "is-active" : "")}>
                <Icon name="mail" size={17} className="nt-nav-ico" />
                <span>{t("footer.contactBtn")}</span>
              </NavLink>
              {!isAuthenticated && (
                <NavLink to="/auth?mode=signup" className={({ isActive }) => (isActive ? "is-active" : "")}>
                  <Icon name="user" size={17} className="nt-nav-ico" />
                  <span>{t("lock.register")}</span>
                </NavLink>
              )}
              <div className="nt-nav-lang nt-nav-themebox">
                <span className="nt-nav-lang-label"><Icon name={isDark ? "moon" : "sun"} size={17} className="nt-nav-ico" />{t("acc.theme")}</span>
                <div className="nt-seg nt-seg-sm nt-nav-theme-seg" role="radiogroup" aria-label={t("acc.theme")}>
                  {[["system", "monitor"], ["light", "sun"], ["dark", "moon"]].map(([mode, icon]) => (
                    <button key={mode} type="button" role="radio" aria-checked={preference === mode} className={preference === mode ? "is-on" : ""} onClick={() => setPreference(mode)}>
                      <Icon name={icon} size={15} />{t(`acc.${mode}`)}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" className="nt-nav-theme" onClick={toggleMotion} aria-pressed={motionDisabled}>
                <Icon name="sparkles" size={17} className="nt-nav-ico" />
                <span>{t("motion.toggle")}: {t(motionDisabled ? "motion.off" : "motion.on")}</span>
              </button>
              <div className="nt-nav-lang">
                <span className="nt-nav-lang-label"><Icon name="compass" size={17} className="nt-nav-ico" />{t("acc.language")}</span>
                <div className="nt-seg nt-seg-sm" role="radiogroup" aria-label={t("acc.language")}>
                  {languages.map((l) => <button key={l} type="button" role="radio" aria-checked={lang === l} className={lang === l ? "is-on" : ""} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
                </div>
              </div>
            </div>
          </nav>
        </LayoutGroup>
        {menu && <button type="button" className="nt-nav-backdrop" onClick={() => setMenu(false)} aria-label={t("nav.close")} />}

        <div className="nt-nav-actions">
          {/* desktop only: on phones the language switch lives inside the burger menu (.nt-nav-lang below) */}
          <div className="nt-seg nt-seg-sm nt-nav-lang-top" role="radiogroup" aria-label={t("acc.language")}>
            {languages.map((l) => <button key={l} type="button" role="radio" aria-checked={lang === l} className={lang === l ? "is-on" : ""} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
          </div>
          <button type="button" className="nt-icon-btn nt-theme-btn" onClick={toggleTheme} aria-label={t("nav.theme")} title={t("nav.theme")} aria-pressed={isDark}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.span key={isDark ? "moon" : "sun"} style={{ display: "grid" }} initial={{ rotate: -70, opacity: 0, scale: 0.6 }} animate={{ rotate: 0, opacity: 1, scale: 1 }} exit={{ rotate: 70, opacity: 0, scale: 0.6 }} transition={{ duration: 0.18 }}>
                <Icon name={isDark ? "sun" : "moon"} size={19} />
              </motion.span>
            </AnimatePresence>
          </button>
          <Link to="/account?tab=favorites" className="nt-icon-btn nt-cart-btn nt-fav-btn" aria-label={t("acc.favorites")} title={t("acc.favorites")}>
            <Icon name="heart" size={19} />
            <AnimatePresence>{isAuthenticated && favorites?.length > 0 && <motion.em key={favorites.length} initial={{ scale: 0.4, y: 4 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0 }}>{favorites.length}</motion.em>}</AnimatePresence>
          </Link>
          <Link to="/cart" data-cart-target className="nt-icon-btn nt-cart-btn" aria-label={`${t("nav.cart")}${count ? ` (${count})` : ""}`} title={t("nav.cart")}>
            <Icon name="cart" size={19} />
            <AnimatePresence>{count > 0 && <motion.em key={count} initial={{ scale: 0.4, y: 4 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0 }}>{count}</motion.em>}</AnimatePresence>
          </Link>

          {isAuthenticated ? (
            <div className="nt-user" ref={box}>
              <button type="button" className="nt-user-btn" onClick={() => setDrop((v) => !v)} aria-expanded={drop} aria-haspopup="menu" aria-label={displayName}>
                <Avatar size={32} /><span className="nt-user-name">{displayName}</span>{notifications.length > 0 && <em>{notifications.length}</em>}
              </button>
              <AnimatePresence>
                {drop && (
                  <motion.div className="nt-drop nt-glass" role="menu" initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.14 }}>
                    <Link role="menuitem" to="/account"><Icon name="user" size={16} />{t("acc.tab.profile")}</Link>
                    <Link role="menuitem" to="/plus"><Icon name="crown" size={16} />Premium</Link>
                    <Link role="menuitem" to="/account?tab=notifications"><Icon name="bell" size={16} />{t("acc.notifTitle")}{notifications.length > 0 && <em>{notifications.length}</em>}</Link>
                    <Link role="menuitem" to="/contact"><Icon name="mail" size={16} />{t("footer.contactBtn")}</Link>
                    <button type="button" role="menuitem" onClick={() => { setDrop(false); setLogoutConfirm(true); }}><Icon name="logout" size={16} />{t("nav.logout")}</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <>
              <Link to="/contact" className="nt-icon-btn nt-nav-contact" aria-label={t("footer.contactBtn")} title={t("footer.contactBtn")}><Icon name="mail" size={18} /></Link>
              <Link to="/auth?mode=signup" className="nt-btn nt-btn-ghost nt-btn-sm nt-nav-reg">{t("lock.register")}</Link>
              <Link to={`/auth${pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : ""}`} className="nt-btn nt-btn-primary nt-btn-sm nt-nav-login">{t("nav.login")}</Link>
            </>
          )}
          <button type="button" className="nt-icon-btn nt-burger" onClick={() => setMenu((v) => !v)} aria-expanded={menu} aria-controls="nt-primary-navigation" aria-label={menu ? t("nav.close") : t("nav.menu")}>
            <Icon name={menu ? "x" : "menu"} size={19} />
          </button>
        </div>
      </div>
      <ConfirmDialog open={logoutConfirm} title={t("acc.logoutConfirmTitle")} text={t("acc.logoutConfirmText")} confirmLabel={t("nav.logout")} danger onCancel={() => setLogoutConfirm(false)} onConfirm={() => { setLogoutConfirm(false); logout(); }} />
    </header>
  );
}
