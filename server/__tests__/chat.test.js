import test from "node:test";
import assert from "node:assert/strict";
import { audioType, decodeAttachmentData, messageView } from "../chat.js";

const asDataUrl = (type, bytes) => `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;

test("chat attachment decoder accepts validated image signatures", () => {
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
  const decoded = decodeAttachmentData(asDataUrl("image/png", png));
  assert.equal(decoded.type, "image/png");
  assert.deepEqual(decoded.data, png);
  assert.equal(decodeAttachmentData(asDataUrl("image/png", Buffer.from("not a png"))), null);
  assert.equal(decodeAttachmentData(asDataUrl("image/svg+xml", Buffer.from("<svg/>"))), null);
});

test("chat audio accepts supported container signatures and enforces size", () => {
  assert.equal(audioType(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0])), "audio/webm");
  assert.equal(audioType(Buffer.from("OggS")), "audio/ogg");
  assert.equal(audioType(Buffer.from("RIFF0000WAVE")), "audio/wav");
  assert.equal(audioType(Buffer.from("0000ftypM4A ")), "audio/mp4");
  assert.equal(audioType(Buffer.from("ID3abc")), "audio/mpeg");
  const webm = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0]);
  assert.equal(decodeAttachmentData(asDataUrl("audio/webm", webm)).type, "audio/webm");
  assert.equal(decodeAttachmentData(asDataUrl("audio/ogg", webm)), null);
  const oversized = Buffer.alloc(1_500_001);
  oversized.set([0x1a, 0x45, 0xdf, 0xa3]);
  assert.equal(decodeAttachmentData(asDataUrl("audio/webm", oversized)), null);
});

test("chat message view keeps reply links and recorded group read events", () => {
  const createdAt = new Date("2026-10-21T07:00:00.000Z");
  const readAt = new Date("2026-10-21T07:02:00.000Z");
  const view = messageView({
    _id: "a1b2c3d4e5f60718", senderId: "sender-1", senderName: "Alice", role: "admin",
    text: "Hello", createdAt, replyTo: { id: "original-1", senderName: "Sam", text: "Earlier" },
    readBy: [{ userId: "reader-2", readAt }],
  });
  assert.equal(view.id, "a1b2c3d4e5f60718");
  assert.equal(view.createdAt, createdAt.toISOString());
  assert.deepEqual(view.replyTo, { id: "original-1", senderName: "Sam", text: "Earlier" });
  assert.deepEqual(view.readBy, [{ userId: "reader-2", readAt: readAt.toISOString() }]);
});

test("chat read receipts are visible only to the message sender", () => {
  const row = {
    _id: "message-1234567890", senderId: "sender-1", senderName: "Alice", role: "admin",
    text: "Hello", createdAt: new Date("2026-10-21T07:00:00.000Z"),
    readBy: [{ userId: "reader-2", readAt: new Date("2026-10-21T07:02:00.000Z") }],
  };
  assert.equal(messageView(row, "reader-2").readBy.length, 0);
  assert.equal(messageView(row, "another-user").readBy.length, 0);
  assert.equal(messageView(row, "sender-1").readBy.length, 1);
});
