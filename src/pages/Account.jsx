import { AnimatePresence, motion } from "framer-motion";
import { useSearchParams } from "react-router-dom";

import PageShell from "../components/layout/PageShell";
import Avatar from "../components/ui/Avatar";
import Icon from "../components/ui/Icon";
import Gate from "../components/ui/Gate";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { useUserData } from "../context/UserDataContext";
import Profile from "./account/Profile";
import Security from "./account/Security";
import Preferences from "./account/Preferences";
import { Favorites } from "./account/Collections";
import Notifications from "./account/Notifications";
import Danger from "./account/Danger";
import PlusTab from "./account/PlusTab";
import { SmartBuyPanel } from "./SmartBuy";

const TABS = [
  ["profile", "acc.tab.profile", Profile, "user"], ["security", "acc.tab.security", Security, "shield"], ["prefs", "acc.tab.prefs", Preferences, "settings"],
  ["favorites", "acc.favorites", Favorites, "heart"], ["smartbuy", "smart.title", SmartBuyPanel, "sparkles"], ["plus", "acc.plus", PlusTab, "crown"],
  ["notifications", "acc.notifTitle", Notifications, "bell"], ["actions", "acc.actions", Danger, "activity"],
];

function AccountBody() {
  const { t } = useLang();
  const { user, displayName } = useAuth();
  const { notifications, favoriteNotifications = [], sync } = useUserData();
  const [params, setParams] = useSearchParams();
  const tab = TABS.find(([id]) => id === params.get("tab")) ?? TABS[0];
  const View = tab[2];
  const unreadFavorites = favoriteNotifications.filter((n) => !n.readAt).length;
  return (
    <div className="nt-account">
      <header className="nt-acc-head">
        <Avatar size={64} />
        <div><h1>{displayName || t("acc.title")}</h1><p>{user?.email} · {user?.email_confirmed_at ? t("acc.verified") : t("acc.unverified")}</p></div>
        <span className={`nt-pill sync-${sync}`}>{t(`acc.sync.${sync}`)}</span>
      </header>
      <div className="nt-acc-grid">
        <nav className="nt-acc-nav" aria-label={t("acc.title")}>
          {TABS.map(([id, key, , icon]) => (
            <button key={id} type="button" className={tab[0] === id ? "is-on" : ""} aria-current={tab[0] === id ? "page" : undefined} onClick={() => setParams({ tab: id }, { replace: true })}>
              <Icon name={icon} size={18} />{t(key)}{id === "notifications" && notifications.length > 0 && <em>{notifications.length}</em>}{id === "favorites" && unreadFavorites > 0 && <em>{unreadFavorites}</em>}
            </button>
          ))}
        </nav>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab[0]} initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}><View /></motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function Account() {
  return <PageShell><Gate><AccountBody /></Gate></PageShell>;
}
