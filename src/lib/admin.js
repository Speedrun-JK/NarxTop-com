import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { apiFetch } from "./api";

const LIST = [...new Set(
  [import.meta.env.VITE_ADMIN_GMAIL, import.meta.env.VITE_ADMIN_EMAILS]
    .flatMap((v) => String(v ?? "").split(",")).map((s) => s.trim().toLowerCase()).filter(Boolean)
)];

// Keep the last verified staff role across route-level Navbar remounts. This prevents
// the staff links from briefly disappearing while the access check refreshes.
const staffAccessCache = new Map();

export const isAdminEmail = (email) => Boolean(email) && LIST.includes(String(email).trim().toLowerCase());

/* Root admins are configured in the environment. Delegated admin roles come from the server,
 * which checks MongoDB and independently protects every privileged API request. */
export function useAdminAccess() {
  const { user, loading: authLoading } = useAuth();
  const [remote, setRemote] = useState(() => staffAccessCache.get(user?.id) ?? { userId: null, checked: false, role: "user", canManageAdmins: false, staffPath: null });
  useEffect(() => {
    if (!user?.id) return undefined;
    let active = true;
    const refresh = async () => {
      try {
        const response = await apiFetch("/api/admin/access", { cache: "no-store" });
        const body = await response.json().catch(() => null);
        if (!active) return;
        const access = { userId: user.id, checked: true, role: response.ok && ["ceo", "superadmin", "admin", "worker"].includes(body?.role) ? body.role : "user", canManageAdmins: response.ok && body?.canManageAdmins === true, staffPath: response.ok ? body?.staffPath ?? null : null };
        if (access.role === "user") staffAccessCache.delete(user.id);
        else staffAccessCache.set(user.id, access);
        setRemote(access);
      } catch {
        if (active) setRemote(staffAccessCache.get(user.id) ?? { userId: user.id, checked: true, role: "user", canManageAdmins: false, staffPath: null });
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 30_000);
    window.addEventListener("focus", refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [user?.id]);

  const cached = user?.id ? staffAccessCache.get(user.id) : null;
  const current = remote.userId === user?.id ? remote : cached;
  const role = current?.role ?? "user";
  return {
    role,
    isAdmin: role !== "user",
    canManageAdmins: Boolean(current?.canManageAdmins),
    staffPath: role !== "user" ? current?.staffPath || "/admin-" + user.id : null,
    loading: authLoading || Boolean(user?.id && !current?.checked),
  };
}

export function useIsAdmin() {
  return useAdminAccess().isAdmin;
}
