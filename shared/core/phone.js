/* International phone numbers: country table, as-you-type formatting, parsing and validation.
 * Pure helpers (no React, no network) so the sign-up page, the profile page and the tests share one source of truth.
 *
 * Row format:  ISO | dial code | national length (n or min-max) | digit groups [| extra dial prefixes]
 *   - "dial" is what comes after "+", for shared codes it includes the area code (e.g. Jamaica = 1876).
 *   - "groups" is how the national number is spaced, e.g. Uzbekistan 2-3-2-2 -> "90 123 45 67".
 */
const RAW = `
UZ|998|9|2-3-2-2
KZ|7|10|3-3-2-2
RU|7|10|3-3-2-2
KG|996|9|3-3-3
TJ|992|9|2-3-2-2
TM|993|8|2-6
AF|93|9|2-3-4
AZ|994|9|2-3-2-2
AM|374|8|2-3-3
GE|995|9|3-3-3
TR|90|10|3-3-2-2
IR|98|10|3-3-4
IQ|964|10|3-3-4
IL|972|9|2-3-4
PS|970|9|3-3-3
JO|962|9|1-4-4
LB|961|7-8|2-3-3
SY|963|9|3-3-3
SA|966|9|2-3-4
AE|971|9|2-3-4
QA|974|8|4-4
KW|965|8|4-4
BH|973|8|4-4
OM|968|8|4-4
YE|967|9|3-3-3
IN|91|10|5-5
PK|92|10|3-3-4
BD|880|10|4-6
LK|94|9|2-3-4
NP|977|10|3-3-4
BT|975|8|2-3-3
MV|960|7|3-4
CN|86|11|3-4-4
HK|852|8|4-4
MO|853|8|4-4
TW|886|9|3-3-3
JP|81|10|2-4-4
KR|82|9-10|2-4-4
KP|850|10|3-3-4
MN|976|8|4-4
VN|84|9|3-3-3
TH|66|9|2-3-4
LA|856|8-10|2-3-4
KH|855|8-9|2-3-4
MM|95|8-10|2-3-4
MY|60|9-10|2-4-4
SG|65|8|4-4
ID|62|9-12|3-4-5
PH|63|10|3-3-4
BN|673|7|3-4
TL|670|8|4-4
AU|61|9|3-3-3
NZ|64|8-10|2-3-4
FJ|679|7|3-4
PG|675|8|4-4
SB|677|7|3-4
VU|678|7|3-4
WS|685|7|3-4
TO|676|5|2-3
KI|686|8|4-4
TV|688|5|2-3
NR|674|7|3-4
PW|680|7|3-4
FM|691|7|3-4
MH|692|7|3-4
CK|682|5|2-3
NU|683|4|4
TK|690|4|4
WF|681|6|2-2-2
PF|689|8|2-2-2-2
NC|687|6|2-2-2
NF|672|6|1-5
US|1|10|3-3-4
CA|1|10|3-3-4
AS|1684|7|3-4
GU|1671|7|3-4
MP|1670|7|3-4
AG|1268|7|3-4
AI|1264|7|3-4
BB|1246|7|3-4
BM|1441|7|3-4
BS|1242|7|3-4
DM|1767|7|3-4
DO|1809|7|3-4|1829,1849
GD|1473|7|3-4
JM|1876|7|3-4
KN|1869|7|3-4
KY|1345|7|3-4
LC|1758|7|3-4
MS|1664|7|3-4
PR|1787|7|3-4|1939
SX|1721|7|3-4
TC|1649|7|3-4
TT|1868|7|3-4
VC|1784|7|3-4
VG|1284|7|3-4
VI|1340|7|3-4
MX|52|10|3-3-4
GT|502|8|4-4
BZ|501|7|3-4
HN|504|8|4-4
SV|503|8|4-4
NI|505|8|4-4
CR|506|8|4-4
PA|507|8|4-4
CU|53|8|4-4
HT|509|8|4-4
CO|57|10|3-3-4
VE|58|10|3-3-4
EC|593|9|2-3-4
PE|51|9|3-3-3
BO|591|8|4-4
CL|56|9|1-4-4
AR|54|10|2-4-4
UY|598|8|4-4
PY|595|9|3-3-3
BR|55|10-11|2-5-4
GY|592|7|3-4
SR|597|6-7|3-4
GF|594|9|3-3-3
FK|500|5|5
AW|297|7|3-4
CW|5999|7|3-4
BQ|5997|7|3-4
GP|590|9|3-3-3
MQ|596|9|3-3-3
PM|508|6|3-3
GB|44|10|4-3-3
JE|441534|6|6
GG|441481|6|6
IM|441624|6|6
IE|353|9|2-3-4
FR|33|9|1-2-2-2-2
DE|49|10-11|3-4-4
ES|34|9|3-3-3
PT|351|9|3-3-3
IT|39|9-10|3-3-4
NL|31|9|1-4-4
BE|32|9|3-2-2-2
LU|352|9|3-3-3
CH|41|9|2-3-2-2
AT|43|10|3-3-4
LI|423|7|3-4
MC|377|8|2-3-3
AD|376|6|3-3
SM|378|10|4-6
MT|356|8|4-4
GR|30|10|3-3-4
CY|357|8|2-3-3
DK|45|8|2-2-2-2
NO|47|8|3-2-3
SE|46|9|2-3-2-2
FI|358|9-10|2-3-4
IS|354|7|3-4
FO|298|6|3-3
GL|299|6|2-2-2
EE|372|7-8|4-4
LV|371|8|2-3-3
LT|370|8|3-2-3
PL|48|9|3-3-3
CZ|420|9|3-3-3
SK|421|9|3-3-3
HU|36|9|2-3-4
RO|40|9|3-3-3
BG|359|8-9|3-3-3
RS|381|8-9|2-3-4
HR|385|8-9|2-3-4
SI|386|8|2-3-3
BA|387|8|2-3-3
ME|382|8|2-3-3
MK|389|8|2-3-3
AL|355|9|2-3-4
XK|383|8|2-3-3
MD|373|8|2-3-3
UA|380|9|2-3-2-2
BY|375|9|2-3-2-2
GI|350|8|4-4
EG|20|10|3-3-4
LY|218|9|2-3-4
TN|216|8|2-3-3
DZ|213|9|3-2-2-2
MA|212|9|3-2-2-2
SD|249|9|2-3-4
SS|211|9|2-3-4
ET|251|9|2-3-4
ER|291|7|1-3-3
DJ|253|8|2-3-3
SO|252|8|2-3-3
KE|254|9|3-3-3
UG|256|9|3-3-3
TZ|255|9|3-3-3
RW|250|9|3-3-3
BI|257|8|2-3-3
CD|243|9|3-3-3
CG|242|9|2-3-4
GA|241|8|2-3-3
GQ|240|9|3-3-3
CM|237|9|3-2-2-2
CF|236|8|2-2-2-2
TD|235|8|2-2-2-2
NE|227|8|2-2-2-2
NG|234|10|3-3-4
GH|233|9|2-3-4
CI|225|10|2-2-2-2-2
BF|226|8|2-2-2-2
ML|223|8|2-2-2-2
SN|221|9|2-3-2-2
GM|220|7|3-4
GN|224|9|3-2-2-2
GW|245|9|3-3-3
SL|232|8|2-3-3
LR|231|7-8|2-3-3
TG|228|8|2-2-2-2
BJ|229|10|2-2-2-2-2
MR|222|8|2-2-2-2
CV|238|7|3-4
ST|239|7|3-4
AO|244|9|3-3-3
ZM|260|9|2-3-4
ZW|263|9|2-3-4
MW|265|9|3-3-3
MZ|258|9|2-3-4
MG|261|9|2-2-3-2
MU|230|8|4-4
SC|248|7|1-3-3
KM|269|7|3-4
RE|262|9|3-2-2-2
YT|262|9|3-2-2-2
NA|264|9|2-3-4
BW|267|8|2-3-3
ZA|27|9|2-3-4
LS|266|8|4-4
SZ|268|8|4-4
SH|290|4|4
`;

