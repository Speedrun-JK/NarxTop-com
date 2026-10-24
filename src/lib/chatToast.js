import { toast } from "./toast";
import { apiUrl } from "./api";

export const CHAT_TOAST_MS = 2000; // chat pop-ups disappear after 2 seconds

/* Turns a live chat message into a small corner notification (shown by Toaster). */
export function chatToast(message, t) {
  if (!message) return;
  const attachments = message.attachments ?? [];
  const isSticker = attachments.length > 0 && attachments.every((a) => a.name?.startsWith("narxtop-sticker-"));
  const isVoice = attachments.some((a) => a.type?.startsWith("audio/"));
  const preview = String(message.text || "").trim()
    || (isVoice ? t("chat.voiceMessage") : isSticker ? t("chat.stickerAlt") : attachments.length ? t("chat.photo") : "");
  if (!preview) return;
  const avatar = message.profileAvatarUrl || message.avatar || "";
  toast("", {
    kind: "chatMessage",
    duration: CHAT_TOAST_MS,
    sender: message.senderName || "",
    role: message.role,
    preview: preview.length > 90 ? `${preview.slice(0, 90)}…` : preview,
    avatar: avatar.startsWith("/api/") ? apiUrl(avatar) : avatar,
    label: t("chat.nav"),
  });
}
