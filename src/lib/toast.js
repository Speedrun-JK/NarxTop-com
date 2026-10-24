// Toast events can be raised by provider effects before the visual toaster has subscribed.
// Keep a short in-memory queue so those first account and price alerts are not lost.
const listeners = new Set();
const pending = [];
const MAX_PENDING = 12;

export function toast(message, options = {}) {
  const payload = { message, ...options };
  if (listeners.size) {
    listeners.forEach((listener) => listener(payload));
    return;
  }
  pending.push(payload);
  if (pending.length > MAX_PENDING) pending.splice(0, pending.length - MAX_PENDING);
}

export function subscribeToasts(listener) {
  listeners.add(listener);
  if (pending.length) {
    const queued = pending.splice(0, pending.length);
    queued.forEach((payload) => listener(payload));
  }
  return () => listeners.delete(listener);
}
