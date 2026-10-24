import test from "node:test";
import assert from "node:assert/strict";
import { distanceKm, formatKm, matcherFor, branchRoute, findBranches } from "../../../src/lib/nearby.js";

const TASHKENT = { lat: 41.3111, lng: 69.2797 };

test("distanceKm: haversine sanity (Tashkent centre → Chilonzor ≈ 6–7 km), symmetric, zero at the same point", () => {
  const d = distanceKm(TASHKENT, { lat: 41.2756, lng: 69.2039 });
  assert.ok(d > 6 && d < 8, `got ${d}`);
  assert.equal(distanceKm(TASHKENT, TASHKENT), 0);
  assert.ok(Math.abs(distanceKm(TASHKENT, { lat: 41.2756, lng: 69.2039 }) - distanceKm({ lat: 41.2756, lng: 69.2039 }, TASHKENT)) < 1e-9);
});

test("formatKm: metres under 1 km, one decimal under 10 km, whole km above", () => {
  assert.equal(formatKm(0.004), "10 m");
  assert.equal(formatKm(0.45), "450 m");
  assert.equal(formatKm(2.34), "2.3 km");
  assert.equal(formatKm(12.6), "13 km");
});

test("matcherFor: known chains match Latin + Cyrillic spellings, but not look-alike words", () => {
  const k = matcherFor("Korzinka").regex, m = matcherFor("Makro").regex, h = matcherFor("Havas").regex;
  assert.ok(k.test("Korzinka Chilonzor") && k.test("Корзинка") && !k.test("Korzinkas"));
  assert.ok(m.test("Makro") && m.test("Макро Cash") && m.test("Macro") && !m.test("Macrodata"));
  assert.ok(h.test("Havas") && h.test("Хавас"));
  // unknown chain: matched by its own (escaped) name
  const o = matcherFor("Mini (Market)").regex;
  assert.ok(o.test("mini (market) 5") && !o.test("minimarket"));
});

test("branchRoute builds direct directions for each app", () => {
  const to = { lat: 41.3, lng: 69.3 };
  assert.match(branchRoute("google", TASHKENT, to), /origin=41\.3111,69\.2797&destination=41\.3,69\.3/);
  assert.match(branchRoute("yandex", TASHKENT, to), /rtext=41\.3111,69\.2797~41\.3,69\.3/);
  assert.match(branchRoute("gis", TASHKENT, to), /points\/69\.2797,41\.3111\|69\.3,41\.3/);
  assert.match(branchRoute("waze", TASHKENT, to), /ll=41\.3,69\.3&navigate=yes/);
});

function withFetch(fn, impl) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = impl;
  return Promise.resolve(fn()).finally(() => { globalThis.fetch = realFetch; });
}
const el = (id, lat, lon, tags) => ({ id, lat, lon, tags });

test("findBranches: filters to the chain, dedupes, sorts nearest-first, limits, uses way centres", async () => {
  const calls = [];
  const data = { elements: [
    el(1, 41.35, 69.30, { name: "Korzinka Far" }),
    el(2, 41.312, 69.281, { name: "Korzinka Near" }),
    el(3, 41.312, 69.281, { name: "Korzinka Near duplicate" }), // same spot → dropped
    el(4, 41.30, 69.27, { brand: "Корзинка" }),
    { id: 5, center: { lat: 41.32, lon: 69.29 }, tags: { "name:ru": "Корзинка Центр" } },
    el(6, 41.31, 69.28, { name: "Makro" }), // other chain
    el(7, null, null, { name: "Korzinka no coords" }),
  ] };
  const run = (limit) => withFetch(() => findBranches("Korzinka", TASHKENT, { limit }), async (url, init) => { calls.push([url, init.body]); return { ok: true, json: async () => data }; });
  const all = await run(10);
  // Makro (other chain), the same-spot duplicate and the element without coordinates are excluded → 4 distinct Korzinka branches
  assert.deepEqual(all.map((b) => b.name), ["Korzinka Near", "Korzinka", "Korzinka", "Korzinka Far"]);
  assert.deepEqual(all.map((b) => Math.round(b.km * 10) / 10), [0.1, 1.3, 1.5, 4.6]);
  assert.ok(all.every((b, i) => i === 0 || all[i - 1].km <= b.km), "sorted by distance");
  assert.ok(all[1].lat === 41.32 && all[1].lng === 69.29, "a way/area uses its centre point");
  const two = await run(2);
  assert.equal(two.length, 2);
  assert.match(decodeURIComponent(calls[0][1]), /around:30000,41\.3111,69\.2797/);
});

test("findBranches: falls back to the second Overpass server, and rejects when all fail", async () => {
  const urls = [];
  const ok = await withFetch(() => findBranches("Havas", { lat: 41.2, lng: 69.1 }), async (url) => {
    urls.push(url);
    if (urls.length === 1) throw new Error("down");
    return { ok: true, json: async () => ({ elements: [el(1, 41.21, 69.11, { name: "Havas Yunusobod" })] }) };
  });
  assert.equal(urls.length, 2);
  assert.equal(ok[0].name, "Havas Yunusobod");
  await assert.rejects(withFetch(() => findBranches("Makro", { lat: 40.1, lng: 68.1 }), async () => ({ ok: false, status: 503 })));
});
