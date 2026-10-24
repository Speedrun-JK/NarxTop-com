import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useLang } from "../../context/LanguageContext";
import { useAdminAccess } from "../../lib/admin";
import { apiUrl } from "../../lib/api";
import { chatToast } from "../../lib/chatToast";

/* Staff only: while you are anywhere except /chat, a new chat message shows a small corner notification for 2 seconds.
 * (On /chat itself the chat page raises the same notification.) */
export default function ChatNotifier() {
  const { user, isAuthenticated } = useAuth();
  const { role } = useAdminAccess();
  const { t } = useLang();
  const { pathname } = useLocation();
  const tRef = useRef(t);
  tRef.current = t;
  const staff = isAuthenticated && role !== "user";
  const onChat = pathname.startsWith("/chat");

  useEffect(() => {
    if (!staff || onChat || !user?.id) return undefined;
    let active = true, socket, timer;
    const connect = () => {
      if (!active) return;
      const url = new URL(apiUrl("/api/chat/live"), window.location.href);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      try { socket = new WebSocket(url); } catch { timer = window.setTimeout(connect, 5000); return; }
      socket.onmessage = (event) => {
        let data; try { data = JSON.parse(event.data); } catch { return; }
        if (data.type === "message" && data.message && data.message.senderId !== user.id) chatToast(data.message, tRef.current);
      };
      socket.onclose = () => { if (active) timer = window.setTimeout(connect, 5000); };
    };
    connect();
    return () => { active = false; window.clearTimeout(timer); if (socket) { socket.onclose = null; socket.close(); } };
  }, [staff, onChat, user?.id]);
  return null;
}