/** Countries shown first in the list (the site is Uzbek). */
export const POPULAR = ["UZ", "KZ", "KG", "TJ", "TM", "AZ", "RU", "TR", "US", "GB", "DE", "AE", "KR", "CN"];
export const DEFAULT_ISO = "UZ";

export const COUNTRIES = RAW.trim().split("\n").map((row) => {
  const [iso, dial, len, groups, alts] = row.split("|");
  const [min, max] = len.includes("-") ? len.split("-").map(Number) : [Number(len), Number(len)];
  return { iso, dial, min, max, groups: groups.split("-").map(Number), alts: alts ? alts.split(",") : [] };
});
export const BY_ISO = Object.fromEntries(COUNTRIES.map((c) => [c.iso, c]));

/* Longest dial prefix first, so +1876 (Jamaica) beats +1 (USA) and +441534 (Jersey) beats +44. */
const PREFIXES = COUNTRIES.flatMap((c) => [c.dial, ...c.alts].map((p) => ({ p, c })))
  .sort((a, b) => b.p.length - a.p.length);
const rank = (c) => { const i = POPULAR.indexOf(c.iso); return i < 0 ? 99 : i; };
const matches = (list, digits) => list.filter(({ p }) => digits.startsWith(p));

/** Dial code to show: "+998", "+1 876". */
export function dialLabel(country) {
  const d = country.dial;
  if (d.length === 4 && d.startsWith("1")) return `+1 ${d.slice(1)}`;
  if (d.length === 6 && d.startsWith("44")) return `+44 ${d.slice(2)}`;
  if (d.length === 4 && d.startsWith("599")) return `+599 ${d.slice(3)}`;
  return `+${d}`;
}

export const onlyDigits = (v) => String(v ?? "").replace(/\D/g, "");

