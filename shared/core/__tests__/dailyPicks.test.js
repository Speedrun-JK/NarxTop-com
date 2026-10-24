import test from "node:test";
import assert from "node:assert/strict";
import { chunk, dayKey, msUntilNextDay, pickDaily } from "../dailyPicks.js";

const catalog = Array.from({ length: 30 }, (_, i) => ({ slug: `p-${i}`, price: (i + 1) * 1000 }));

test("same day gives the same 9 picks", () => {
  const a = pickDaily(catalog, "2026-10-18");
  const b = pickDaily([...catalog].reverse(), "2026-10-18");
  assert.equal(a.length, 9);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, 9);
});

test("a different day gives a different set", () => {
  assert.notDeepEqual(pickDaily(catalog, "2026-10-18"), pickDaily(catalog, "2026-10-19"));
});

test("only the cheaper half is used", () => {
  for (const day of ["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21"]) {
    for (const slug of pickDaily(catalog, day)) assert.ok(Number(slug.slice(2)) < 15, slug);
  }
});

test("small catalogs give full slides of 3 only", () => {
  assert.equal(pickDaily(catalog.slice(0, 7), "x").length, 6);
  assert.equal(pickDaily(catalog.slice(0, 2), "x").length, 0);
  assert.deepEqual(chunk([1, 2, 3, 4, 5, 6]), [[1, 2, 3], [4, 5, 6]]);
});

test("day rolls over at Tashkent midnight", () => {
  assert.equal(dayKey(Date.UTC(2026, 9, 18, 18, 59)), "2026-10-18"); // 23:59 in Tashkent
  assert.equal(dayKey(Date.UTC(2026, 9, 18, 19, 1)), "2026-10-19"); // 00:01 next day
  const ms = msUntilNextDay(Date.UTC(2026, 9, 18, 18, 0));
  assert.ok(ms > 3600e3 && ms < 3600e3 + 1000);
});
