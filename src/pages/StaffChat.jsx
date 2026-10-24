import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Navigate } from "react-router-dom";
import PageShell from "../components/layout/PageShell";
import Icon from "../components/ui/Icon";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import { Skeleton } from "../components/ui/States";
import { useAuth } from "../context/AuthContext";
import { useLang } from "../context/LanguageContext";
import { useAdminAccess } from "../lib/admin";
import { apiFetch, apiUrl } from "../lib/api";
import { chatToast } from "../lib/chatToast";
import { dateKey, formatDate, formatDateTime, formatTime } from "../lib/dates";

const EMOJIS = ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "🙂", "😉", "😍", "🥰", "😘", "😎", "🤩", "🤔", "😏", "😴", "😭", "😡", "🥳", "🤝", "👍", "👎", "👏", "🙏", "💪", "👀", "🔥", "✅", "❌", "❤️", "💔", "🎉", "⭐", "☕", "🍕", "🚀", "💡", "💰", "📈", "📦", "🛒"];
const stickerRange = (prefix, count) => Array.from({ length: count }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  return { id: `narxtop-${prefix}${number}`, src: `/stickers/narxtop-${prefix}${number}.webp` };
});
/* Three packs, like Telegram: every sticker is its own transparent file (public/stickers). */
const STICKER_PACKS = [
  { id: "main", name: "NarxTop", stickers: stickerRange("", 28) },
  { id: "team", name: "NarxTop Team", stickers: stickerRange("b", 25) },
  { id: "mood", name: "NarxTop Mood", stickers: stickerRange("c", 14) },
];
const executive = (role) => role === "ceo" || role === "superadmin";
const roleOrder = ["ceo", "superadmin", "admin", "worker"];
const apiMessage = async (response) => {
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    const error = new Error(body?.message || "Chat request failed.");
    error.code = body?.code;
    error.status = response.status;
    throw error;
  }
  return body;
};

function roleText(role, t) { return t(`chat.role.${role}`); }
function replyPreviewText(value, fallback) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 22 ? `${text.slice(0, 19).trimEnd()}…` : text;
}
function activityText(member, now, locale, t) {
  if (member.online) return t("chat.online");
  const lastSeen = new Date(member.lastSeenAt ?? "").getTime();
  if (!Number.isFinite(lastSeen)) return t("chat.activityUnknown");
  const minutes = Math.floor(Math.max(0, now - lastSeen) / 60_000);
  if (minutes < 1) return t("chat.justNow");
  const value = minutes < 60 ? minutes : minutes < 1440 ? Math.floor(minutes / 60) : Math.floor(minutes / 1440);
  const unit = minutes < 60 ? "minute" : minutes < 1440 ? "hour" : "day";
  try { return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-value, unit); }
  catch { return `${value} ${unit}${value === 1 ? "" : "s"} ago`; }
}
function dayLabel(value, t, now) {
  const key = dateKey(value);
  if (key && key === dateKey(now)) return t("chat.today");
  if (key && key === dateKey(Number(now) - 24 * 60 * 60 * 1000)) return t("chat.yesterday");
  return formatDate(value);
}
function receiptTimeLabel(value, now, t, lang) {
  const key = dateKey(value), today = dateKey(now), yesterday = dateKey(Number(now) - 24 * 60 * 60 * 1000);
  if (!key) return "—";
  if (key === today) return formatTime(value, lang);
  if (key === yesterday) return `${t("chat.yesterday")} · ${formatTime(value, lang)}`;
  return formatDateTime(value, lang);
}

function MemberAvatar({ member, className = "" }) {
  const preferred = member.profileAvatarUrl || member.avatar || "";
  const identity = `${member.id}:${preferred}`;
  const [fallback, setFallback] = useState(null);
  const source = fallback?.identity === identity ? fallback.source : preferred;
  const imageSource = source.startsWith("/api/") ? apiUrl(source) : source;
  const handleError = () => {
    if (source && source === member.profileAvatarUrl && member.avatar) setFallback({ identity, source: member.avatar });
    else setFallback({ identity, source: "" });
  };
  return <span className={`${className} role-${member.role || "worker"}`.trim()}>
    {imageSource ? <img src={imageSource} alt="" loading="lazy" decoding="async" crossOrigin={source.startsWith("/api/") ? "use-credentials" : undefined} onError={handleError} /> : <b aria-hidden="true">{(member.name || "?").trim().slice(0, 1).toUpperCase()}</b>}
  </span>;
}

function MemberProfileDialog({ dialog, onClose, now, lang, t }) {
  const closeRef = useRef(null), dialogRef = useRef(null);
  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"]');
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { window.removeEventListener("keydown", onKeyDown); opener?.focus?.(); };
  }, [onClose]);

  const user = dialog.user || dialog.member;
  const joinedDate = new Date(user.createdAt ?? "").getTime();
  const joined = Number.isFinite(joinedDate) ? formatDate(joinedDate) : "—";
  const lastActive = activityText(user, now, lang, t);
  const providers = (user.providers?.length ? user.providers : [user.provider || "email"]).map((provider) => provider === "google" ? "Google" : "Email").join(" · ");
  const field = (label, value) => <div className="stc-profile-field" key={label}><small>{label}</small><b>{value || "—"}</b></div>;

  return createPortal(<div className="stc-profile-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section ref={dialogRef} className="stc-profile-dialog" role="dialog" aria-modal="true" aria-labelledby="stc-profile-title" tabIndex={-1}>
      <header className="stc-profile-head">
        <div className="stc-profile-identity">
          <MemberAvatar member={user} className="stc-profile-avatar" />
          <div><small>{t("chat.profile")}</small><h2 id="stc-profile-title">{user.name || t("chat.profile")}</h2><span className={`stc-role role-${user.role}`}>{roleText(user.role, t)}</span></div>
        </div>
        <button ref={closeRef} type="button" className="stc-profile-close" onClick={onClose} aria-label={t("chat.cancel")}><Icon name="x" size={19} /></button>
      </header>
      {dialog.loading ? <div className="stc-profile-loading"><i /><i /><i /></div> : dialog.error ? <p className="stc-profile-error" role="alert">{dialog.error}</p> : <>
        <div className="stc-profile-status"><i className={user.online ? "is-online" : ""} /><span>{lastActive}</span></div>
        <div className="stc-profile-grid">
          {field(t("chat.email"), user.email)}
          {field(t("chat.phone"), user.phone)}
          {field(t("chat.username"), user.username ? `@${user.username.replace(/^@/, "")}` : "")}
          {field(t("chat.joined"), joined)}
          {field(t("chat.signIns"), String(user.signIns ?? 0))}
          {field(t("chat.provider"), providers)}
        </div>
        {user.emailConfirmedAt && <div className="stc-profile-verified"><Icon name="badgeCheck" size={15} />{t("chat.emailVerified")}</div>}
      </>}
    </section>
  </div>, document.body);
}

const chatMediaObservers = new WeakMap();
function observeChatMedia(element, onVisible) {
  if (typeof IntersectionObserver === "undefined") {
    const frame = window.requestAnimationFrame(onVisible);
    return () => window.cancelAnimationFrame(frame);
  }
  const root = element.closest(".stc-messages");
  if (!root) {
    const frame = window.requestAnimationFrame(onVisible);
    return () => window.cancelAnimationFrame(frame);
  }
  let registry = chatMediaObservers.get(root);
  if (!registry) {
    registry = { callbacks: new Map(), observer: null };
    registry.observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const callback = registry.callbacks.get(entry.target);
        registry.callbacks.delete(entry.target);
        registry.observer.unobserve(entry.target);
        callback?.();
      }
    }, { root, rootMargin: "420px 0px" });
    chatMediaObservers.set(root, registry);
  }
  registry.callbacks.set(element, onVisible);
  registry.observer.observe(element);
  return () => {
    registry.callbacks.delete(element);
    registry.observer.unobserve(element);
    if (!registry.callbacks.size) {
      registry.observer.disconnect();
      chatMediaObservers.delete(root);
    }
  };
}

function useNearChatViewport(elementRef) {
  const [nearViewport, setNearViewport] = useState(false);
  useEffect(() => {
    if (nearViewport) return undefined;
    const element = elementRef.current;
    if (!element) return undefined;
    return observeChatMedia(element, () => setNearViewport(true));
  }, [elementRef, nearViewport]);
  return nearViewport;
}

