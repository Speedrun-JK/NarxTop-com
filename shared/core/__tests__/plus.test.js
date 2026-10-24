import test from "node:test";
import assert from "node:assert/strict";
import {
  FREE_BASKET_LIMIT, GIFT_STORES, DEFAULT_PLAN, addMonths, isPlusActive, remainingDays,
  planGiftEvents, extendExpiry, validatePlanInput, validateGiftInput, canGrowBasket,
} from "../plus.js";

const d = (s) => new Date(s);

test("addMonths clamps to the end of a shorter month instead of overflowing", () => {
  assert.equal(addMonths(d("2026-01-31T10:00:00"), 1).getMonth(), 1); // February
  assert.equal(addMonths(d("2026-01-31T10:00:00"), 1).getDate(), 28);
  assert.equal(addMonths(d("2028-01-31T10:00:00"), 1).getDate(), 29); // leap year
  assert.equal(addMonths(d("2026-05-15T10:00:00"), 2).getDate(), 15);
});

test("isPlusActive / remainingDays follow the expiry date, status and clock", () => {
  const now = d("2026-10-12T00:00:00Z");
  const sub = (o = {}) => ({ status: "active", expiresAt: "2026-10-22T00:00:00Z", ...o });
  assert.equal(isPlusActive(sub(), now), true);
  assert.equal(remainingDays(sub(), now), 10);
  assert.equal(isPlusActive(sub({ expiresAt: "2026-10-11T00:00:00Z" }), now), false);
  assert.equal(isPlusActive(sub({ status: "cancelled" }), now), false);
  assert.equal(isPlusActive(null, now), false);
  assert.equal(isPlusActive(sub({ expiresAt: "garbage" }), now), false);
  assert.equal(remainingDays(sub({ expiresAt: "2026-10-11T00:00:00Z" }), now), 0, "never negative");
  assert.equal(remainingDays(sub({ expiresAt: "2026-10-12T05:00:00Z" }), now), 1, "partial days round up");
  assert.equal(remainingDays(undefined, now), 0);
});

test("planGiftEvents: one gift per month, valid stores, never due after expiry, clamped count", () => {
  const now = d("2026-10-12T00:00:00Z");
  const expiresAt = addMonths(now, 2);
  let n = 0;
  const events = planGiftEvents({ userId: "u1", email: "a@b.uz", months: 2, now, expiresAt, rand: () => [0, 0.5, 0.99][n++ % 3] });
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((e) => e.store), ["Korzinka", "Makro"]);
  assert.deepEqual(events.map((e) => e.period), [1, 2]);
  assert.ok(events.every((e) => e.status === "awaiting-fulfilment" && GIFT_STORES.includes(e.store)));
  assert.ok(events.every((e) => e.dueAt.getTime() <= expiresAt.getTime()));
  // rand() === 1 - epsilon must not index out of range
  assert.equal(planGiftEvents({ userId: "u", months: 1, now, expiresAt, rand: () => 0.999999 })[0].store, "Havas");
  // clamping
  assert.equal(planGiftEvents({ userId: "u", months: 999, now, expiresAt }).length, 24);
  assert.equal(planGiftEvents({ userId: "u", months: 0, now, expiresAt }).length, 1);
  // a gift can never be due after the (shorter) subscription ends
  const short = new Date(now.getTime() + 10 * 86_400_000);
  assert.ok(planGiftEvents({ userId: "u", months: 3, now, expiresAt: short }).every((e) => e.dueAt <= short));
});

test("extendExpiry: extends an active plan, restarts an expired one", () => {
  const now = d("2026-10-12T00:00:00Z");
  assert.equal(extendExpiry("2026-10-20T00:00:00Z", { unit: "days", amount: 5 }, now).toISOString(), "2026-10-25T00:00:00.000Z");
  assert.equal(extendExpiry("2026-10-01T00:00:00Z", { unit: "days", amount: 5 }, now).toISOString(), "2026-10-17T00:00:00.000Z");
  assert.equal(extendExpiry(null, { unit: "days", amount: 1 }, now).toISOString(), "2026-10-13T00:00:00.000Z");
  assert.equal(extendExpiry("2026-10-20T10:00:00", { unit: "months", amount: 1 }, now).getMonth(), 10); // November
});

test("validatePlanInput: whole-number price, trimmed text, bounded feature list; trial length is not editable", () => {
  assert.equal(validatePlanInput({ price: 0 }).ok, false);
  assert.equal(validatePlanInput({ price: 12.5 }).ok, false);
  assert.equal(validatePlanInput({ price: 1e9 }).ok, false);
  assert.equal(validatePlanInput({}).ok, false);
  const r = validatePlanInput({ price: "29900", description: `  ${"x".repeat(900)}  `, features: [" a ", "", "b", ...Array(20).fill("c")], trialMonths: 99 }, { ...DEFAULT_PLAN, trialMonths: 2 });
  assert.equal(r.ok, true);
  assert.equal(r.value.price, 29900);
  assert.equal(r.value.description.length, 500);
  assert.equal(r.value.features.length, 12);
  assert.equal(r.value.features[0], "a");
  assert.equal(r.value.trialMonths, 2);
  // omitted features keep the current ones
  assert.deepEqual(validatePlanInput({ price: 1000 }, { ...DEFAULT_PLAN, features: ["keep"] }).value.features, ["keep"]);
});

test("validateGiftInput: needs a user and a sane amount/unit", () => {
  assert.equal(validateGiftInput({}).ok, false);
  assert.equal(validateGiftInput({ userId: "u", unit: "years", amount: 1 }).ok, false);
  assert.equal(validateGiftInput({ userId: "u", unit: "days", amount: 0 }).ok, false);
  assert.equal(validateGiftInput({ userId: "u", unit: "days", amount: 366 }).ok, false);
  assert.equal(validateGiftInput({ userId: "u", unit: "days", amount: 1.5 }).ok, false);
  assert.deepEqual(validateGiftInput({ userId: " u1 ", unit: "months", amount: "3" }).value, { userId: "u1", unit: "months", amount: 3, email: "", name: "" });
});

test("canGrowBasket: free limit applies to growth only; shrinking an over-limit basket is always allowed", () => {
  assert.equal(FREE_BASKET_LIMIT, 1_000_000);
  assert.equal(canGrowBasket({ isPlus: false, currentTotal: 500_000, nextTotal: 1_000_000 }), true, "exactly at the limit is fine");
  assert.equal(canGrowBasket({ isPlus: false, currentTotal: 900_000, nextTotal: 1_000_001 }), false);
  assert.equal(canGrowBasket({ isPlus: true, currentTotal: 900_000, nextTotal: 9_000_000 }), true);
  // over limit already (Plus expired / prices rose): reducing or keeping must work, growing must not
  assert.equal(canGrowBasket({ isPlus: false, currentTotal: 1_400_000, nextTotal: 1_200_000 }), true);
  assert.equal(canGrowBasket({ isPlus: false, currentTotal: 1_400_000, nextTotal: 1_400_000 }), true);
  assert.equal(canGrowBasket({ isPlus: false, currentTotal: 1_400_000, nextTotal: 1_500_000 }), false);
});
