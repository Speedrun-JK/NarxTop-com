import { useEffect, useState } from "react";

import Navbar from "../components/layout/Navbar";
import Footer from "../components/layout/Footer";

import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { authErrorKey } from "../lib/authUtils";

import "./AuthConfirm.css";

const CONFIRMED_KEY = "narxtop_email_confirmed";
const CLOSE_AFTER_SECONDS = 5;

function wasConfirmedBefore() {
  try {
    return localStorage.getItem(CONFIRMED_KEY) === "1";
  } catch {
    return false;
  }
}

function getInitialStatus() {
  if (new URLSearchParams(window.location.search).has("token")) return "verifying";
  // Opened again without a fresh link (back button, refresh, bookmark…)
  if (wasConfirmedBefore()) return "already";
  return "error";
}

/*
 * Page the user lands on after pressing the button in the confirmation e-mail.
 *
 *  verifying → success (5 s countdown, then the window closes itself;
 *              if the browser refuses to close it, we go to the home page)
 *  already   → "already confirmed", redirects to the home page
 *  error     → expired / used link, with a "send a new link" form
 */
export default function AuthConfirm() {
  const { t } = useLang();
  const { resendConfirmation, confirmEmail } = useAuth();

  const [status, setStatus] = useState(getInitialStatus);
  const [seconds, setSeconds] = useState(CLOSE_AFTER_SECONDS);
  const [target, setTarget] = useState("/");
  const [closeBlocked, setCloseBlocked] = useState(false);

  const [email, setEmail] = useState("");
  const [resendState, setResendState] = useState({
    loading: false,
    message: "",
    error: "",
  });

  /* ---------- 1. Ask the NarxTop server to validate its one-time link ---------- */
  useEffect(() => {
    if (status !== "verifying") return undefined;

    let cancelled = false;

    (async () => {
      const token = new URLSearchParams(window.location.search).get("token");
      try {
        if (!token) throw new Error("missing token");
        await confirmEmail(token);
        try { localStorage.setItem(CONFIRMED_KEY, "1"); } catch { /* ignore */ }
        setTarget("/auth");
        window.history.replaceState(null, "", "/auth/confirm");
        if (!cancelled) setStatus("success");
      } catch {
        window.history.replaceState(null, "", "/auth/confirm");
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, confirmEmail]);

  /* ---------- 2. Success: count down 5 → 0, then close the window ---------- */
  useEffect(() => {
    if (status !== "success") return undefined;

    if (seconds <= 0) {
      window.close();

      // Browsers only allow window.close() for windows opened by a script.
      // If we are still here a moment later, continue to the website instead.
      const fallback = setTimeout(() => {
        setCloseBlocked(true);
        setTimeout(() => {
          window.location.href = target;
        }, 1500);
      }, 400);

      return () => clearTimeout(fallback);
    }

    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [status, seconds, target]);

  /* ---------- 3. Already confirmed: redirect to the home page ---------- */
  useEffect(() => {
    if (status !== "already") return undefined;

    const timer = setTimeout(() => {
      window.location.href = "/";
    }, 2500);

    return () => clearTimeout(timer);
  }, [status]);

  /* ---------------------- Resend confirmation e-mail ---------------------- */
  const handleResend = async (event) => {
    event.preventDefault();
    setResendState({ loading: true, message: "", error: "" });

    try {
      await resendConfirmation(email.trim());
      setResendState({
        loading: false,
        message: t("confirm.resent"),
        error: "",
      });
    } catch (error) {
      setResendState({
        loading: false,
        message: "",
        error: t(authErrorKey(error)),
      });
    }
  };

  return (
    <div className="confirm-page-wrapper">
      <Navbar />

      <main className="confirm-page">
        <section className="confirm-card">
          {status === "verifying" && (
            <>
              <div className="confirm-spinner" />
              <h1 className="confirm-title">{t("confirm.verifying")}</h1>
            </>
          )}

          {status === "success" && (
            <>
              <div className="confirm-check" aria-hidden="true">
                <svg viewBox="0 0 52 52">
                  <circle cx="26" cy="26" r="24" />
                  <path d="M14 27l9 9 16-18" />
                </svg>
              </div>

              <h1 className="confirm-title">{t("confirm.successTitle")}</h1>
              <p className="confirm-text">{t("confirm.successText")}</p>

              {closeBlocked ? (
                <p className="confirm-note">{t("confirm.closeBlocked")}</p>
              ) : (
                <>
                  <div className="confirm-countdown" aria-hidden="true">
                    <svg viewBox="0 0 44 44">
                      <circle className="track" cx="22" cy="22" r="19" />
                      <circle
                        className="progress"
                        cx="22"
                        cy="22"
                        r="19"
                        style={{
                          animationDuration: `${CLOSE_AFTER_SECONDS}s`,
                        }}
                      />
                    </svg>
                    <span>{seconds}</span>
                  </div>

                  <p className="confirm-note">
                    {t("confirm.closing", { n: seconds })}
                  </p>
                </>
              )}

              <a href={target} className="confirm-button">
                {target === "/"
                  ? t("confirm.goHome")
                  : t("confirm.goLogin")}
              </a>
            </>
          )}

          {status === "already" && (
            <>
              <div className="confirm-check confirm-check-soft" aria-hidden="true">
                <svg viewBox="0 0 52 52">
                  <circle cx="26" cy="26" r="24" />
                  <path d="M14 27l9 9 16-18" />
                </svg>
              </div>

              <h1 className="confirm-title">{t("confirm.alreadyTitle")}</h1>
              <p className="confirm-text">{t("confirm.alreadyText")}</p>
              <p className="confirm-note">{t("confirm.redirecting")}</p>

              <a href="/" className="confirm-button">
                {t("confirm.goHome")}
              </a>
            </>
          )}

          {status === "error" && (
            <>
              <div className="confirm-cross" aria-hidden="true">!</div>

              <h1 className="confirm-title">{t("confirm.errorTitle")}</h1>
              <p className="confirm-text">{t("confirm.errorText")}</p>

              <form className="confirm-form" onSubmit={handleResend}>
                <input
                  type="email"
                  className="confirm-input"
                  placeholder={t("confirm.emailLabel")}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />

                <button
                  type="submit"
                  className="confirm-button"
                  disabled={resendState.loading}
                >
                  {resendState.loading
                    ? t("auth.wait")
                    : t("confirm.resend")}
                </button>
              </form>

              {resendState.message && (
                <p className="confirm-ok">{resendState.message}</p>
              )}
              {resendState.error && (
                <p className="confirm-fail">{resendState.error}</p>
              )}

              <a href="/auth" className="confirm-link">
                {t("confirm.goLogin")}
              </a>
            </>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
