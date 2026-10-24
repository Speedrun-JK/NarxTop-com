import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, apiUrl } from "../lib/api";

const AuthContext = createContext(null);
const avatarCache = (id) => "narxtop_avatar_" + id;

async function authRequest(path, { method = "POST", body } = {}) {
  let response;
  try {
    response = await apiFetch("/api/auth/" + path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw Object.assign(new Error("Network request failed"), { code: "network" });
  }
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    throw Object.assign(new Error(result?.message || "Authentication request failed."), { code: result?.code, status: response.status });
  }
  return result;
}

export function getDisplayName(user) {
  if (!user) return "";
  const meta = user.user_metadata || {};
  return meta.name || meta.given_name || meta.full_name?.split(" ")[0] || user.email?.split("@")[0] || "";
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [avatar, setAvatarState] = useState(null);

  const refreshSession = useCallback(async () => {
    try {
      const response = await apiFetch("/api/auth/session", { cache: "no-store" });
      const result = await response.json().catch(() => null);
      const next = response.ok && result?.success ? result.user : null;
      setUser(next);
      if (!next) setAvatarState(null);
      return next;
    } catch { setUser(null); setAvatarState(null); return null; }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let cancelled = false;
    apiFetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json().then((result) => ({ response, result })))
      .then(({ response, result }) => {
        if (cancelled) return;
        const next = response.ok && result?.success ? result.user : null;
        setUser(next);
        if (!next) setAvatarState(null);
      })
      .catch(() => { if (!cancelled) { setUser(null); setAvatarState(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const userId = user?.id ?? null;
  useEffect(() => {
    if (!userId) return undefined;
    const heartbeat = () => {
      if (document.visibilityState === "visible") apiFetch("/api/auth/session/heartbeat", { method: "POST" }).catch(() => {});
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 60_000);
    document.addEventListener("visibilitychange", heartbeat);
    window.addEventListener("focus", heartbeat);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", heartbeat);
      window.removeEventListener("focus", heartbeat);
    };
  }, [userId]);
  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    apiFetch("/api/avatar", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((result) => {
        if (cancelled || !result?.success) return;
        setAvatarState(result.avatar ?? null);
        try { result.avatar ? localStorage.setItem(avatarCache(userId), result.avatar) : localStorage.removeItem(avatarCache(userId)); } catch { /* storage quota */ }
      })
      .catch(() => { /* keep the local photo if the API is offline */ });
    return () => { cancelled = true; };
  }, [userId]);

  const saveAvatar = useCallback(async (dataUrl) => {
    const response = await apiFetch("/api/avatar", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ image: dataUrl }) });
    if (!response.ok) throw new Error("avatar " + response.status);
    setAvatarState(dataUrl);
    try { if (userId) localStorage.setItem(avatarCache(userId), dataUrl); } catch { /* quota */ }
  }, [userId]);

  const removeAvatar = useCallback(async () => {
    const response = await apiFetch("/api/avatar", { method: "DELETE" });
    if (!response.ok) throw new Error("avatar " + response.status);
    setAvatarState(null);
    try { if (userId) localStorage.removeItem(avatarCache(userId)); } catch { /* ignore */ }
  }, [userId]);

  const signUp = useCallback((form) => authRequest("signup", { body: form }), []);
  const signIn = useCallback(async ({ email, password }) => {
    const result = await authRequest("login", { body: { email, password } });
    setUser(result.user);
    return { user: result.user, session: { user: result.user } };
  }, []);
  const signInWithGoogle = useCallback(async (next) => {
    const url = new URL(apiUrl("/api/auth/google"), window.location.origin);
    if (next) url.searchParams.set("next", next);
    window.location.assign(url.toString());
  }, []);
  const signOut = useCallback(async () => {
    try { await authRequest("logout"); }
    finally {
      try { if (userId) localStorage.removeItem(avatarCache(userId)); } catch { /* ignore */ }
      setUser(null); setAvatarState(null);
    }
  }, [userId]);
  const resendConfirmation = useCallback((email) => authRequest("resend-confirmation", { body: { email } }), []);
  const confirmEmail = useCallback((token) => authRequest("confirm", { body: { token } }), []);
  const sendPasswordRecovery = useCallback((email) => authRequest("forgot-password", { body: { email } }), []);
  const verifyResetCode = useCallback((email, code) => authRequest("verify-reset-code", { body: { email, code } }), []);
  const resetPassword = useCallback((tokenOrPayload, password) => authRequest("reset-password", { body: typeof tokenOrPayload === "object" ? tokenOrPayload : { token: tokenOrPayload, password } }), []);
  const verifyPassword = useCallback((currentPassword) => authRequest("password/verify", { body: { currentPassword } }), []);
  const updatePassword = useCallback(async (password, currentPassword = "") => {
    await authRequest("password", { method: "PUT", body: { password, currentPassword } });
  }, []);
  const updateProfile = useCallback(async (fields) => {
    const result = await authRequest("profile", { method: "PATCH", body: fields });
    if (result.user) setUser(result.user);
    return result;
  }, []);
  const signOutOthers = useCallback(async () => {
    await authRequest("logout-others");
    await refreshSession();
  }, [refreshSession]);
  const getSessions = useCallback(() => authRequest("sessions", { method: "GET" }), []);
  const terminateSession = useCallback((id) => authRequest("sessions/" + encodeURIComponent(id), { method: "DELETE" }), []);

  const session = useMemo(() => user ? { user } : null, [user]);
  const value = useMemo(() => ({
    session, user, loading, isAuthenticated: Boolean(user), recovery: false,
    displayName: getDisplayName(user), avatar, refreshSession,
    saveAvatar, removeAvatar, signUp, signIn, signInWithGoogle, signOut,
    resendConfirmation, confirmEmail, sendPasswordRecovery, verifyResetCode, resetPassword, verifyPassword, updatePassword,
    updateProfile, signOutOthers, getSessions, terminateSession,
  }), [session, user, loading, avatar, refreshSession, saveAvatar, removeAvatar, signUp, signIn, signInWithGoogle, signOut, resendConfirmation, confirmEmail, sendPasswordRecovery, verifyResetCode, resetPassword, verifyPassword, updatePassword, updateProfile, signOutOthers, getSessions, terminateSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