/** Splits "<dial><national>" digits into a country + national digits; null if no country matches. */
export function detectCountry(digits) {
  const all = matches(PREFIXES, digits);
  if (!all.length) return null;
  const fits = all.filter(({ p, c }) => { const n = digits.length - p.length; return n >= c.min && n <= c.max; });
  const pool = fits.length ? fits : all;
  const longest = pool[0].p.length;
  const best = pool.filter(({ p }) => p.length === longest).sort((x, y) => rank(x.c) - rank(y.c))[0];
  const rest = digits.slice(best.p.length);
  /* +7 is shared by Russia and Kazakhstan; Kazakh numbers start with 6 or 7 after the code. */
  const c = best.p === "7" ? (/^[67]/.test(rest) ? BY_ISO.KZ : BY_ISO.RU) : best.c;
  return { country: c, national: rest.slice(0, c.max) };
}

/** Groups national digits: "901234567" + [2,3,2,2] -> "90 123 45 67". Extra digits stay in the last group. */
export function formatNational(country, digits) {
  const d = onlyDigits(digits).slice(0, country.max);
  const out = [];
  let i = 0;
  for (let g = 0; g < country.groups.length && i < d.length; g++) {
    const last = g === country.groups.length - 1;
    out.push(last ? d.slice(i) : d.slice(i, i + country.groups[g]));
    i += country.groups[g];
  }
  return out.join(" ");
}

/** Sample number for the placeholder: "90 123 45 67". */
export function placeholderFor(country) {
  return formatNational(country, "9012345678901".slice(0, country.max));
}

/** Cleans what the user typed/pasted into { country, national }, switching country on "+code…" or "00code…". */
export function normalizeInput(raw, country) {
  const text = String(raw ?? "").trim();
  let digits = onlyDigits(text);
  if (/^(\+|00)/.test(text) && digits) {
    if (text.startsWith("00")) digits = digits.slice(2);
    const hit = detectCountry(digits);
    if (hit) return hit;
  }
  if (digits.startsWith(country.dial) && digits.length > country.max) digits = digits.slice(country.dial.length);
  if (digits.length > country.max && digits.startsWith("0")) digits = digits.replace(/^0+/, "");
  return { country, national: digits.slice(0, country.max) };
}

export const e164 = (country, national) => (onlyDigits(national) ? `+${country.dial}${onlyDigits(national)}` : "");
export const isComplete = (country, national) => { const n = onlyDigits(national).length; return n >= country.min && n <= country.max; };

/** Reads a stored value ("+998901234567", "+998 90 123 45 67", legacy "90 123 45 67") back into parts. */
export function parsePhone(value, fallback = BY_ISO[DEFAULT_ISO]) {
  const text = String(value ?? "").trim();
  const digits = onlyDigits(text);
  if (!digits) return { country: fallback, national: "" };
  if (text.startsWith("+") || text.startsWith("00") || digits.length > fallback.max) {
    const hit = detectCountry(text.startsWith("00") ? digits.slice(2) : digits);
    if (hit) return hit;
  }
  return { country: fallback, national: digits.slice(0, fallback.max) };
}

/** Optional field: empty is fine; otherwise the number must have the right length for its country. */
export function validatePhoneNumber(value) {
  if (!onlyDigits(value)) return true;
  const { country, national } = parsePhone(value);
  return isComplete(country, national);
}

/** Pretty "+998 90 123 45 67" for lists and the admin panel. */
export function formatPhone(value) {
  if (!onlyDigits(value)) return "";
  const { country, national } = parsePhone(value);
  return `${dialLabel(country)} ${formatNational(country, national)}`.trim();
}

export function countryOfPhone(value) {
  if (!onlyDigits(value)) return null;
  return parsePhone(value).country;
}

/** Flag image (flagcdn, lower-case ISO). A regional-indicator emoji is used as the offline fallback. */
export const flagUrl = (iso, w = 40) => `https://flagcdn.com/w${w}/${iso.toLowerCase()}.png`;
export const flagEmoji = (iso) => String.fromCodePoint(...[...iso.toUpperCase()].map((ch) => 127397 + ch.charCodeAt(0)));

/** Localised country name from the browser's CLDR data (no extra data file needed). */
const namers = {};
export function countryName(iso, lang = "en") {
  try {
    namers[lang] ??= new Intl.DisplayNames([lang === "uz" ? "uz-Latn" : lang, "en"], { type: "region" });
    return namers[lang].of(iso) || iso;
  } catch { return iso; }
}

/** Canonical stored form: "+998901234567". Returns "" when there are no digits. */
export function normalizePhone(value) {
  if (!onlyDigits(value)) return "";
  const { country, national } = parsePhone(value);
  return e164(country, national);
}

/** Required-phone check: unlike validatePhoneNumber (where empty is fine), this is true only for a complete number. */
export function hasValidPhone(value) {
  const n = normalizePhone(value);
  return Boolean(n) && validatePhoneNumber(n);
}
