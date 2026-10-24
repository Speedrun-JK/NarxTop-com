/* Staff group chat. MongoDB stores messages and image bytes; the HTTP upgrade
 * below implements the small, text-only WebSocket protocol used by browsers. */
import { createHash, randomUUID } from "node:crypto";
import { adminEmails, resolveAdminRole, roleForUserRecord, verifyUser } from "./auth.js";

const STAFF_ROLES = new Set(["ceo", "superadmin", "admin", "worker"]);
const EXECUTIVE_ROLES = new Set(["ceo", "superadmin"]);
const ROLE_ORDER = { ceo: 0, superadmin: 1, admin: 2, worker: 3 };
const MAX_MESSAGE = 4000;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_AUDIO_BYTES = 1_500_000;
const peers = new Set();
const sendTimes = new Map();
const typingUsers = new Map();
const origins = () => new Set([
  "http://127.0.0.1:5173", "http://localhost:5173",
  ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL.replace(/\/+$/, "")] : []),
  ...String(process.env.CORS_ORIGINS ?? "").split(",").map((v) => v.trim().replace(/\/+$/, "")).filter(Boolean),
]);
const iso = (value) => value instanceof Date ? value.toISOString() : value ?? null;

export async function ensureChatIndexes(db) {
  await db.collection("staff_chat_messages").createIndex({ createdAt: -1 });
  await db.collection("staff_chat_messages").createIndex({ senderId: 1, createdAt: -1 });
  await db.collection("staff_chat_messages").createIndex({ "readBy.userId": 1, createdAt: -1 });
  await db.collection("staff_chat_attachments").createIndex({ uploadedBy: 1, createdAt: -1 });
  await db.collection("staff_chat_members").createIndex({ kickedAt: 1 });
}

export function messageView(row, viewerId = null) {
  const canSeeReceipts = viewerId == null || String(viewerId) === String(row.senderId);
  return {
    id: String(row._id), senderId: String(row.senderId), senderName: row.senderName,
    role: row.role, text: row.text ?? "", attachments: row.attachments ?? [],
    replyTo: row.replyTo ?? null, readBy: canSeeReceipts ? (row.readBy ?? []).map((reader) => ({ userId: String(reader.userId), readAt: iso(reader.readAt) })) : [],
    createdAt: iso(row.createdAt),
  };
}

function writeFrame(socket, data, opcode = 1) {
  if (socket.destroyed || !socket.writable) return;
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data);
  let header;
  if (payload.length < 126) {
    header = Buffer.from([0x80 | opcode, payload.length]);
  } else if (payload.length <= 0xffff) {
    header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  socket.write(Buffer.concat([header, payload]));
}

function sendPeer(peer, event) {
  try { writeFrame(peer.socket, JSON.stringify(event)); } catch { peer.socket.destroy(); }
}

function broadcast(event) {
  for (const peer of peers) sendPeer(peer, event);
}

function closePeer(peer, code = 1000, reason = "Closed") {
  if (!peers.has(peer)) return;
  const text = Buffer.from(String(reason).slice(0, 120));
  const payload = Buffer.alloc(2 + text.length);
  payload.writeUInt16BE(code, 0); text.copy(payload, 2);
  writeFrame(peer.socket, payload, 8);
  peer.socket.end();
  peers.delete(peer);
}

export function closeChatUser(userId, reason = "Staff access changed") {
  const id = String(userId);
  for (const peer of peers) if (peer.userId === id) closePeer(peer, 4003, reason);
  if (typingUsers.delete(id)) broadcast({ type: "typing", id, typing: false });
}

function presenceName(user) {
  return user.user_metadata?.full_name || user.user_metadata?.name || user.email.split("@")[0];
}

function cleanTypingUsers() {
  const now = Date.now();
  for (const [userId, value] of typingUsers) {
    if (now - value.updatedAt > 8000) {
      typingUsers.delete(userId);
      broadcast({ type: "typing", id: userId, typing: false });
    }
  }
}

function imageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.toString("ascii", 0, 6))) return "image/gif";
  return null;
}

