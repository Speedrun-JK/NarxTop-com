const TIME_ZONE = "Asia/Tashkent";
const TIME_LOCALES = { uz: "uz-UZ", ru: "ru-RU", en: "en-GB" };

function toDate(value) {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function dateParts(value) {
  const date = toDate(value);
  if (!date) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  return Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
}

/** Use a stable day key in the site's timezone, regardless of the browser locale. */
export function dateKey(value) {
  const parts = dateParts(value);
  return parts ? `${parts.year}-${parts.month}-${parts.day}` : "";
}

/** Render dates in the familiar numeric day.month.year format across the site. */
export function formatDate(value) {
  const parts = dateParts(value);
  return parts ? `${parts.day}.${parts.month}.${parts.year}` : "—";
}

/** Render clock time consistently in the site's timezone. */
export function formatTime(value, lang = "uz") {
  const date = toDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(TIME_LOCALES[lang] || TIME_LOCALES.uz, {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function formatDateTime(value, lang = "uz") {
  const date = formatDate(value);
  return date === "—" ? date : `${date} · ${formatTime(value, lang)}`;
}
