import test from "node:test";
import assert from "node:assert/strict";
import { onStorage, safeGet, safeRemove, safeSet } from "../../src/lib/storage.js";

const values = new Map();
const listeners = new Map();
const local = {
  getItem: (key) => values.has(key) ? values.get(key) : null,
  setItem: (key, value) => values.set(key, String(value)),
  removeItem: (key) => values.delete(key),
};
globalThis.localStorage = local;
globalThis.window = {
  localStorage: local,
  addEventListener: (name, fn) => listeners.set(name, fn),
  removeEventListener: (name) => listeners.delete(name),
  dispatchEvent: () => true,
};

test("versioned storage migrates legacy values, recovers corrupt JSON, and syncs tabs", () => {
  values.clear();
  values.set("legacy", JSON.stringify({ schemaVersion: 1, value: { count: 3 } }));
  assert.deepEqual(safeGet("legacy", null), { count: 3 });
  assert.equal(safeSet("legacy", { count: 4 }), true);
  assert.deepEqual(JSON.parse(values.get("legacy")), { schemaVersion: 2, value: { count: 4 } });

  values.set("custom", JSON.stringify({ schemaVersion: 0, value: { count: 1 } }));
  assert.deepEqual(safeGet("custom", null, { 0: (v) => ({ count: v.count + 1 }) }), { count: 2 });

  values.set("broken", "{not-json");
  assert.equal(safeGet("broken", "fallback"), "fallback");
  assert.equal(values.has("broken"), false);

  let calls = 0;
  const off = onStorage("legacy", () => { calls += 1; });
  listeners.get("storage")({ key: "legacy", storageArea: local });
  listeners.get("storage")({ key: "other", storageArea: local });
  off();
  assert.equal(calls, 1);
  assert.equal(listeners.has("storage"), false);

  safeRemove("legacy");
  assert.equal(values.has("legacy"), false);
});

test("storage quota failures return false without throwing", () => {
  const prior = local.setItem;
  local.setItem = () => { throw Object.assign(new Error("full"), { name: "QuotaExceededError" }); };
  try { assert.equal(safeSet("large", "x".repeat(100)), false); }
  finally { local.setItem = prior; }
});
