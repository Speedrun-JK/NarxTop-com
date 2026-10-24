import test from "node:test";
import assert from "node:assert/strict";
import { passwordStrength, safeNext, authErrorKey, validateEmail, validatePhone, withTimeout } from "../../../src/lib/authUtils.js";

test("password strength", () => {
  assert.equal(passwordStrength("").score, 0);
  assert.ok(passwordStrength("abc").score <= 1);
  assert.ok(passwordStrength("password1A").score <= 1);
  assert.equal(passwordStrength("Tr0ub4dor&3xx").score, 4);
  assert.equal(passwordStrength("Kitob7Kitob").ok, true);
  assert.equal(passwordStrength("kitobkitob").ok, false);
});
test("safe redirect blocks open redirects", () => {
  assert.equal(safeNext("/cart"), "/cart");
  assert.equal(safeNext("//evil.com"), "/");
  assert.equal(safeNext("https://evil.com"), "/");
  assert.equal(safeNext("/\\evil.com"), "/");
  assert.equal(safeNext("/auth?x=1"), "/");
  assert.equal(safeNext(undefined), "/");
});
test("error mapping", () => {
  assert.equal(authErrorKey({ message: "Invalid login credentials" }), "auth.err.invalid");
  assert.equal(authErrorKey({ message: "Email not confirmed" }), "auth.err.notConfirmed");
  assert.equal(authErrorKey({ message: "User already registered" }), "auth.err.exists");
  assert.equal(authErrorKey({ name: "AuthRetryableFetchError", message: "x" }), "auth.err.network");
  assert.equal(authErrorKey({ status: 429, message: "x" }), "auth.err.rate");
  assert.equal(authErrorKey({ name: "TimeoutError", message: "timeout" }), "auth.err.timeout");
  assert.equal(authErrorKey({ message: "???" }), "auth.err.generic");
});
test("validators + timeout", async () => {
  assert.ok(validateEmail("a@b.uz")); assert.ok(!validateEmail("a@b"));
  assert.ok(validatePhone("")); assert.ok(validatePhone("+998 90 123 45 67")); assert.ok(!validatePhone("12"));
  await assert.rejects(withTimeout(new Promise(() => {}), 20), { name: "TimeoutError" });
  assert.equal(await withTimeout(Promise.resolve(5), 50), 5);
});

import { BY_ISO, COUNTRIES, countryOfPhone, detectCountry, formatNational, formatPhone, hasValidPhone, normalizeInput, normalizePhone, parsePhone, validatePhoneNumber } from "../phone.js";

test("phone: Uzbekistan is spaced 2-3-2-2 and stored as E.164", () => {
  assert.equal(formatNational(BY_ISO.UZ, "901234567"), "90 123 45 67");
  assert.equal(formatNational(BY_ISO.UZ, "9012"), "90 12");
  assert.equal(normalizePhone("+998 90 123 45 67"), "+998901234567");
  assert.equal(formatPhone("+998901234567"), "+998 90 123 45 67");
  assert.equal(countryOfPhone("+998901234567").iso, "UZ");
});

test("phone: pasted international numbers switch country", () => {
  assert.equal(normalizeInput("+82 10 1234 5678", BY_ISO.UZ).country.iso, "KR");
  assert.equal(normalizeInput("998901234567", BY_ISO.UZ).national, "901234567");
  assert.equal(normalizeInput("0901234567", BY_ISO.UZ).national, "901234567");
  assert.equal(detectCountry("18765551234").country.iso, "JM");
  assert.equal(detectCountry("12125551234").country.iso, "US");
  assert.equal(detectCountry("77012345678").country.iso, "KZ");
  assert.equal(detectCountry("79123456789").country.iso, "RU");
  assert.equal(detectCountry("441534123456").country.iso, "JE");
});

test("phone: validation is per country", () => {
  assert.ok(validatePhoneNumber("+998901234567"));
  assert.ok(!validatePhoneNumber("+99890123"));
  assert.ok(validatePhoneNumber("+12125551234"));
  assert.ok(!validatePhoneNumber("+1212555"));
  assert.equal(parsePhone("90 123 45 67").country.iso, "UZ");
});

test("phone: country table is complete and consistent", () => {
  assert.ok(COUNTRIES.length >= 230);
  assert.equal(new Set(COUNTRIES.map((c) => c.iso)).size, COUNTRIES.length);
  for (const c of COUNTRIES) assert.ok(c.groups.reduce((a, b) => a + b, 0) >= c.max - 3, c.iso);
});

test("phone: hasValidPhone requires a complete number (empty is NOT accepted)", () => {
  assert.equal(hasValidPhone(""), false);
  assert.equal(hasValidPhone("   "), false);
  assert.equal(hasValidPhone("+998"), false);
  assert.equal(hasValidPhone("+99890123"), false);
  assert.equal(hasValidPhone(undefined), false);
  assert.equal(hasValidPhone("+998901234567"), true);
  assert.equal(hasValidPhone("90 123 45 67"), true);
});