export function audioType(buffer) {
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "audio/webm";
  if (buffer.length >= 4 && buffer.toString("ascii", 0, 4) === "OggS") return "audio/ogg";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WAVE") return "audio/wav";
  if (buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp") return "audio/mp4";
  if ((buffer.length >= 3 && buffer.toString("ascii", 0, 3) === "ID3") || (buffer.length >= 2 && buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  return null;
}

export function decodeAttachmentData(dataUrl) {
  const match = /^data:(image\/(?:jpeg|png|webp|gif)|audio\/(?:webm|ogg|wav|mp4|mpeg));base64,([a-z\d+/]+=*)$/i.exec(String(dataUrl ?? ""));
  if (!match) return null;
  const data = Buffer.from(match[2], "base64");
  const type = match[1].toLowerCase().startsWith("image/") ? imageType(data) : audioType(data);
  const sizeLimit = type?.startsWith("audio/") ? MAX_AUDIO_BYTES : MAX_IMAGE_BYTES;
  if (!type || data.length > sizeLimit || type !== match[1].toLowerCase()) return null;
  return { data, type };
}

function takeFrames(peer, chunk) {
  peer.buffer = Buffer.concat([peer.buffer, chunk]);
  while (peer.buffer.length >= 2) {
    const b0 = peer.buffer[0], b1 = peer.buffer[1];
    const opcode = b0 & 0x0f, masked = (b1 & 0x80) !== 0;
    if ((b0 & 0x70) !== 0 || !masked || (b0 & 0x80) === 0) return closePeer(peer, 1002, "Invalid frame");
    let length = b1 & 0x7f, offset = 2;
    if (length === 126) {
      if (peer.buffer.length < 4) return;
      length = peer.buffer.readUInt16BE(2); offset = 4;
    } else if (length === 127) {
      if (peer.buffer.length < 10) return;
      const big = peer.buffer.readBigUInt64BE(2);
      if (big > 8192n) return closePeer(peer, 1009, "Message too large");
      length = Number(big); offset = 10;
    }
    if (length > 8192) return closePeer(peer, 1009, "Message too large");
    if (peer.buffer.length < offset + 4 + length) return;
    const mask = peer.buffer.subarray(offset, offset + 4);
    const payload = Buffer.from(peer.buffer.subarray(offset + 4, offset + 4 + length));
    peer.buffer = peer.buffer.subarray(offset + 4 + length);
    for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
    if (opcode === 8) return closePeer(peer, 1000, "Closed");
    if (opcode === 9) { writeFrame(peer.socket, payload, 10); continue; }
    if (opcode !== 1) return closePeer(peer, 1003, "Text frames only");
    handleFrame(peer, payload).catch((error) => {
      console.warn("staff chat message failed:", error.message);
      sendPeer(peer, { type: "error", message: "Xabar yuborilmadi." });
    });
    if (!peers.has(peer)) return;
  }
}

async function authenticate(req, db) {
  req.app ??= req.__expressApp;
  const session = await verifyUser(req);
  if (!session.user) return null;
  const role = await resolveAdminRole(session.user, db);
  if (!STAFF_ROLES.has(role)) return null;
  const state = await db.collection("staff_chat_members").findOne({ _id: session.user.id });
  if (state?.kickedAt) return null;
  return { user: session.user, role };
}

async function handleFrame(peer, raw) {
  const db = peer.getDb();
  const latest = await authenticate(peer.request, db);
  if (!latest || latest.user.id !== peer.userId) return closePeer(peer, 4003, "Staff access changed");
  peer.role = latest.role;
  let event;
  try { event = JSON.parse(raw.toString("utf8")); } catch { return sendPeer(peer, { type: "error", message: "Xabar formati noto‘g‘ri." }); }
  if (event?.type === "typing" || event?.type === "typing-stop") {
    cleanTypingUsers();
    const typing = event.type === "typing";
    if (typing) typingUsers.set(peer.userId, { name: presenceName(latest.user), updatedAt: Date.now() });
    else typingUsers.delete(peer.userId);
    broadcast({ type: "typing", id: peer.userId, name: presenceName(latest.user), typing });
    return;
  }
  if (event?.type === "read") {
    const ids = Array.isArray(event.ids) ? [...new Set(event.ids.map(String))].filter((id) => /^[a-f\d-]{16,64}$/i.test(id)).slice(0, 100) : [];
    if (!ids.length) return;
    const collection = db.collection("staff_chat_messages"), readAt = new Date();
    const update = await collection.updateMany({ _id: { $in: ids }, senderId: { $ne: peer.userId }, "readBy.userId": { $ne: peer.userId } }, { $addToSet: { readBy: { userId: peer.userId, readAt } } });
    if (!update.modifiedCount) return;
    const rows = await collection.find({ _id: { $in: ids } }).toArray();
    for (const peer of peers) {
      const ownReceipts = rows.filter((row) => String(row.senderId) === peer.userId);
      if (ownReceipts.length) sendPeer(peer, { type: "receipts", receipts: ownReceipts.map((row) => ({ id: String(row._id), readBy: (row.readBy ?? []).map((reader) => ({ userId: String(reader.userId), readAt: iso(reader.readAt) })) })) });
    }
    return;
  }
  if (event?.type !== "send") return;
  const now = Date.now(), history = (sendTimes.get(peer.userId) ?? []).filter((stamp) => now - stamp < 10_000);
  if (history.length >= 8) return sendPeer(peer, { type: "error", message: "Juda tez yuboryapsiz. Biroz kuting." });
  const text = typeof event.text === "string" ? event.text.trim().slice(0, MAX_MESSAGE) : "";
  const ids = Array.isArray(event.attachmentIds) ? [...new Set(event.attachmentIds.map(String))].slice(0, 4) : [];
  if (!text && !ids.length) return;
  if (ids.length && ids.some((id) => !/^[a-f\d-]{16,64}$/i.test(id))) return sendPeer(peer, { type: "error", message: "Rasm biriktirmasi noto‘g‘ri." });
  const attachments = ids.length ? await db.collection("staff_chat_attachments").find({ _id: { $in: ids }, uploadedBy: peer.userId }).toArray() : [];
  if (attachments.length !== ids.length) return sendPeer(peer, { type: "error", message: "Rasm yuklash muddati tugadi. Yana tanlang." });
  let replyTo = null;
  if (event.replyToId) {
    if (typeof event.replyToId !== "string" || !/^[a-f\d-]{16,64}$/i.test(event.replyToId)) return sendPeer(peer, { type: "error", message: "Javob beriladigan xabar topilmadi." });
    const original = await db.collection("staff_chat_messages").findOne({ _id: event.replyToId });
    if (!original) return sendPeer(peer, { type: "error", message: "Javob beriladigan xabar topilmadi." });
    replyTo = { id: String(original._id), senderName: String(original.senderName).slice(0, 120), text: (original.text || (original.attachments?.some((a) => a.type?.startsWith("audio/")) ? "Voice message" : "Photo")).slice(0, 180) };
  }
  history.push(now); sendTimes.set(peer.userId, history);
  const row = {
    _id: randomUUID(), senderId: peer.userId,
    senderName: presenceName(latest.user),
    role: latest.role, text,
    attachments: attachments.map((image) => ({ id: String(image._id), name: image.name, type: image.type, size: image.size })),
    replyTo, readBy: [], createdAt: new Date(),
  };
  await db.collection("staff_chat_messages").insertOne(row);
  await db.collection("staff_chat_attachments").updateMany({ _id: { $in: ids } }, { $set: { attachedAt: row.createdAt } });
  broadcast({ type: "message", message: messageView(row) });
}

export function registerChatRoutes(app, getDb) {
  app.use("/api/chat", async (req, res, next) => {
    try {
      const session = await verifyUser(req);
      if (!session.user) return res.status(session.status || 401).json({ success: false, message: session.message || "Unauthorized" });
      const role = await resolveAdminRole(session.user, getDb());
      if (!STAFF_ROLES.has(role)) return res.status(403).json({ success: false, message: "Chat faqat xodimlar uchun." });
      const member = await getDb().collection("staff_chat_members").findOne({ _id: session.user.id });
      if (member?.kickedAt) return res.status(403).json({ success: false, code: "CHAT_REMOVED", message: "Siz guruh chatidan chiqarilgansiz." });
      req.chat = { user: session.user, role };
      next();
    } catch (error) {
      console.error("staff chat authorization failed:", error.message);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  app.get("/api/chat/members/:id/profile", async (req, res) => {
    try {
      if (!EXECUTIVE_ROLES.has(req.chat.role)) return res.status(403).json({ success: false, message: "Only the CEO and superadmins can view profiles from chat." });
      const id = String(req.params.id ?? "");
      if (!/^[a-f\d-]{16,64}$/i.test(id)) return res.status(400).json({ success: false, message: "User ID is invalid." });
      const user = await getDb().collection("users").findOne({ _id: id });
      if (!user) return res.status(404).json({ success: false, message: "User not found." });
      const role = roleForUserRecord(user);
      const savedAvatar = await getDb().collection("avatars").findOne({ _id: id });
      const lastSeenAt = iso(user.lastSeenAt);
      const lastSeenTime = lastSeenAt ? new Date(lastSeenAt).getTime() : NaN;
      res.set("Cache-Control", "private, no-store");
      res.json({ success: true, user: {
        id, name: [user.name, user.secondName].filter(Boolean).join(" ") || user.username || String(user.email ?? "").split("@")[0] || "Staff",
        email: user.email ?? "", phone: user.phone ?? "", username: user.username ?? "", role,
        avatar: savedAvatar?.data ? `data:${savedAvatar.contentType};base64,${Buffer.from(savedAvatar.data.value(true)).toString("base64")}` : user.avatar || user.googlePicture || null,
        provider: user.provider ?? "email", providers: Array.isArray(user.providers) ? user.providers : [user.provider || "email"],
        createdAt: iso(user.createdAt), lastSeenAt, online: Number.isFinite(lastSeenTime) && Date.now() - lastSeenTime <= 90_000,
        emailConfirmedAt: iso(user.emailConfirmedAt), signIns: Number(user.signIns ?? 0),
      } });
    } catch (error) {
      console.error("staff chat profile failed:", error.message);
      res.status(500).json({ success: false, message: "Could not load this profile." });
    }
  });

  app.get("/api/chat/members/:id/avatar", async (req, res) => {
    try {
      const id = String(req.params.id ?? "");
      if (!/^[a-f\d-]{16,64}$/i.test(id)) return res.sendStatus(404);
      const user = await getDb().collection("users").findOne({ _id: id }, { projection: { adminRole: 1, isAdmin: 1, email: 1, staffRole: 1, role: 1 } });
      if (!user || !STAFF_ROLES.has(roleForUserRecord(user))) return res.sendStatus(404);
      const avatar = await getDb().collection("avatars").findOne({ _id: id });
      if (!avatar?.data) return res.sendStatus(404);
      res.set("Cache-Control", "private, max-age=60");
      res.type(avatar.contentType).send(Buffer.from(avatar.data.value(true)));
    } catch (error) {
      console.error("staff chat avatar failed:", error.message);
      res.sendStatus(404);
    }
  });

  app.get("/api/chat/roster", async (req, res) => {
    try {
      const users = await getDb().collection("users").find({
        $or: [
          { adminRole: { $in: ["worker", "admin", "superadmin"] } },
          { isAdmin: true },
          { email: { $in: adminEmails() } },
        ],
      }).limit(5000).toArray();
      const states = await getDb().collection("staff_chat_members").find({}).toArray();
      const stateById = new Map(states.map((row) => [String(row._id), row]));
      const customAvatars = await getDb().collection("avatars").find({ _id: { $in: users.map((row) => String(row._id)) } }, { projection: { _id: 1 } }).toArray();
      const customAvatarIds = new Set(customAvatars.map((row) => String(row._id)));
      const now = Date.now();
      const staff = users.map((row) => {
        const role = roleForUserRecord(row);
        const lastSeenAt = iso(row.lastSeenAt);
        const lastSeenTime = lastSeenAt ? new Date(lastSeenAt).getTime() : NaN;
        return {
          id: String(row._id), name: [row.name, row.secondName].filter(Boolean).join(" ") || row.username || String(row.email ?? "").split("@")[0] || "Staff",
          avatar: row.avatar || row.googlePicture || null,
          profileAvatarUrl: customAvatarIds.has(String(row._id)) ? `/api/chat/members/${encodeURIComponent(String(row._id))}/avatar` : null,
          role,
          lastSeenAt, online: Number.isFinite(lastSeenTime) && now - lastSeenTime <= 90_000,
          kickedAt: iso(stateById.get(String(row._id))?.kickedAt),
        };
      }).filter((row) => STAFF_ROLES.has(row.role));
      const byRole = (a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role] || a.name.localeCompare(b.name);
      const members = staff.filter((row) => !row.kickedAt).sort(byRole);
      const removedMembers = EXECUTIVE_ROLES.has(req.chat.role) ? staff.filter((row) => row.kickedAt).sort(byRole) : [];
      res.set("Cache-Control", "private, no-store");
      res.json({ success: true, members, removedMembers, role: req.chat.role });
    } catch (error) {
      console.error("staff chat roster failed:", error.message);
      res.status(500).json({ success: false, message: "Guruh a’zolarini yuklab bo‘lmadi." });
    }
  });

  app.get("/api/chat/messages/:id", async (req, res) => {
    try {
      const id = String(req.params.id ?? "");
      if (!/^[a-f\d-]{16,64}$/i.test(id)) return res.status(400).json({ success: false, message: "Xabar identifikatori noto‘g‘ri." });
      const row = await getDb().collection("staff_chat_messages").findOne({ _id: id });
      if (!row) return res.status(404).json({ success: false, code: "MESSAGE_NOT_FOUND", message: "Xabar topilmadi yoki o‘chirilgan." });
      res.set("Cache-Control", "private, no-store");
      res.json({ success: true, message: messageView(row, req.chat.user.id) });
    } catch (error) {
      console.error("staff chat message lookup failed:", error.message);
      res.status(500).json({ success: false, message: "Xabarni ochib bo‘lmadi." });
    }
  });

  app.get("/api/chat/unread-count", async (req, res) => {
    try {
      const userId = String(req.chat.user.id);
      const count = await getDb().collection("staff_chat_messages").countDocuments({
        senderId: { $ne: userId },
        "readBy.userId": { $ne: userId },
      });
      res.set("Cache-Control", "private, no-store");
      res.json({ success: true, count });
    } catch (error) {
      console.error("staff chat unread count failed:", error.message);
      res.status(500).json({ success: false, message: "Unread messages could not be counted." });
    }
  });

  app.get("/api/chat/messages/:id/readers", async (req, res) => {
    try {
      const id = String(req.params.id ?? "");
      if (!/^[a-f\d-]{16,64}$/i.test(id)) return res.status(400).json({ success: false, message: "Xabar identifikatori noto‘g‘ri." });
      const row = await getDb().collection("staff_chat_messages").findOne({ _id: id }, { projection: { senderId: 1, readBy: 1 } });
      if (!row) return res.status(404).json({ success: false, code: "MESSAGE_NOT_FOUND", message: "Xabar topilmadi yoki o‘chirilgan." });
      if (String(row.senderId) !== req.chat.user.id) return res.status(403).json({ success: false, code: "RECEIPTS_FORBIDDEN", message: "Faqat o‘z xabaringizni kim o‘qiganini ko‘rishingiz mumkin." });
      const receipts = [...new Map((row.readBy ?? []).map((receipt) => [String(receipt.userId), receipt])).values()];
      const ids = receipts.map((receipt) => String(receipt.userId));
      const users = ids.length ? await getDb().collection("users").find({ _id: { $in: ids } }).toArray() : [];
      const usersById = new Map(users.map((user) => [String(user._id), user]));
      const custom = ids.length ? await getDb().collection("avatars").find({ _id: { $in: ids } }, { projection: { _id: 1 } }).toArray() : [];
      const customIds = new Set(custom.map((avatar) => String(avatar._id)));
      const readers = receipts.flatMap((receipt) => {
        const user = usersById.get(String(receipt.userId));
        if (!user) return [];
        const userId = String(user._id);
        return [{
          id: userId,
          name: [user.name, user.secondName].filter(Boolean).join(" ") || user.username || String(user.email ?? "").split("@")[0] || "",
          username: user.username ?? "",
          avatar: user.avatar || user.googlePicture || null,
          profileAvatarUrl: customIds.has(userId) ? `/api/chat/members/${encodeURIComponent(userId)}/avatar` : null,
          role: roleForUserRecord(user),
          readAt: iso(receipt.readAt),
        }];
      }).filter((reader) => reader.name).sort((a, b) => new Date(b.readAt) - new Date(a.readAt));
      res.set("Cache-Control", "private, no-store");
      res.json({ success: true, readers });
    } catch (error) {
      console.error("staff chat readers failed:", error.message);
      res.status(500).json({ success: false, message: "Xabarni kim o‘qiganini yuklab bo‘lmadi." });
    }
  });

  app.get("/api/chat/messages", async (req, res) => {
    try {
      const cursor = req.query.before ? new Date(String(req.query.before)) : null;
      const filter = cursor && Number.isFinite(cursor.getTime()) ? { createdAt: { $lt: cursor } } : {};
      const rows = await getDb().collection("staff_chat_messages").find(filter).sort({ createdAt: -1 }).limit(60).toArray();
      res.set("Cache-Control", "private, no-store");
      res.json({ success: true, messages: rows.reverse().map((row) => messageView(row, req.chat.user.id)), hasMore: rows.length === 60 });
    } catch (error) {
      console.error("staff chat history failed:", error.message);
      res.status(500).json({ success: false, message: "Chat tarixini yuklab bo‘lmadi." });
    }
  });

  app.post("/api/chat/attachments", async (req, res) => {
    try {
      const dataUrl = String(req.body?.data ?? req.body?.image ?? "");
      if (dataUrl.length > 2_900_000) return res.status(413).json({ success: false, message: "Fayl hajmi chegaradan oshdi." });
      const file = decodeAttachmentData(dataUrl);
      if (!file) return res.status(400).json({ success: false, message: "Faqat haqiqiy JPG, PNG, WebP, GIF yoki qo‘llab-quvvatlanadigan audio fayllarni biriktiring. Audio 1.5 MB gacha bo‘lishi kerak." });
      const id = randomUUID(), name = String(req.body?.name ?? (file.type.startsWith("audio/") ? "voice-message" : "photo")).replace(/[\\/\r\n\0]/g, "").slice(0, 100) || "attachment";
      await getDb().collection("staff_chat_attachments").insertOne({ _id: id, uploadedBy: req.chat.user.id, name, type: file.type, size: file.data.length, data: file.data, createdAt: new Date() });
      res.status(201).json({ success: true, attachment: { id, name, type: file.type, size: file.data.length } });
    } catch (error) {
      console.error("staff chat attachment upload failed:", error.message);
      res.status(500).json({ success: false, message: "Biriktirmani yuklab bo‘lmadi." });
    }
  });

  app.get("/api/chat/attachments/:id", async (req, res) => {
    try {
      const message = await getDb().collection("staff_chat_messages").findOne({ "attachments.id": req.params.id });
      if (!message) return res.status(404).json({ success: false, message: "Rasm topilmadi." });
      const image = await getDb().collection("staff_chat_attachments").findOne({ _id: req.params.id });
      if (!image) return res.status(404).json({ success: false, message: "Rasm topilmadi." });
      res.set({ "Content-Type": image.type, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" });
      res.send(Buffer.from(image.data.buffer ?? image.data));
    } catch (error) {
      console.error("staff chat image read failed:", error.message);
      res.status(500).json({ success: false, message: "Rasmni ochib bo‘lmadi." });
    }
  });

  app.delete("/api/chat/messages/:id", async (req, res) => {
    const collection = getDb().collection("staff_chat_messages");
    const row = await collection.findOne({ _id: req.params.id });
    if (!row) return res.status(404).json({ success: false, message: "Xabar topilmadi." });
    if (String(row.senderId) !== req.chat.user.id && !EXECUTIVE_ROLES.has(req.chat.role)) return res.status(403).json({ success: false, message: "Faqat o‘z xabaringizni o‘chira olasiz." });
    await collection.deleteOne({ _id: row._id });
    await getDb().collection("staff_chat_attachments").deleteMany({ _id: { $in: (row.attachments ?? []).map((item) => item.id) } });
    broadcast({ type: "deleted", id: String(row._id) });
    res.json({ success: true });
  });

  app.delete("/api/chat/messages", async (req, res) => {
    if (!EXECUTIVE_ROLES.has(req.chat.role)) return res.status(403).json({ success: false, message: "Faqat CEO yoki superadmin chat tarixini tozalashi mumkin." });
    await Promise.all([
      getDb().collection("staff_chat_messages").deleteMany({}),
      getDb().collection("staff_chat_attachments").deleteMany({}),
    ]);
    broadcast({ type: "cleared" });
    res.json({ success: true });
  });

  app.post("/api/chat/members/:id/kick", async (req, res) => {
    if (!EXECUTIVE_ROLES.has(req.chat.role)) return res.status(403).json({ success: false, message: "Faqat CEO yoki superadmin guruh a’zosini chiqarishi mumkin." });
    const id = String(req.params.id), target = await getDb().collection("users").findOne({ _id: id });
    if (!target) return res.status(404).json({ success: false, message: "Foydalanuvchi topilmadi." });
    const targetRole = roleForUserRecord(target);
    if (id === req.chat.user.id) return res.status(409).json({ success: false, message: "O‘zingizni guruhdan chiqara olmaysiz." });
    if (targetRole === "ceo" && req.chat.role !== "ceo") return res.status(403).json({ success: false, message: "CEO guruhdan chiqarilmaydi." });
    if (targetRole === "superadmin" && req.chat.role !== "ceo") return res.status(403).json({ success: false, message: "Superadminni faqat CEO chiqarishi mumkin." });
    const kickedAt = new Date();
    await getDb().collection("staff_chat_members").updateOne(
      { _id: id }, { $set: { kickedAt, kickedBy: req.chat.user.id }, $setOnInsert: { addedAt: kickedAt } }, { upsert: true },
    );
    closeChatUser(id, "Removed from staff chat");
    broadcast({ type: "member", id, inChat: false });
    res.json({ success: true });
  });

  app.post("/api/chat/members/:id/restore", async (req, res) => {
    if (!EXECUTIVE_ROLES.has(req.chat.role)) return res.status(403).json({ success: false, message: "Faqat CEO yoki superadmin a’zoni qaytara oladi." });
    const id = String(req.params.id), target = await getDb().collection("users").findOne({ _id: id });
    if (!target || !STAFF_ROLES.has(roleForUserRecord(target))) return res.status(404).json({ success: false, message: "Xodim topilmadi." });
    if (roleForUserRecord(target) === "ceo" && req.chat.role !== "ceo") return res.status(403).json({ success: false, message: "CEO chat a’zosi sifatida qoladi." });
    await getDb().collection("staff_chat_members").updateOne({ _id: id }, { $unset: { kickedAt: "", kickedBy: "" } });
    broadcast({ type: "member", id, inChat: true });
    res.json({ success: true });
  });

  return {
    attach(server) {
      server.on("upgrade", async (req, socket, head) => {
        let path;
        try { path = new URL(req.url, "http://localhost").pathname; } catch { return; }
        if (path !== "/api/chat/live") return;
        const origin = String(req.headers.origin ?? "").replace(/\/+$/, "");
        if (!origin || !origins().has(origin)) { socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); return; }
        req.__expressApp = app;
        let access;
        try { access = await authenticate(req, getDb()); } catch { access = null; }
        if (!access || !/^[+/A-Za-z0-9]{16,128}={0,2}$/.test(String(req.headers["sec-websocket-key"] ?? "")) || req.headers["sec-websocket-version"] !== "13") {
          socket.end("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n"); return;
        }
        const accept = createHash("sha1").update(String(req.headers["sec-websocket-key"]) + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
        socket.write("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " + accept + "\r\n\r\n");
        socket.setNoDelay(true);
        const peer = { socket, request: req, userId: access.user.id, role: access.role, getDb, buffer: Buffer.alloc(0) };
        peers.add(peer);
        socket.on("data", (chunk) => takeFrames(peer, chunk));
        socket.on("error", () => peers.delete(peer));
        socket.on("close", () => {
          peers.delete(peer);
          if (![...peers].some((candidate) => candidate.userId === peer.userId) && typingUsers.delete(peer.userId)) broadcast({ type: "typing", id: peer.userId, typing: false });
        });
        sendPeer(peer, { type: "ready" });
        if (head?.length) takeFrames(peer, head);
      });
    },
  };
}