function ChatImage({ attachment, t, sticker = false }) {
  const [url, setUrl] = useState(""), [failed, setFailed] = useState(false);
  const mediaRef = useRef(null), nearViewport = useNearChatViewport(mediaRef);
  useEffect(() => {
    if (!nearViewport) return undefined;
    let active = true, objectUrl = "";
    apiFetch(`/api/chat/attachments/${encodeURIComponent(attachment.id)}`, { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("image unavailable"); return response.blob(); })
      .then((blob) => { if (!active) return; objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [attachment.id, nearViewport]);
  const className = `stc-photo${sticker ? " stc-chat-sticker" : ""}`;
  return url ? (sticker
    ? <span ref={mediaRef} className={className} role="img" aria-label={t("chat.stickerAlt")}><img src={url} alt="" draggable={false} decoding="async" /></span>
    : <a ref={mediaRef} className={className} href={url} target="_blank" rel="noreferrer"><img src={url} alt={attachment.name || "Chat attachment"} loading="lazy" decoding="async" /></a>)
    : failed ? <span ref={mediaRef} className={sticker ? "stc-photo-loading stc-sticker-loading" : "stc-attachment-failed"} role="status">{sticker ? <Icon name="image" size={20} /> : t("chat.attachmentUnavailable")}</span>
      : <span ref={mediaRef} className={sticker ? "stc-photo-loading stc-sticker-loading" : "stc-photo-loading"}><Icon name="image" size={20} /></span>;
}

/* Telegram-style voice message: round play button, fixed-width waveform (same size for 5 s or 5 min),
 * "00:24, 492.1 KB" under it. The waveform is drawn from the real audio, resampled to a fixed number of bars. */
const VOICE_BARS = 44;
let activeVoice = null; // only one voice message plays at a time
const formatVoiceTime = (seconds) => { const s = Math.max(0, Math.round(seconds || 0)); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
const formatVoiceSize = (bytes) => (bytes < 1_048_576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1_048_576).toFixed(2)} MB`);
const fallbackPeaks = (seed) => { let h = 2166136261; for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return Array.from({ length: VOICE_BARS }, () => { h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0; return 0.25 + (h % 1000) / 1400; }); };
async function analyseVoice(blob, seed) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    ctx.close?.();
    const data = buffer.getChannelData(0), step = Math.max(1, Math.floor(data.length / VOICE_BARS));
    const raw = Array.from({ length: VOICE_BARS }, (_, i) => { let sum = 0, n = 0; for (let j = i * step; j < Math.min(data.length, (i + 1) * step); j += 16) { sum += data[j] * data[j]; n += 1; } return Math.sqrt(sum / (n || 1)); });
    const max = Math.max(...raw) || 1;
    return { peaks: raw.map((v) => Math.max(0.12, Math.min(1, v / max))), duration: buffer.duration };
  } catch { return { peaks: fallbackPeaks(seed), duration: 0 }; }
}

function ChatAudio({ attachment, t }) {
  const [url, setUrl] = useState(""), [failed, setFailed] = useState(false), [info, setInfo] = useState(null);
  const [playing, setPlaying] = useState(false), [progress, setProgress] = useState(0), [elapsed, setElapsed] = useState(0);
  const mediaRef = useRef(null), audioRef = useRef(null), nearViewport = useNearChatViewport(mediaRef);
  useEffect(() => {
    if (!nearViewport) return undefined;
    let active = true, objectUrl = "";
    apiFetch(`/api/chat/attachments/${encodeURIComponent(attachment.id)}`, { cache: "no-store" })
      .then((response) => { if (!response.ok) throw new Error("audio unavailable"); return response.blob(); })
      .then(async (blob) => {
        const analysed = await analyseVoice(blob, attachment.id);
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setInfo({ ...analysed, size: blob.size });
        setUrl(objectUrl);
      })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [attachment.id, nearViewport]);

  if (failed) return <span ref={mediaRef} className="stc-attachment-failed" role="status">{t("chat.attachmentUnavailable")}</span>;
  if (!url || !info) return <span ref={mediaRef} className="stc-voice is-loading" role="status" aria-label={t("chat.loading")}><span className="stc-voice-play" /><span className="stc-voice-body"><span className="stc-voice-wave">{fallbackPeaks(attachment.id).map((p, i) => <i key={i} style={{ height: `${p * 100}%` }} />)}</span><span className="stc-voice-meta">{t("chat.loading")}</span></span></span>;

  const total = info.duration || audioRef.current?.duration || 0;
  const toggle = () => {
    const el = audioRef.current; if (!el) return;
    if (el.paused) { if (activeVoice && activeVoice !== el) activeVoice.pause(); activeVoice = el; el.play().catch(() => {}); } else el.pause();
  };
  const seek = (event) => {
    const el = audioRef.current; const dur = info.duration || el?.duration; if (!el || !dur || !Number.isFinite(dur)) return;
    const box = event.currentTarget.getBoundingClientRect();
    el.currentTime = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)) * dur;
  };
  return (
    <span ref={mediaRef} className={`stc-voice${playing ? " is-playing" : ""}`} role="group" aria-label={attachment.name || t("chat.voiceMessage")}>
      <button type="button" className="stc-voice-play" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
        {playing
          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4.5" height="14" rx="1.2" /><rect x="13.5" y="5" width="4.5" height="14" rx="1.2" /></svg>
          : <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.4v13.2a1 1 0 0 0 1.5.86l10.6-6.6a1 1 0 0 0 0-1.72L9.5 4.54A1 1 0 0 0 8 5.4Z" /></svg>}
      </button>
      <span className="stc-voice-body">
        <span className="stc-voice-wave" onClick={seek} role="presentation">
          {info.peaks.map((p, i) => <i key={i} className={i / VOICE_BARS < progress ? "is-on" : ""} style={{ height: `${p * 100}%` }} />)}
        </span>
        <span className="stc-voice-meta">{formatVoiceTime(playing || elapsed > 0 ? elapsed : total)}, {formatVoiceSize(info.size)}</span>
      </span>
      <audio ref={audioRef} src={url} preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); setElapsed(0); }}
        onTimeUpdate={(e) => { const el = e.currentTarget; const dur = info.duration || (Number.isFinite(el.duration) ? el.duration : 0); setElapsed(el.currentTime); setProgress(dur ? el.currentTime / dur : 0); }} />
    </span>
  );
}

const DEFAULT_CHAT_SETTINGS = { textSize: "medium", spacing: "comfortable", background: "default", backgroundUrl: "", enterToSend: true };

/* A pasted/picked picture is stored in this browser (localStorage) as a small data: URL. */
const MAX_BG_DATA_URL = 900_000;
const isDataImage = (value) => typeof value === "string" && value.length <= MAX_BG_DATA_URL && /^data:image\/(png|jpe?g|webp|gif);base64,[a-z\d+/=]+$/i.test(value.trim());

/* "site.com/a.jpg", "//site.com/a.jpg" and "https://site.com/a.jpg" all work: the protocol is optional.
   Returns a clean absolute URL (or a data: image), or "" when the text is not a usable image address. */
function normalizeChatImageUrl(value) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";
  if (isDataImage(raw)) return raw;
  if (/^(data|javascript|blob|file|ftp|vbscript):/i.test(raw)) return "";
  let candidate = raw;
  if (candidate.startsWith("//")) candidate = `https:${candidate}`;
  else if (!/^[a-z][a-z\d+.-]*:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  try {
    const url = new URL(candidate);
    const plausibleHost = url.hostname === "localhost" || url.hostname.includes(".") || url.hostname.includes(":");
    if (!["http:", "https:"].includes(url.protocol) || !plausibleHost || url.username || url.password) return "";
    return url.href;
  } catch { return ""; }
}

function readChatSettings(userId) {
  try {
    const saved = JSON.parse(localStorage.getItem(`narxtop_chat_settings:${userId}`) || "{}");
    return {
      ...DEFAULT_CHAT_SETTINGS,
      textSize: ["small", "medium", "large", "xlarge"].includes(saved.textSize) ? saved.textSize : "medium",
      spacing: ["compact", "comfortable"].includes(saved.spacing) ? saved.spacing : "comfortable",
      background: ["default", "midnight", "slate", "paper", "warm", "gradient", "dots", "custom"].includes(saved.background) ? saved.background : "default",
      backgroundUrl: normalizeChatImageUrl(saved.backgroundUrl),
      enterToSend: saved.enterToSend !== false,
    };
  } catch { return DEFAULT_CHAT_SETTINGS; }
}

/* Shrinks a picked/pasted picture to a JPEG data: URL small enough to keep in localStorage. */
async function pictureToBackground(file) {
  if (!file?.type?.startsWith("image/") || file.size > 18 * 1024 * 1024) throw new Error("not an image");
  const readAsDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(blob);
  });
  if (!window.createImageBitmap) {
    const plain = await readAsDataUrl(file);
    if (!isDataImage(plain)) throw new Error("too large");
    return plain;
  }
  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  let result = "";
  for (let attempt = 0; attempt < 6 && !result; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", Math.max(.5, .82 - attempt * .07));
    if (isDataImage(dataUrl) && dataUrl.length <= 600_000) result = dataUrl;
    scale *= .8;
  }
  bitmap.close?.();
  if (!result) throw new Error("too large");
  return result;
}

function ChatSettingsDialog({ settings, savedCustomBackgroundFailed = false, onApply, onClose, t }) {
  const savedCustom = settings.background === "custom" && !savedCustomBackgroundFailed && Boolean(settings.backgroundUrl);
  const [draft, setDraft] = useState(settings);
  const [url, setUrl] = useState(isDataImage(settings.backgroundUrl) ? "" : settings.backgroundUrl || "");
  const [preview, setPreview] = useState(savedCustom ? settings.backgroundUrl : "");
  const [previewState, setPreviewState] = useState(savedCustom ? "ready" : "idle");
  const [urlError, setUrlError] = useState("");
  const [saveError, setSaveError] = useState("");
  const previewImage = useRef(null), previewSequence = useRef(0);
  const dialogRef = useRef(null), pictureRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    dialogRef.current?.querySelector("button, input, select")?.focus();
    const keys = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex="0"]')];
        if (!focusable.length) return;
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
      }
    };
    window.addEventListener("keydown", keys);
    return () => { window.removeEventListener("keydown", keys); opener?.focus?.(); };
  }, [onClose]);

  const resetPreview = () => {
    previewSequence.current += 1;
    if (previewImage.current) previewImage.current.src = "";
    setPreview(""); setUrlError(""); setPreviewState("idle"); setSaveError("");
    return previewSequence.current;
  };

  /* typed / pasted text. The protocol is optional ("site.com/photo.jpg" is fine). */
  const previewUrl = (value) => {
    setUrl(value);
    const sequence = resetPreview();
    if (!value.trim()) { setDraft((state) => (state.background === "custom" ? { ...state, background: "default" } : state)); return; }
    const href = normalizeChatImageUrl(value);
    if (!href) { setUrlError(t("chat.backgroundUrlError")); return; }
    const img = new Image();
    previewImage.current = img;
    setPreviewState("loading");
    img.onload = () => { if (sequence !== previewSequence.current) return; setPreview(href); setPreviewState("ready"); setDraft((state) => ({ ...state, background: "custom" })); };
    img.onerror = () => { if (sequence !== previewSequence.current) return; setPreviewState("error"); setUrlError(t("chat.backgroundLoadError")); };
    img.src = href;
  };

  /* a picture pasted with Ctrl+V (or chosen with the file button) */
  const applyPicture = async (file) => {
    const sequence = resetPreview();
    setUrl("");
    setPreviewState("loading");
    try {
      const dataUrl = await pictureToBackground(file);
      if (sequence !== previewSequence.current) return;
      setPreview(dataUrl); setPreviewState("ready");
      setDraft((state) => ({ ...state, background: "custom" }));
    } catch {
      if (sequence !== previewSequence.current) return;
      setPreviewState("error"); setUrlError(t("chat.bgTooLarge"));
    }
  };

  /* Ctrl+V anywhere in the dialog: a picture is used as the background, plain text still pastes into the field. */
  useEffect(() => {
    const onPaste = (event) => {
      const picture = Array.from(event.clipboardData?.items ?? []).find((item) => item.kind === "file" && item.type.startsWith("image/"))?.getAsFile();
      if (!picture) return;
      event.preventDefault();
      applyPicture(picture);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = () => {
    if (draft.background === "custom" && !preview) return;
    const backgroundUrl = draft.background === "custom" ? preview : "";
    setSaveError("");
    if (onApply({ ...draft, backgroundUrl }) === false) setSaveError(t("chat.settingsSaveError"));
  };
  const pastedPicture = isDataImage(preview);
  return createPortal(<div className="stc-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section ref={dialogRef} className="stc-settings-dialog" role="dialog" aria-modal="true" aria-labelledby="stc-settings-title" tabIndex={-1}>
      <header className="stc-settings-head"><div><small>{t("chat.settingsEyebrow")}</small><h2 id="stc-settings-title">{t("chat.settings")}</h2></div><button type="button" onClick={onClose} aria-label={t("chat.cancel")}><Icon name="x" size={19} /></button></header>
      <div className="stc-settings-body">
        <fieldset><legend>{t("chat.textSize")}</legend><div className="stc-settings-options">{[["small", "chat.size.small"], ["medium", "chat.size.medium"], ["large", "chat.size.large"], ["xlarge", "chat.size.xlarge"]].map(([value, label]) => <button key={value} type="button" aria-pressed={draft.textSize === value} className={draft.textSize === value ? "is-selected" : ""} onClick={() => setDraft((state) => ({ ...state, textSize: value }))}>{t(label)}</button>)}</div><p className={`stc-settings-preview size-${draft.textSize}`}>{t("chat.previewText")}</p></fieldset>
        <fieldset><legend>{t("chat.spacing")}</legend><div className="stc-settings-options">{[["comfortable", "chat.spacing.comfortable"], ["compact", "chat.spacing.compact"]].map(([value, label]) => <button key={value} type="button" aria-pressed={draft.spacing === value} className={draft.spacing === value ? "is-selected" : ""} onClick={() => setDraft((state) => ({ ...state, spacing: value }))}>{t(label)}</button>)}</div></fieldset>
        <fieldset><legend>{t("chat.background")}</legend><div className="stc-background-options">{[["default", "chat.bg.default"], ["midnight", "chat.bg.midnight"], ["slate", "chat.bg.slate"], ["paper", "chat.bg.paper"], ["warm", "chat.bg.warm"], ["gradient", "chat.bg.gradient"], ["dots", "chat.bg.dots"]].map(([value, label]) => <button key={value} type="button" className={`stc-bg-choice bg-${value} ${draft.background === value ? "is-selected" : ""}`} aria-pressed={draft.background === value} onClick={() => setDraft((state) => ({ ...state, background: value }))}><span aria-hidden="true" />{t(label)}</button>)}</div>
          <label className="stc-background-url"><span>{t("chat.backgroundUrl")}</span><input type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={url} onChange={(event) => previewUrl(event.target.value)} placeholder="example.com/image.jpg" aria-invalid={Boolean(urlError)} /></label>
          <div className="stc-bg-paste"><span><Icon name="image" size={16} />{t("chat.bgPasteHint")}</span><input ref={pictureRef} type="file" accept="image/*" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) applyPicture(file); }} /><button type="button" onClick={() => pictureRef.current?.click()}>{t("chat.bgChoose")}</button></div>
          {previewState === "loading" && <p className="stc-settings-hint" role="status">{t("chat.backgroundLoading")}</p>}
          {urlError && <p className="stc-settings-error" role="alert">{urlError}</p>}
          {preview && <div className="stc-url-preview"><img src={preview} alt={t("chat.backgroundPreview")} /><span>{pastedPicture ? t("chat.bgPasted") : t("chat.backgroundPreview")}</span><button type="button" onClick={() => setDraft((state) => ({ ...state, background: "custom" }))}>{t("chat.bg.custom")}</button></div>}
          <button type="button" className={`stc-bg-choice bg-custom ${draft.background === "custom" ? "is-selected" : ""}`} aria-pressed={draft.background === "custom"} disabled={!preview} onClick={() => setDraft((state) => ({ ...state, background: "custom" }))}>{t("chat.bg.custom")}</button>
        </fieldset>
        <label className="stc-settings-toggle"><input type="checkbox" checked={draft.enterToSend} onChange={(event) => setDraft((state) => ({ ...state, enterToSend: event.target.checked }))} /><span>{t("chat.enterToSend")}</span></label>
      </div>
      {saveError && <p className="stc-settings-error" role="alert">{saveError}</p>}
      <footer className="stc-settings-foot"><button type="button" className="stc-settings-reset" onClick={() => { setDraft(DEFAULT_CHAT_SETTINGS); setUrl(""); resetPreview(); }}>{t("chat.reset")}</button><span /><button type="button" onClick={onClose}>{t("chat.cancel")}</button><button type="button" className="is-primary" onClick={apply} disabled={draft.background === "custom" && (Boolean(urlError) || previewState === "loading" || !preview)}>{t("chat.apply")}</button></footer>
    </section>
  </div>, document.body);
}

function ReadReceiptsDialog({ message, onClose, lang, t, now }) {
  const [query, setQuery] = useState("");
  const [readers, setReaders] = useState([]), [loading, setLoading] = useState(true), [loadError, setLoadError] = useState("");
  const dialogRef = useRef(null);
  const receiptSignature = (message?.readBy ?? []).map((reader) => `${reader.userId}:${reader.readAt}`).join("|");
  const rows = readers.filter((reader) => !query || `${reader.name} ${reader.username || ""}`.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => {
    let active = true;
    apiFetch(`/api/chat/messages/${encodeURIComponent(message.id)}/readers`, { cache: "no-store" })
      .then(apiMessage)
      .then((body) => { if (active) { setReaders(body.readers ?? []); setLoadError(""); } })
      .catch((error) => { if (active) { setLoadError(error.message || t("chat.readersError")); setReaders([]); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [message.id, receiptSignature, t]);
  useEffect(() => {
    const opener = document.activeElement;
    dialogRef.current?.querySelector("button, input")?.focus();
    const keys = (event) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && dialogRef.current) {
        const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), input:not([disabled])')];
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0]?.focus(); }
      }
    };
    window.addEventListener("keydown", keys);
    return () => { window.removeEventListener("keydown", keys); opener?.focus?.(); };
  }, [onClose]);
  return createPortal(<div className="stc-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section ref={dialogRef} className="stc-receipt-dialog" role="dialog" aria-modal="true" aria-labelledby="stc-receipts-title"><header><div><small>{t("chat.groupRead")}</small><h2 id="stc-receipts-title">{t("chat.readByCount", { count: readers.length })}</h2></div><button type="button" onClick={onClose} aria-label={t("chat.cancel")}><Icon name="x" size={19} /></button></header><label className="stc-receipt-search"><Icon name="search" size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("chat.searchMembers")} /></label>{loading ? <p className="stc-receipt-state" role="status">{t("chat.loading")}</p> : loadError ? <p className="stc-receipt-state is-error" role="alert">{loadError}</p> : readers.length === 0 ? <p className="stc-receipt-state">{t("chat.noReaders")}</p> : <ul>{rows.map((reader) => <li key={reader.id}><MemberAvatar member={reader} className="stc-receipt-avatar" /><span className="stc-receipt-copy"><b>{reader.name}</b>{reader.username && <small>@{reader.username.replace(/^@/, "")}</small>}<small>{receiptTimeLabel(reader.readAt, now, t, lang)}</small></span><Icon name="check" size={16} /></li>)}</ul>}</section></div>, document.body);
}

async function compressPhoto(file) {
  if (!file.type.startsWith("image/") || file.size > 18 * 1024 * 1024) throw new Error("Photo must be an image under 18 MB.");
  if (!window.createImageBitmap) {
    if (file.size > 2 * 1024 * 1024) throw new Error("This browser cannot resize large photos. Choose one under 2 MB.");
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read this photo."));
      reader.readAsDataURL(file);
    });
  }
  const bitmap = await createImageBitmap(file);
  let scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  let blob;
  for (let attempt = 0; attempt < 5; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d", { alpha: false }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", Math.max(.48, .84 - attempt * .09)));
    if (blob && blob.size <= 2 * 1024 * 1024) break;
    scale *= .8;
  }
  bitmap.close?.();
  if (!blob || blob.size > 2 * 1024 * 1024) throw new Error("Photo is still too large after resizing.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read this photo."));
    reader.readAsDataURL(blob);
  });
}


/* Telegram-style panel: Emoji and Stickers tabs, stickers grouped by pack with the pack name above each group and a
   pack strip at the bottom. Tap a sticker to send it; press and HOLD to see it large — the preview stays until the
   finger / mouse button is released, sliding over other stickers switches the preview, and releasing never sends. */
const HOLD_MS = 230;
function StickerPicker({ packs, emojis, busy, connected, onSend, onEmoji, onClose, t }) {
  const [tab, setTab] = useState("stickers");
  const [activePack, setActivePack] = useState(packs[0]?.id);
  const [preview, setPreview] = useState(null);
  const gridRef = useRef(null), previewRef = useRef(null), sectionRefs = useRef({});
  const press = useRef({ timer: 0, held: false, x: 0, y: 0 });
  const suppressClick = useRef(false);
  const byId = useMemo(() => new Map(packs.flatMap((pack) => pack.stickers).map((sticker) => [sticker.id, sticker])), [packs]);

  const showPreview = useCallback((sticker) => { previewRef.current = sticker; setPreview(sticker); }, []);
  const cancelPress = useCallback(() => { window.clearTimeout(press.current.timer); press.current.timer = 0; }, []);
  const endPress = useCallback(() => {
    cancelPress();
    if (press.current.held) {
      press.current.held = false;
      suppressClick.current = true; // the click that follows the release must not send the sticker
      window.setTimeout(() => { suppressClick.current = false; }, 80);
      previewRef.current = null; setPreview(null);
    }
  }, [cancelPress]);

  useEffect(() => () => window.clearTimeout(press.current.timer), []);

  /* once the preview is up, the grid must not scroll under the finger (needs a non-passive listener) */
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return undefined;
    const block = (event) => { if (press.current.held && event.cancelable) event.preventDefault(); };
    grid.addEventListener("touchmove", block, { passive: false });
    return () => grid.removeEventListener("touchmove", block);
  }, [tab]);

  /* leaving the tab / losing focus must not leave a preview stuck on screen */
  useEffect(() => {
    if (!preview) return undefined;
    const drop = () => endPress();
    window.addEventListener("blur", drop);
    document.addEventListener("visibilitychange", drop);
    return () => { window.removeEventListener("blur", drop); document.removeEventListener("visibilitychange", drop); };
  }, [preview, endPress]);

  const stickerAt = (element) => byId.get(element?.closest?.("[data-sticker-id]")?.dataset.stickerId);

  const onPointerDown = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const sticker = stickerAt(event.target);
    if (!sticker) return;
    cancelPress();
    press.current = { timer: 0, held: false, x: event.clientX, y: event.clientY };
    press.current.timer = window.setTimeout(() => { press.current.held = true; showPreview(sticker); }, HOLD_MS);
  };
  const onPointerMove = (event) => {
    if (press.current.held) {
      const sticker = stickerAt(document.elementFromPoint(event.clientX, event.clientY));
      if (sticker && sticker.id !== previewRef.current?.id) showPreview(sticker);
    } else if (press.current.timer && Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 10) cancelPress(); // the user is scrolling
  };

  /* the pack strip follows the scroll position, and tapping a pack scrolls to it */
  const onScroll = () => {
    const grid = gridRef.current;
    if (!grid) return;
    let current = packs[0]?.id;
    for (const pack of packs) if ((sectionRefs.current[pack.id]?.offsetTop ?? 0) - 12 <= grid.scrollTop) current = pack.id;
    setActivePack(current);
  };
  const goToPack = (id) => {
    const grid = gridRef.current, section = sectionRefs.current[id];
    if (!grid || !section) return;
    setActivePack(id);
    grid.scrollTo({ top: section.offsetTop, behavior: document.documentElement.dataset.motion === "off" ? "auto" : "smooth" });
  };

  return <div className="stc-sticker-pop" role="dialog" aria-label={t("chat.stickers")}>
    <header className="stc-pop-head">
      <div className="stc-pop-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === "emoji"} className={tab === "emoji" ? "is-on" : ""} onClick={() => setTab("emoji")}>{t("chat.emojiTab")}</button>
        <button type="button" role="tab" aria-selected={tab === "stickers"} className={tab === "stickers" ? "is-on" : ""} onClick={() => setTab("stickers")}>{t("chat.stickers")}</button>
      </div>
      <button type="button" className="stc-pop-x" onClick={onClose} aria-label={t("chat.cancel")}><Icon name="x" size={16} /></button>
    </header>

    {tab === "emoji" ? (
      <div className="stc-emoji-grid" role="group" aria-label={t("chat.emoji")}>
        {emojis.map((emoji) => <button type="button" key={emoji} onClick={() => onEmoji(emoji)}>{emoji}</button>)}
      </div>
    ) : (
      <>
        <div className="stc-sticker-grid" ref={gridRef} onScroll={onScroll} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endPress} onPointerCancel={endPress} onContextMenu={(event) => event.preventDefault()}>
          {packs.map((pack) => (
            <section key={pack.id} className="stc-pack" ref={(node) => { sectionRefs.current[pack.id] = node; }} aria-label={pack.name}>
              <h3 className="stc-pack-name"><b>{pack.name}</b><small>{t("chat.packCount", { n: pack.stickers.length })}</small></h3>
              <div className="stc-pack-grid">
                {pack.stickers.map((sticker, index) => <button type="button" key={sticker.id} data-sticker-id={sticker.id} aria-disabled={busy || !connected} className={preview?.id === sticker.id ? "is-previewing" : ""}
                  title={`${pack.name} · ${index + 1}`} aria-label={t("chat.sendSticker", { number: index + 1 })}
                  onClick={(event) => { if (suppressClick.current) { event.preventDefault(); return; } if (!busy && connected) onSend(sticker); }}>
                  <img src={sticker.src} alt="" loading="lazy" decoding="async" draggable={false} />
                </button>)}
              </div>
            </section>
          ))}
        </div>
        <nav className="stc-pack-strip" aria-label={t("chat.stickers")}>
          {packs.map((pack) => <button type="button" key={pack.id} className={activePack === pack.id ? "is-on" : ""} onClick={() => goToPack(pack.id)} title={pack.name} aria-label={pack.name} aria-current={activePack === pack.id ? "true" : undefined}>
            <img src={pack.stickers[0].src} alt="" draggable={false} />
          </button>)}
        </nav>
      </>
    )}
    {preview && createPortal(<div className="stc-sticker-preview" aria-hidden="true"><img key={preview.id} src={preview.src} alt="" draggable={false} /></div>, document.body)}
  </div>;
}

function StaffChatApp({ user, role }) {
  const { t, lang } = useLang();
  const [members, setMembers] = useState([]), [removedMembers, setRemovedMembers] = useState([]), [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(false), [loading, setLoading] = useState(true), [draggingFiles, setDraggingFiles] = useState(false);
  const [text, setText] = useState(""), [files, setFiles] = useState([]), [error, setError] = useState("");
  const [mobilePeople, setMobilePeople] = useState(false), [emojiOpen, setEmojiOpen] = useState(false), [stickerOpen, setStickerOpen] = useState(false), [clearOpen, setClearOpen] = useState(false), [removedOpen, setRemovedOpen] = useState(false);
  const [settings, setSettings] = useState(() => readChatSettings(user.id)), [settingsOpen, setSettingsOpen] = useState(false);
  const [customBackgroundFailed, setCustomBackgroundFailed] = useState(false);
  const [replyTo, setReplyTo] = useState(null), [messageMenu, setMessageMenu] = useState(null), [readDialog, setReadDialog] = useState(null);
  const [typingMembers, setTypingMembers] = useState([]), [newMessages, setNewMessages] = useState(false);
  const [recording, setRecording] = useState(false), [recordedSeconds, setRecordedSeconds] = useState(0);
  const [profileDialog, setProfileDialog] = useState(null);
  /* microphone permission: "checking" | "granted" | "ask" (prompt was dismissed / not shown) | "denied" | "insecure" | "unsupported" */
  const [micState, setMicState] = useState("checking"), [micBannerHidden, setMicBannerHidden] = useState(false);
  const [busy, setBusy] = useState(false), [now, setNow] = useState(() => Date.now());
  const socketRef = useRef(null), inputRef = useRef(null), listRef = useRef(null), fileRef = useRef(null), bottomRef = useRef(null), filesRef = useRef([]), profileRequestRef = useRef(0), profileOpenerRef = useRef(null);
  const messageMenuRef = useRef(null);
  const messagesRef = useRef([]), readSentRef = useRef(new Set()), visibleMessageIdsRef = useRef(new Set()), nearBottomRef = useRef(true), typingTimerRef = useRef(null), typingSetRef = useRef(false), typingExpiryRef = useRef(new Map());
  const recorderRef = useRef(null), recorderStreamRef = useRef(null), recordingPartsRef = useRef([]), cancelRecordingRef = useRef(false), recordingTimerRef = useRef(null);
  const canManage = executive(role);
  const closeProfile = useCallback(() => {
    profileRequestRef.current += 1;
    setProfileDialog(null);
    requestAnimationFrame(() => profileOpenerRef.current?.focus?.());
  }, []);
  const openMemberProfile = useCallback(async (member) => {
    if (!canManage) return;
    profileOpenerRef.current = document.activeElement;
    const requestId = ++profileRequestRef.current;
    setProfileDialog({ member, user: null, loading: true, error: "" });
    try {
      const body = await apiMessage(await apiFetch(`/api/chat/members/${encodeURIComponent(member.id)}/profile`, { cache: "no-store" }));
      if (requestId === profileRequestRef.current) setProfileDialog({ member, user: body.user, loading: false, error: "" });
    } catch {
      if (requestId === profileRequestRef.current) setProfileDialog({ member, user: null, loading: false, error: t("chat.profileError") });
    }
  }, [canManage, t]);

  const refreshRoster = useCallback(async () => {
    try { const body = await apiMessage(await apiFetch("/api/chat/roster", { cache: "no-store" })); setMembers(body.members ?? []); setRemovedMembers(body.removedMembers ?? []); }
    catch (e) { if (e.status === 403) { setMembers([]); setRemovedMembers([]); } setError(e.message); }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const body = await apiMessage(await apiFetch("/api/chat/messages", { cache: "no-store" }));
      setMessages(body.messages ?? []); setError("");
    } catch (e) { if (e.status === 403) setMessages([]); setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => {
    try { localStorage.setItem(`narxtop_chat_settings:${user.id}`, JSON.stringify(settings)); } catch { /* storage can be disabled */ }
  }, [settings, user.id]);
  useEffect(() => {
    if (settings.background !== "custom" || !settings.backgroundUrl) return undefined;
    let active = true;
    const image = new Image();
    image.onload = () => { if (active) setCustomBackgroundFailed(false); };
    image.onerror = () => { if (active) setCustomBackgroundFailed(true); };
    image.src = settings.backgroundUrl;
    return () => { active = false; image.onload = null; image.onerror = null; };
  }, [settings.background, settings.backgroundUrl]);
  useEffect(() => () => {
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
    for (const timer of typingExpiryRef.current.values()) window.clearTimeout(timer);
    recorderRef.current?.stream?.getTracks().forEach((track) => track.stop());
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  /* Every time /chat opens (page load or refresh) the browser is asked for the microphone unless it is already allowed,
     on phones and on computers. A blocked microphone cannot be re-asked by a page, so a short how-to banner shows instead. */
  const settleMicFailure = useCallback(async (cause) => {
    let permission = "";
    try { permission = (await navigator.permissions?.query({ name: "microphone" }))?.state ?? ""; } catch { /* Safari / Firefox cannot query it */ }
    if (permission === "denied" || cause?.name === "SecurityError") setMicState("denied");
    else if (["NotFoundError", "NotReadableError", "OverconstrainedError"].includes(cause?.name)) setMicState("unsupported");
    else setMicState("ask"); // prompt dismissed or not shown: a tap on "Allow" asks again
    setMicBannerHidden(false);
  }, []);
  const requestMic = useCallback(async () => {
    if (!window.isSecureContext) { setMicState("insecure"); return; }
    if (!navigator.mediaDevices?.getUserMedia) { setMicState("unsupported"); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop()); // permission only — nothing is recorded here
      setMicState("granted"); setMicBannerHidden(false);
    } catch (cause) { await settleMicFailure(cause); }
  }, [settleMicFailure]);
  useEffect(() => {
    let active = true, status = null;
    (async () => {
      if (!window.isSecureContext) { setMicState("insecure"); return; }
      if (!navigator.mediaDevices?.getUserMedia) { setMicState("unsupported"); return; }
      let permission = "prompt";
      try {
        status = await navigator.permissions?.query({ name: "microphone" });
        permission = status?.state ?? "prompt";
        if (status) status.onchange = () => { if (active) setMicState(status.state === "granted" ? "granted" : status.state === "denied" ? "denied" : "ask"); };
      } catch { /* not supported: just ask */ }
      if (!active) return;
      if (permission === "granted") setMicState("granted");
      else if (permission === "denied") setMicState("denied");
      else await requestMic(); // shows the browser's own permission prompt
    })();
    return () => { active = false; if (status) status.onchange = null; };
  }, [requestMic]);

  const markVisibleAsRead = useCallback(() => {
    const socket = socketRef.current;
    if (document.visibilityState !== "visible" || !document.hasFocus() || socket?.readyState !== WebSocket.OPEN) return;
    const visibleIds = visibleMessageIdsRef.current;
    const unread = messagesRef.current.filter((message) => visibleIds.has(message.id) && message.senderId !== user.id && !(message.readBy ?? []).some((reader) => reader.userId === user.id) && !readSentRef.current.has(message.id)).map((message) => message.id);
    if (!unread.length) return;
    unread.forEach((id) => readSentRef.current.add(id));
    socket.send(JSON.stringify({ type: "read", ids: unread }));
  }, [user.id]);

  const liveMembers = useMemo(() => members.filter((member) => !member.kickedAt), [members]);
  const memberById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);

  useEffect(() => { loadHistory(); refreshRoster(); }, [loadHistory, refreshRoster]); // eslint-disable-line react-hooks/set-state-in-effect
  useEffect(() => {
    const root = listRef.current;
    if (!root) return undefined;
    const visibleIds = visibleMessageIdsRef.current;
    if (typeof IntersectionObserver === "undefined") {
      const scanVisibleMessages = () => {
        const listRect = root.getBoundingClientRect();
        visibleIds.clear();
        root.querySelectorAll("[data-message-id]").forEach((element) => {
          const rect = element.getBoundingClientRect();
          const visibleHeight = Math.max(0, Math.min(rect.bottom, listRect.bottom) - Math.max(rect.top, listRect.top));
          const visibleWidth = Math.max(0, Math.min(rect.right, listRect.right) - Math.max(rect.left, listRect.left));
          if (visibleHeight >= Math.min(rect.height * 0.5, 160) && visibleWidth >= Math.min(rect.width * 0.7, 120)) visibleIds.add(element.dataset.messageId);
        });
        markVisibleAsRead();
      };
      scanVisibleMessages();
      root.addEventListener("scroll", scanVisibleMessages, { passive: true });
      return () => root.removeEventListener("scroll", scanVisibleMessages);
    }
    visibleIds.clear();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        const id = entry.target.dataset.messageId;
        if (!id) continue;
        const box = entry.boundingClientRect, visible = entry.intersectionRect;
        const sufficientlyVisible = entry.isIntersecting
          && visible.height >= Math.min(box.height * 0.5, 160)
          && visible.width >= Math.min(box.width * 0.7, 120);
        if (sufficientlyVisible) visibleIds.add(id);
        else visibleIds.delete(id);
      }
      markVisibleAsRead();
    }, { root, threshold: [0, 0.1, 0.16, 0.25, 0.5] });
    root.querySelectorAll("[data-message-id]").forEach((element) => observer.observe(element));
    return () => { observer.disconnect(); visibleIds.clear(); };
  }, [messages.length, connected, loading, markVisibleAsRead]);
  useEffect(() => {
    let active = true, reconnectTimer;
    const connect = () => {
      if (!active) return;
      const url = new URL(apiUrl("/api/chat/live"), window.location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      let socket;
      try { socket = new WebSocket(url); } catch { reconnectTimer = window.setTimeout(connect, 1800); return; }
      socketRef.current = socket;
        socket.onopen = () => { if (active) { setConnected(true); setError(""); } };
      socket.onmessage = (event) => {
        let data;
        try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === "message" && data.message) {
          setMessages((items) => items.some((item) => item.id === data.message.id) ? items : [...items, data.message]);
          setTypingMembers((items) => items.filter((member) => member.id !== data.message.senderId));
          if (data.message.senderId !== user.id && !nearBottomRef.current) setNewMessages(true);
          if (data.message.senderId !== user.id) chatToast(data.message, t);
        }
        else if (data.type === "receipts" && Array.isArray(data.receipts)) {
          const receipts = new Map(data.receipts.map((receipt) => [receipt.id, receipt.readBy]));
          setMessages((items) => items.map((message) => receipts.has(message.id) ? { ...message, readBy: receipts.get(message.id) } : message));
        }
        else if (data.type === "typing") {
          const existingTimer = typingExpiryRef.current.get(data.id);
          if (existingTimer) window.clearTimeout(existingTimer);
          if (!data.typing || data.id === user.id) {
            typingExpiryRef.current.delete(data.id);
            setTypingMembers((items) => items.filter((member) => member.id !== data.id));
          } else {
            const timeout = window.setTimeout(() => {
              typingExpiryRef.current.delete(data.id);
              setTypingMembers((items) => items.filter((member) => member.id !== data.id));
            }, 7500);
            typingExpiryRef.current.set(data.id, timeout);
            setTypingMembers((items) => [...items.filter((member) => member.id !== data.id), { id: data.id, name: data.name || "" }]);
          }
        }
        else if (data.type === "deleted") setMessages((items) => items.filter((item) => item.id !== data.id));
        else if (data.type === "cleared") setMessages([]);
        else if (data.type === "member") refreshRoster();
        else if (data.type === "error") setError(data.message || t("chat.error"));
      };
      socket.onclose = (event) => {
        if (!active) return;
        setConnected(false);
        typingSetRef.current = false;
        if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
        typingTimerRef.current = null;
        setTypingMembers([]);
        readSentRef.current.clear();
        if (event.code === 4003) { setMembers([]); setRemovedMembers([]); setMessages([]); setError(t("chat.removedError")); return; }
        reconnectTimer = window.setTimeout(connect, 1800);
      };
      socket.onerror = () => { try { socket.close(); } catch { /* already closed */ } };
    };
    connect();
    return () => { active = false; window.clearTimeout(reconnectTimer); socketRef.current?.close(); socketRef.current = null; };
  }, [refreshRoster, t, user.id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    const refresh = () => { loadHistory(); refreshRoster(); };
    const rosterTimer = window.setInterval(refreshRoster, 60_000);
    window.addEventListener("focus", refresh);
    return () => { window.clearInterval(timer); window.clearInterval(rosterTimer); window.removeEventListener("focus", refresh); };
  }, [loadHistory, refreshRoster]);

  const latestMessageSenderId = messages.at(-1)?.senderId;
  useEffect(() => {
    if (!messages.length) return;
    if (nearBottomRef.current || latestMessageSenderId === user.id) {
      const lowPower = document.documentElement.dataset.performance === "low"
        || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
        || window.matchMedia?.("(max-width: 760px)").matches;
      bottomRef.current?.scrollIntoView({ block: "end", behavior: !lowPower && latestMessageSenderId === user.id ? "smooth" : "auto" });
      nearBottomRef.current = true;
      setNewMessages(false);
    } else setNewMessages(true);
  }, [messages.length, latestMessageSenderId, user.id]);
  useEffect(() => { markVisibleAsRead(); }, [messages.length, connected, markVisibleAsRead]);
  useEffect(() => {
    const onActive = () => { if (document.visibilityState === "visible") markVisibleAsRead(); };
    document.addEventListener("visibilitychange", onActive);
    window.addEventListener("focus", onActive);
    return () => { document.removeEventListener("visibilitychange", onActive); window.removeEventListener("focus", onActive); };
  }, [markVisibleAsRead]);
  useEffect(() => {
    if (!stickerOpen && !emojiOpen) return undefined;
    const close = () => { setStickerOpen(false); setEmojiOpen(false); };
    const onKey = (event) => { if (event.key === "Escape") close(); };
    const onDown = (event) => { if (!event.target.closest?.(".stc-sticker-pop, .stc-emoji-pop, .stc-tool")) close(); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onDown); };
  }, [stickerOpen, emojiOpen]);
  useEffect(() => {
    if (!messageMenu) return undefined;
    const outside = (event) => { if (!messageMenuRef.current?.contains(event.target)) setMessageMenu(null); };
    const escape = (event) => { if (event.key === "Escape") setMessageMenu(null); };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [messageMenu]);
  useEffect(() => () => filesRef.current.forEach((item) => URL.revokeObjectURL(item.url)), []);

  const addFiles = useCallback((incoming) => {
    const candidates = Array.from(incoming ?? []);
    const images = candidates.filter((file) => file.type.startsWith("image/"));
    const chosen = images.slice(0, 4 - filesRef.current.length);
    if (candidates.length !== images.length) setError(t("chat.dropOnlyImages"));
    if (images.length > chosen.length) setError(t("chat.photoLimit"));
    if (!chosen.length) return;
    const added = chosen.map((file) => ({ file, url: URL.createObjectURL(file), key: `${file.name}-${file.lastModified}-${Math.random()}` }));
    const next = [...filesRef.current, ...added].slice(0, 4);
    filesRef.current = next;
    setFiles(next);
  }, [t]);

  const addAudioFile = useCallback((file) => {
    if (file.size > 1_500_000) { setError(t("chat.audioTooLarge")); return; }
    if (filesRef.current.length >= 4) { setError(t("chat.fileLimit")); return; }
    const item = { file, url: URL.createObjectURL(file), key: `${file.name}-${file.lastModified}-${Math.random()}` };
    const next = [...filesRef.current, item];
    filesRef.current = next;
    setFiles(next);
    setError("");
  }, [t]);

  const removeFile = (key) => {
    const removed = filesRef.current.find((item) => item.key === key);
    if (removed) URL.revokeObjectURL(removed.url);
    const next = filesRef.current.filter((item) => item.key !== key);
    filesRef.current = next;
    setFiles(next);
  };

  const pastePhoto = (event) => {
    const clipboardFiles = Array.from(event.clipboardData?.items ?? []).filter((item) => item.type.startsWith("image/")).map((item) => item.getAsFile()).filter(Boolean);
    if (clipboardFiles.length) { event.preventDefault(); addFiles(clipboardFiles); }
  };

  const handleFileDrag = (event) => {
    if (!Array.from(event.dataTransfer?.types ?? []).includes("Files")) return;
    event.preventDefault();
    setDraggingFiles(true);
  };
  const handleFileDragLeave = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) setDraggingFiles(false);
  };
  const handleFileDrop = (event) => {
    if (!Array.from(event.dataTransfer?.types ?? []).includes("Files")) return;
    event.preventDefault();
    setDraggingFiles(false);
    addFiles(event.dataTransfer.files);
  };

  const stopTyping = useCallback(() => {
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = null;
    if (typingSetRef.current && socketRef.current?.readyState === WebSocket.OPEN) socketRef.current.send(JSON.stringify({ type: "typing-stop" }));
    typingSetRef.current = false;
  }, []);

  const updateTyping = useCallback((value) => {
    const socket = socketRef.current;
    if (!value.trim() || socket?.readyState !== WebSocket.OPEN) { stopTyping(); return; }
    if (!typingSetRef.current) { socket.send(JSON.stringify({ type: "typing" })); typingSetRef.current = true; }
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(stopTyping, 1800);
  }, [stopTyping]);

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setError(t("chat.audioUnsupported")); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicState("granted");
      const supported = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4"].find((type) => MediaRecorder.isTypeSupported?.(type));
      const recorder = new MediaRecorder(stream, supported ? { mimeType: supported } : undefined);
      recorderRef.current = recorder; recorderStreamRef.current = stream; recordingPartsRef.current = []; cancelRecordingRef.current = false;
      recorder.ondataavailable = (event) => { if (event.data?.size) recordingPartsRef.current.push(event.data); };
      recorder.onstop = () => {
        const blob = new Blob(recordingPartsRef.current, { type: recorder.mimeType || "audio/webm" });
        if (!cancelRecordingRef.current && blob.size) {
          const type = (blob.type.split(";")[0] || "audio/webm").toLowerCase();
          const ext = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4", "audio/wav": "wav", "audio/mpeg": "mp3" }[type];
          if (ext) addAudioFile(new File([blob], `voice-message.${ext}`, { type }));
          else setError(t("chat.audioUnsupported"));
        }
        stream.getTracks().forEach((track) => track.stop());
        recorderStreamRef.current = null; recorderRef.current = null;
        if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null; setRecording(false); setRecordedSeconds(0);
      };
      recorder.start(250); setRecording(true); setRecordedSeconds(0); setError("");
      const recordingStartedAt = Date.now();
      recordingTimerRef.current = window.setInterval(() => {
        const seconds = Math.floor((Date.now() - recordingStartedAt) / 1000);
        setRecordedSeconds(seconds);
        if (seconds >= 120 && recorder.state === "recording") recorder.stop();
      }, 1000);
    } catch (cause) {
      if (cause?.name === "NotAllowedError") { setError(t("chat.audioPermission")); await settleMicFailure(cause); }
      else setError(t("chat.audioUnsupported"));
    }
  };

  const stopRecording = () => { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); };
  const cancelRecording = () => { cancelRecordingRef.current = true; stopRecording(); };

  const send = async (event) => {
    event?.preventDefault();
    const socket = socketRef.current, bodyText = text.trim();
    if ((!bodyText && !filesRef.current.length) || !socket || socket.readyState !== WebSocket.OPEN || busy) return;
    setBusy(true); setError("");
    try {
      const attachmentIds = [];
      for (const item of filesRef.current) {
        const data = item.file.type.startsWith("image/") ? await compressPhoto(item.file) : await new Promise((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error(t("chat.audioReadError"))); reader.readAsDataURL(item.file);
        });
        const response = await apiFetch("/api/chat/attachments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data, name: item.file.name }) });
        const result = await apiMessage(response);
        attachmentIds.push(result.attachment.id);
      }
      if (socket.readyState !== WebSocket.OPEN) throw new Error(t("chat.error"));
      socket.send(JSON.stringify({ type: "send", text: bodyText, attachmentIds, replyToId: replyTo?.id || null }));
      stopTyping(); setText(""); setReplyTo(null);
      filesRef.current.forEach((item) => URL.revokeObjectURL(item.url)); filesRef.current = []; setFiles([]); setEmojiOpen(false); setStickerOpen(false);
      inputRef.current?.focus();
    } catch (e) { setError(e.message || t("chat.error")); }
    finally { setBusy(false); }
  };

  const sendSticker = async (sticker) => {
    const socket = socketRef.current;
    if (busy || !socket || socket.readyState !== WebSocket.OPEN) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(sticker.src, { cache: "force-cache" });
      if (!response.ok) throw new Error(t("chat.error"));
      const blob = await response.blob();
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error(t("chat.error")));
        reader.readAsDataURL(blob);
      });
      const uploaded = await apiMessage(await apiFetch("/api/chat/attachments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data, name: `${sticker.id.replace("narxtop-", "narxtop-sticker-")}.webp` }),
      }));
      if (socket.readyState !== WebSocket.OPEN) throw new Error(t("chat.error"));
      socket.send(JSON.stringify({ type: "send", text: "", attachmentIds: [uploaded.attachment.id], replyToId: replyTo?.id || null }));
      setReplyTo(null); setStickerOpen(false); setEmojiOpen(false);
    } catch (cause) { setError(cause.message || t("chat.error")); }
    finally { setBusy(false); }
  };

  const removeMessage = async (id) => {
    try { await apiMessage(await apiFetch(`/api/chat/messages/${encodeURIComponent(id)}`, { method: "DELETE" })); setMessages((items) => items.filter((item) => item.id !== id)); }
    catch (e) { setError(e.message); }
  };

  const clearHistory = async () => {
    setBusy(true);
    try { await apiMessage(await apiFetch("/api/chat/messages", { method: "DELETE" })); setMessages([]); setClearOpen(false); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const changeMembership = async (member) => {
    const action = member.kickedAt ? "restore" : "kick";
    setBusy(true);
    try {
      await apiMessage(await apiFetch(`/api/chat/members/${encodeURIComponent(member.id)}/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }));
      await refreshRoster();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const replyToMessage = (message) => {
    setReplyTo({ id: message.id, senderName: message.senderName, text: message.text || (message.attachments?.some((item) => item.type?.startsWith("audio/")) ? t("chat.voiceMessage") : t("chat.photo")) });
    setMessageMenu(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const jumpToMessage = (id) => {
    const reveal = () => {
      const target = listRef.current?.querySelector(`[data-message-id="${CSS.escape(id)}"]`);
      if (!target) return false;
      target.scrollIntoView({ block: "center", behavior: "smooth" });
      target.classList.add("is-highlighted");
      window.setTimeout(() => target.classList.remove("is-highlighted"), 1700);
      return true;
    };
    if (reveal()) return;
    apiFetch(`/api/chat/messages/${encodeURIComponent(id)}`, { cache: "no-store" }).then(apiMessage).then(({ message }) => {
      setMessages((items) => items.some((item) => item.id === id) ? items : [...items, message].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)));
      window.setTimeout(reveal, 60);
    }).catch((cause) => setError(cause.message || t("chat.originalUnavailable")));
  };

  const openSettings = () => setSettingsOpen(true);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);
  const closeReadDialog = useCallback(() => setReadDialog(null), []);
  const applySettings = (next) => {
    try { localStorage.setItem(`narxtop_chat_settings:${user.id}`, JSON.stringify(next)); }
    catch { return false; }
    setSettings(next); setSettingsOpen(false); setError("");
    return true;
  };

  const addEmoji = (emoji) => {
    const input = inputRef.current, start = input?.selectionStart ?? text.length, end = input?.selectionEnd ?? text.length;
    const next = text.slice(0, start) + emoji + text.slice(end);
    setText(next);
    requestAnimationFrame(() => { inputRef.current?.focus(); inputRef.current?.setSelectionRange(start + emoji.length, start + emoji.length); });
  };

  const withDayMarkers = useMemo(() => {
    const entries = [];
    let previousDay = "";
    const sameGroup = (a, b) => a && b && a.senderId === b.senderId && dateKey(a.createdAt) === dateKey(b.createdAt) && Math.abs(new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) <= 5 * 60_000;
    for (let index = 0; index < messages.length; index += 1) {
      const message = messages[index];
      const key = dateKey(message.createdAt);
      if (key !== previousDay) { entries.push({ kind: "day", key, label: dayLabel(message.createdAt, t, now) }); previousDay = key; }
      const previous = messages[index - 1], next = messages[index + 1];
      entries.push({ kind: "message", message, groupStart: !sameGroup(previous, message), groupEnd: !sameGroup(message, next) });
    }
    return entries;
  }, [messages, now, t]);

  const typingLabel = typingMembers.length === 1 ? `${typingMembers[0].name} ${t("chat.isTyping")}` : typingMembers.length === 2 ? `${typingMembers[0].name}, ${typingMembers[1].name} ${t("chat.areTyping")}` : typingMembers.length > 2 ? t("chat.severalTyping") : "";
  const backgroundImage = settings.background === "custom" && settings.backgroundUrl && !customBackgroundFailed
    ? `linear-gradient(rgba(12, 14, 20, .58), rgba(12, 14, 20, .58)), url("${settings.backgroundUrl}")`
    : undefined;
  const messageFontSize = { small: ".78rem", medium: ".86rem", large: "1rem", xlarge: "1.14rem" }[settings.textSize] || ".86rem";

  /* This renderer creates event handlers inside a synchronous Array.map. The handlers execute after render;
     refs are only read by their event-time callbacks and effects. */
  /* eslint-disable react-hooks/refs */
  return (
      <PageShell wide fixed className="stc-page stc-shell-main">
      <section className={`stc ${mobilePeople ? "is-people-open" : ""}`} aria-label={t("chat.title")} data-text-size={settings.textSize} data-spacing={settings.spacing} data-background={settings.background === "custom" && customBackgroundFailed ? "default" : settings.background} style={{ "--stc-message-font-size": messageFontSize }}>
        <aside className="stc-sidebar" aria-label={t("chat.people")}>
          <div className="stc-sidebar-head"><span className="stc-mark"><Icon name="users" size={20} /></span><div><b>{t("chat.people")}</b><small>{liveMembers.length} {t("chat.member")}</small></div>
            <div className="stc-mini-members" aria-label={t("chat.people")}>{members.slice(0, 3).map((member) => canManage
              ? <button key={member.id} type="button" onClick={() => openMemberProfile(member)} aria-label={`${t("chat.profile")}: ${member.name}`}><MemberAvatar member={member} className="stc-mini-avatar" /></button>
              : <MemberAvatar key={member.id} member={member} className="stc-mini-avatar" />)}{members.length > 3 && <b>+{members.length - 3}</b>}</div>
            <button type="button" className="stc-settings-trigger" onClick={openSettings} aria-label={t("chat.settings")} title={t("chat.settings")}><Icon name="settings" size={17} /></button>
            <button type="button" className="stc-close-people" onClick={() => setMobilePeople(false)} aria-label={t("chat.cancel")}><Icon name="x" size={18} /></button></div>
          <div className="stc-group-label"><span>{t("chat.title")}</span><span>{liveMembers.filter((member) => member.online).length} {t("chat.online")}</span></div>
          <ul className="stc-people">
            {members.map((member) => {
              const canKick = canManage && member.id !== user.id && member.role !== "ceo" && (role === "ceo" || member.role !== "superadmin");
              return <li key={member.id}>
                <div className="stc-member-identity">
                  {canManage ? <button type="button" className="stc-avatar-trigger" onClick={() => openMemberProfile(member)} aria-label={`${t("chat.profile")}: ${member.name}`}><MemberAvatar member={member} className="stc-person-avatar" /><i className={member.online ? "is-online" : ""} /></button>
                    : <span className="stc-avatar-trigger is-static"><MemberAvatar member={member} className="stc-person-avatar" /><i className={member.online ? "is-online" : ""} /></span>}
                  {canManage ? <button type="button" className="stc-name-trigger" onClick={() => openMemberProfile(member)}>
                    <span className="stc-person-copy"><b>{member.name}{member.id === user.id && <small> · {t("chat.you")}</small>}</b><small className="stc-person-sub"><span>{roleText(member.role, t)}</span><span aria-hidden="true">·</span><span className={member.online ? "is-online" : ""}>{activityText(member, now, lang, t)}</span></small></span>
                  </button> : <span className="stc-person-copy"><b>{member.name}{member.id === user.id && <small> · {t("chat.you")}</small>}</b><small className="stc-person-sub"><span>{roleText(member.role, t)}</span><span aria-hidden="true">·</span><span className={member.online ? "is-online" : ""}>{activityText(member, now, lang, t)}</span></small></span>}
                </div>
                {canKick && <button type="button" className="stc-person-action" onClick={() => changeMembership(member)} disabled={busy} aria-label={t("chat.kick")} title={t("chat.kick")}><Icon name="x" size={16} /></button>}
              </li>;
            })}
          </ul>
          <div className="stc-sidebar-foot"><i className={connected ? "is-online" : ""} />{connected ? t("chat.connected") : t("chat.connecting")}</div>
        </aside>

        <main className="stc-main">
          <header className="stc-head">
          <button type="button" className="stc-mobile-people" onClick={() => setMobilePeople(true)} aria-label={t("chat.people")}><Icon name="user" size={19} /></button>
            <div className="stc-group-avatars">{members.slice(0, 3).map((member) => canManage
              ? <button type="button" key={member.id} className="stc-group-avatar-trigger" onClick={() => openMemberProfile(member)} aria-label={`${t("chat.profile")}: ${member.name}`}><MemberAvatar member={member} className="stc-group-avatar" /></button>
              : <MemberAvatar key={member.id} member={member} className="stc-group-avatar" />)}</div>
            <div className="stc-head-title"><h1>{t("chat.title")}</h1>{typingLabel ? <p className="stc-typing" role="status"><span className="stc-typing-dots" aria-hidden="true"><i /><i /><i /></span>{typingLabel}</p> : <p>{liveMembers.length} {t("chat.members")} · {liveMembers.filter((member) => member.online).length} {t("chat.online")}</p>}</div>
            <span className={`stc-connection ${connected ? "is-connected" : ""}`}><i />{connected ? t("chat.connected") : t("chat.connecting")}</span>
            {canManage && removedMembers.length > 0 && <button type="button" className="stc-removed" onClick={() => setRemovedOpen(true)} aria-label={`${t("chat.removedList")}: ${removedMembers.length}`} title={t("chat.removedList")}><span>{t("chat.removedList")}</span><b>{removedMembers.length}</b></button>}
            {canManage && <button type="button" className="stc-clear" onClick={() => setClearOpen(true)} disabled={busy || messages.length === 0}><Icon name="trash" size={16} /><span>{t("chat.clear")}</span></button>}
          </header>

          <div className={`stc-messages ${draggingFiles ? "is-drag-over" : ""}`} ref={listRef} style={backgroundImage ? { backgroundImage } : undefined} aria-live="polite" onDragEnter={handleFileDrag} onDragOver={handleFileDrag} onDragLeave={handleFileDragLeave} onDrop={handleFileDrop} onScroll={(event) => { const box = event.currentTarget; nearBottomRef.current = box.scrollHeight - box.scrollTop - box.clientHeight < 100; if (nearBottomRef.current && newMessages) setNewMessages(false); }} onClick={() => { if (emojiOpen) setEmojiOpen(false); if (stickerOpen) setStickerOpen(false); }}>
            {draggingFiles && <div className="stc-drop-overlay" role="status">{t("chat.dropPhotoHere")}</div>}
            {loading ? <div className="stc-loading"><Skeleton h={64} r={18} /><Skeleton h={82} r={18} /><Skeleton h={60} r={18} /></div> : withDayMarkers.length === 0 ? <div className="stc-empty"><span><Icon name="inbox" size={25} /></span><b>{t("chat.empty")}</b></div> : withDayMarkers.map((entry) => entry.kind === "day"
              ? <div className="stc-day" key={`day-${entry.key}`}><span>{entry.label}</span></div>
              : (() => {
                const sender = memberById.get(entry.message.senderId) || { id: entry.message.senderId, name: entry.message.senderName, role: entry.message.role };
                const own = entry.message.senderId === user.id, canDelete = own || canManage;
                const readCount = own ? (entry.message.readBy ?? []).length : 0;
                const attachments = entry.message.attachments ?? [];
                const stickerOnly = !entry.message.text && attachments.length > 0 && attachments.every((attachment) => attachment.name?.startsWith("narxtop-sticker-"));
                return <article key={entry.message.id} data-message-id={entry.message.id} className={`stc-message ${own ? "is-own" : ""} ${readCount ? "has-readers" : ""} ${stickerOnly ? "has-sticker-only" : ""} ${stickerOnly && entry.message.replyTo ? "has-sticker-reply" : ""} ${entry.groupStart ? "is-group-start" : "is-group-continuation"} ${entry.groupEnd ? "is-group-end" : "is-group-middle"}`}>
                  {!own && entry.groupEnd && (canManage
                    ? <button type="button" className="stc-message-avatar-trigger" onClick={() => openMemberProfile(sender)} aria-label={`${t("chat.profile")}: ${entry.message.senderName}`}><MemberAvatar member={sender} className="stc-message-avatar" /></button>
                    : <MemberAvatar member={sender} className="stc-message-avatar" />)}
                  {!own && !entry.groupEnd && <span className="stc-message-avatar-spacer" aria-hidden="true" />}
                  <div className="stc-message-content">
                    {!own && entry.groupStart && <div className="stc-message-meta">{canManage
                      ? <button type="button" className="stc-message-name" onClick={() => openMemberProfile(sender)}>{entry.message.senderName}</button>
                      : <b>{entry.message.senderName}</b>}<span className={`stc-role role-${entry.message.role}`}>{roleText(entry.message.role, t)}</span></div>}
                    <div className="stc-bubble">
                      {entry.message.replyTo && <button type="button" className="stc-reply-ref" onClick={() => jumpToMessage(entry.message.replyTo.id)} aria-label={`${t("chat.openReply")}: ${entry.message.replyTo.senderName}`}><b>{entry.message.replyTo.senderName}</b><span>{replyPreviewText(entry.message.replyTo.text, t("chat.photo"))}</span></button>}
                      {entry.message.text && <p>{entry.message.text}</p>}
                      {!!attachments.length && <div className="stc-attachments">{attachments.map((attachment) => attachment.type?.startsWith("audio/") ? <ChatAudio key={attachment.id} attachment={attachment} t={t} /> : <ChatImage key={attachment.id} attachment={attachment} t={t} sticker={attachment.name?.startsWith("narxtop-sticker-")} />)}</div>}
                      <div className="stc-bubble-footer"><time title={formatDateTime(entry.message.createdAt, lang)}>{formatTime(entry.message.createdAt, lang)}</time>{own && (readCount > 0 ? <button type="button" className="stc-sent-status is-read" onClick={() => setReadDialog(entry.message.id)} aria-label={t("chat.viewReaders")} title={t("chat.readByCount", { count: readCount })}><span className="stc-status-checks" aria-hidden="true">✓✓</span><span className="stc-sent-status-label">{t("chat.readByCount", { count: readCount })}</span><span className="stc-sr-only">{t("chat.viewReaders")}</span></button> : <span className="stc-sent-status" title={t("chat.sent")} aria-label={t("chat.sent")}>✓</span>)}</div>
                    </div>
                    <div className="stc-message-menu-wrap" ref={messageMenu === entry.message.id ? messageMenuRef : null}>
                      <button type="button" className="stc-message-menu-trigger" aria-label={t("chat.messageActions")} aria-haspopup="menu" aria-expanded={messageMenu === entry.message.id} onClick={() => setMessageMenu((current) => current === entry.message.id ? null : entry.message.id)}><Icon name="moreVertical" size={15} /></button>
                      {messageMenu === entry.message.id && <div className="stc-message-menu" role="menu"><button type="button" role="menuitem" onClick={() => replyToMessage(entry.message)}><Icon name="reply" size={15} />{t("chat.reply")}</button>{canDelete && <button type="button" role="menuitem" onClick={() => { setMessageMenu(null); removeMessage(entry.message.id); }}><Icon name="trash" size={14} />{t("chat.delete")}</button>}</div>}
                    </div>
                  </div>
                </article>;
              })())}
            <div ref={bottomRef} />
            {newMessages && <button type="button" className="stc-jump-latest" onClick={() => { const lowPower = document.documentElement.dataset.performance === "low" || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || window.matchMedia?.("(max-width: 760px)").matches; bottomRef.current?.scrollIntoView({ block: "end", behavior: lowPower ? "auto" : "smooth" }); nearBottomRef.current = true; setNewMessages(false); }}><Icon name="arrowDown" size={15} />{t("chat.newMessages")}</button>}
          </div>

          {!micBannerHidden && (micState === "ask" || micState === "denied" || micState === "insecure") && <div className={`stc-mic-banner is-${micState}`} role="status">
            <span className="stc-mic-banner-ico" aria-hidden="true"><Icon name="mic" size={18} /></span>
            <span className="stc-mic-banner-copy"><b>{t("chat.micAllowTitle")}</b><small>{micState === "denied" ? t("chat.micDeniedText") : micState === "insecure" ? t("chat.micInsecure") : t("chat.micAllowText")}</small></span>
            {micState === "ask" && <button type="button" className="stc-mic-banner-go" onClick={requestMic}>{t("chat.micAllow")}</button>}
            <button type="button" className="stc-mic-banner-x" onClick={() => setMicBannerHidden(true)} aria-label={t("chat.dismiss")}><Icon name="x" size={15} /></button>
          </div>}
          {error && <p className="stc-error" role="status">{error}</p>}
          <form className="stc-composer" onSubmit={send}>
            {replyTo && <div className="stc-replying"><Icon name="reply" size={16} /><span><b>{t("chat.replyTo", { name: replyTo.senderName })}</b><small>{replyPreviewText(replyTo.text, t("chat.photo"))}</small></span><button type="button" onClick={() => setReplyTo(null)} aria-label={t("chat.cancelReply")}><Icon name="x" size={15} /></button></div>}
            {files.length > 0 && <div className="stc-pending">{files.map((item) => <span className={`stc-pending-photo ${item.file.type.startsWith("audio/") ? "is-audio" : ""}`} key={item.key}>{item.file.type.startsWith("audio/") ? <><Icon name="mic" size={18} /><audio src={item.url} controls preload="metadata" aria-label={t("chat.voicePreview")} /></> : <img src={item.url} alt={item.file.name} />}<button type="button" onClick={() => removeFile(item.key)} aria-label={t("chat.removeFile")}><Icon name="x" size={13} /></button></span>)}</div>}
            <div className="stc-compose-row">
              <input ref={fileRef} className="stc-file-input" type="file" accept="image/*" multiple onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
              <button type="button" className="stc-tool" onClick={() => fileRef.current?.click()} title={t("chat.attach")} aria-label={t("chat.attach")}><Icon name="image" size={19} /></button>
              {recording ? <div className="stc-recording"><i /><span className="stc-recording-label">{t("chat.recording")}</span><time>{Math.floor(recordedSeconds / 60)}:{String(recordedSeconds % 60).padStart(2, "0")}</time><button type="button" className="stc-recording-cancel" onClick={cancelRecording}>{t("chat.cancelRecording")}</button><button type="button" className="stc-recording-finish" onClick={stopRecording} aria-label={t("chat.finishRecording")}><Icon name="check" size={16} /></button></div> : <button type="button" className="stc-tool stc-mic" onClick={startRecording} title={t("chat.recordAudio")} aria-label={t("chat.recordAudio")}><Icon name="mic" size={18} /></button>}
              <div className="stc-input-wrap"><textarea ref={inputRef} value={text} onChange={(event) => { const value = event.target.value.slice(0, 4000); setText(value); updateTyping(value); }} onPaste={pastePhoto} onKeyDown={(event) => { if (event.key === "Enter" && (settings.enterToSend ? !event.shiftKey : event.ctrlKey || event.metaKey)) { event.preventDefault(); send(event); } }} placeholder={t("chat.write")} rows={1} maxLength={4000} aria-label={t("chat.write")} />
                {stickerOpen && <StickerPicker packs={STICKER_PACKS} emojis={EMOJIS} busy={busy} connected={connected} onSend={sendSticker} onEmoji={addEmoji} onClose={() => setStickerOpen(false)} t={t} />}
              </div>
              <button type="button" className={`stc-tool stc-sticker-trigger ${stickerOpen ? "is-on" : ""}`} onClick={() => { setEmojiOpen(false); setStickerOpen((value) => !value); }} title={t("chat.stickers")} aria-label={t("chat.stickers")} aria-expanded={stickerOpen}><Icon name="smile" size={21} /></button>
              <button type="submit" className="stc-send" disabled={busy || !connected || (!text.trim() && !files.length)} aria-label={t("chat.send")}><Icon name="send" size={18} /><span>{t("chat.send")}</span></button>
            </div>
            <small>{t("chat.subtitle")} · {settings.enterToSend ? t("chat.shiftEnterNewline") : t("chat.ctrlEnterSend")}</small>
          </form>
        </main>
      </section>
      {mobilePeople && <button type="button" className="stc-backdrop" onClick={() => setMobilePeople(false)} aria-label={t("chat.cancel")} />}
      {canManage && removedOpen && <div className="stc-removed-bg" onMouseDown={(event) => event.target === event.currentTarget && setRemovedOpen(false)}>
        <section className="stc-removed-card" role="dialog" aria-modal="true" aria-labelledby="stc-removed-title">
          <header><div><h2 id="stc-removed-title">{t("chat.removedTitle")}</h2><p>{t("chat.subtitle")}</p></div><button type="button" className="stc-removed-close" onClick={() => setRemovedOpen(false)} aria-label={t("chat.cancel")}><Icon name="x" size={18} /></button></header>
          {removedMembers.length === 0 ? <p className="stc-removed-empty">{t("chat.removedEmpty")}</p> : <ul>{removedMembers.map((member) => <li key={member.id}><span className="stc-removed-identity"><button type="button" className="stc-mini-avatar-trigger" onClick={() => openMemberProfile(member)} aria-label={`${t("chat.profile")}: ${member.name}`}><MemberAvatar member={member} className="stc-mini-avatar" /></button><span><button type="button" className="stc-removed-name" onClick={() => openMemberProfile(member)}>{member.name}</button><small>{roleText(member.role, t)}</small></span></span><button type="button" className="stc-restore" disabled={busy} onClick={() => changeMembership(member)}><Icon name="reply" size={15} />{t("chat.restore")}</button></li>)}</ul>}
        </section>
      </div>}
      {canManage && profileDialog && <MemberProfileDialog dialog={profileDialog} onClose={closeProfile} now={now} lang={lang} t={t} />}
      {settingsOpen && <ChatSettingsDialog settings={settings} savedCustomBackgroundFailed={customBackgroundFailed} onApply={applySettings} onClose={closeSettings} t={t} />}
      {readDialog && messages.some((item) => item.id === readDialog) && <ReadReceiptsDialog key={readDialog} message={messages.find((item) => item.id === readDialog)} onClose={closeReadDialog} lang={lang} t={t} now={now} />}
      <ConfirmDialog open={clearOpen} busy={busy} title={t("chat.clearTitle")} text={t("chat.clearText")} confirmLabel={t("chat.confirm")} danger onCancel={() => setClearOpen(false)} onConfirm={clearHistory} />
    </PageShell>
  );
  /* eslint-enable react-hooks/refs */
}

export default function StaffChat() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { role, loading: accessLoading } = useAdminAccess();
  const { t } = useLang();
  if (authLoading || accessLoading) return <PageShell wide><Skeleton h={520} r={26} /></PageShell>;
  if (!isAuthenticated) return <Navigate to="/auth?next=%2Fchat" replace />;
  if (!roleOrder.includes(role)) return <Navigate to="/" replace state={{ message: t("chat.onlyStaff") }} />;
  return <StaffChatApp user={user} role={role} />;
}
