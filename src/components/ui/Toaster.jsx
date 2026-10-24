import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";
import { useLang } from "../../context/LanguageContext";
import { subscribeToasts } from "../../lib/toast";
import "./Toaster.css";

const TOAST_DURATION = 5000;
const CONFETTI = ["#9a6a48", "#e8527f", "#4fae7d", "#d7b99a", "#ff9dbb", "#6b4129"];

function CountdownBar({ duration = TOAST_DURATION }) {
  return <span className="toast-countdown" aria-hidden="true"><i style={{ animationDuration: `${duration}ms` }} /></span>;
}

export default function Toaster() {
  const { t } = useLang();
  const [toasts, setToasts] = useState([]);
  const [confetti, setConfetti] = useState([]);
  const timers = useRef(new Map());

  useEffect(() => {
    const handler = (detail) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const { confetti: withConfetti, ...payload } = detail ?? {};
      const duration = Number(payload.duration) > 0 ? Number(payload.duration) : TOAST_DURATION;
      const item = { ...payload, id, duration };

      setToasts((current) => [...current, item].slice(-4));
      const timer = window.setTimeout(() => {
        timers.current.delete(id);
        setToasts((current) => current.filter((toastItem) => toastItem.id !== id));
      }, duration);
      timers.current.set(id, timer);

      if (withConfetti) {
        const pieces = Array.from({ length: 26 }, (_, index) => ({
          id: `${id}-${index}`,
          color: CONFETTI[index % CONFETTI.length],
          left: Math.random() * 100,
          delay: Math.random() * 0.5,
          duration: 1.8 + Math.random() * 1.4,
          size: 6 + Math.random() * 8,
        }));
        setConfetti((current) => [...current, ...pieces]);
        window.setTimeout(() => setConfetti((current) => current.filter((piece) => !pieces.includes(piece))), 3600);
      }
    };

    const unsubscribe = subscribeToasts(handler);
    return () => {
      unsubscribe();
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current.clear();
    };
  }, []);

  return (
    <>
      <div className="toaster" role="status" aria-live="polite" aria-atomic="false">
        {toasts.map((item) => {
          if (item.kind === "priceDrop") {
            const href = item.storeUrl || `/product/${item.slug}`;
            const content = <>
              <span className="toast-price-icon"><Icon name="trendDown" size={20} /></span>
              <span className="toast-price-copy">
                <span className="toast-kicker">{t("fav.notice.eyebrow")}</span>
                <b>{item.title}</b>
                <small>{item.store && <i><Icon name="store" size={13} />{item.store}</i>}<strong>{item.price}</strong></small>
              </span>
              <span className="toast-price-action">{t("fav.notice.buy")}<Icon name={item.storeUrl ? "external" : "arrowRight"} size={15} /></span>
              <CountdownBar duration={item.duration} />
            </>;
            return item.storeUrl ? (
              <a className="toast toast-price-drop" key={item.id} href={href} target="_blank" rel="noreferrer" aria-label={`${item.title}. ${t("fav.notice.buy")}`}>
                {content}
              </a>
            ) : (
              <Link className="toast toast-price-drop" key={item.id} to={href} aria-label={`${item.title}. ${t("fav.notice.buy")}`}>
                {content}
              </Link>
            );
          }

          if (item.kind === "chatMessage") {
            return (
              <Link className="toast toast-chat" key={item.id} to="/chat" aria-label={`${item.sender}: ${item.preview}`}>
                <span className={`toast-chat-avatar role-${item.role || "worker"}`}>{item.avatar ? <img src={item.avatar} alt="" /> : <b aria-hidden="true">{(item.sender || "?").trim().charAt(0).toUpperCase()}</b>}</span>
                <span className="toast-chat-copy">
                  <span className="toast-kicker"><Icon name="chat" size={12} />{item.label || "Chat"}</span>
                  <b>{item.sender}</b>
                  <small>{item.preview}</small>
                </span>
                <CountdownBar duration={item.duration} />
              </Link>
            );
          }

          if (item.kind === "accountNotification") {
            return (
              <Link className={`toast toast-account-notice is-${item.tone || "general"}`} key={item.id} to={item.href || "/account?tab=notifications"}>
                <span className="toast-account-icon"><Icon name={item.icon || "bell"} size={21} strokeWidth={2} /></span>
                <span className="toast-account-copy">
                  <span className="toast-kicker">{item.label || t("acc.notifTitle")}</span>
                  <b>{item.title || item.message}</b>
                  {item.description && <small>{item.description}</small>}
                  <span className="toast-account-open">{t("toast.tapToOpen")}<Icon name="arrowRight" size={15} /></span>
                </span>
                <CountdownBar duration={item.duration} />
              </Link>
            );
          }

          return (
            <div className="toast toast-simple" key={item.id}>
              <span className="toast-simple-icon"><Icon name={item.icon || "checkCircle"} size={18} /></span>
              <span>{item.message}</span>
              <CountdownBar duration={item.duration} />
            </div>
          );
        })}
      </div>

      <div className="confetti-layer" aria-hidden="true">
        {confetti.map((piece) => (
          <span key={piece.id} className="confetti-piece" style={{
            left: `${piece.left}%`, width: `${piece.size}px`, height: `${piece.size * 1.6}px`,
            background: piece.color, animationDelay: `${piece.delay}s`, animationDuration: `${piece.duration}s`,
          }} />
        ))}
      </div>
    </>
  );
}
