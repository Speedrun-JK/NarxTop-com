export const DEFAULT_MAX_ECONOMY = Object.freeze({
  enabled: true,
  mode: "automatic",
  pinned: [],
  excluded: [],
  limit: 8,
});

const MODES = new Set(["automatic", "manual", "automatic_pinned"]);
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateMaxEconomySettings(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, error: "Settings must be an object." };
  if (typeof input.enabled !== "boolean") return { ok: false, error: "enabled must be a boolean." };
  if (!MODES.has(input.mode)) return { ok: false, error: "mode is not supported." };
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 24) return { ok: false, error: "limit must be an integer from 1 to 24." };
  for (const key of ["pinned", "excluded"]) {
    if (!Array.isArray(input[key]) || input[key].length > 500) return { ok: false, error: `${key} must be a list of at most 500 product slugs.` };
    if (input[key].some((slug) => typeof slug !== "string" || slug.length > 120 || !SLUG.test(slug))) return { ok: false, error: `${key} contains an invalid product slug.` };
    if (new Set(input[key]).size !== input[key].length) return { ok: false, error: `${key} cannot contain duplicates.` };
  }
  return { ok: true, value: { enabled: input.enabled, mode: input.mode, pinned: [...input.pinned], excluded: [...input.excluded], limit: input.limit } };
}

/** Selects from an already-ranked automatic list and preserves the admin's pinned order. */
export function selectMaxEconomyProducts(products, rankedAutomatic, settings = DEFAULT_MAX_ECONOMY) {
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  const pinned = settings.pinned.map((slug) => bySlug.get(slug)).filter(Boolean);
  const pinnedSlugs = new Set(settings.pinned);
  const excluded = new Set(settings.excluded);
  const automatic = rankedAutomatic.filter((product) => !excluded.has(product.slug) && !pinnedSlugs.has(product.slug));
  const selected = settings.mode === "manual"
    ? pinned
    : settings.mode === "automatic_pinned"
      ? [...pinned, ...automatic]
      : rankedAutomatic.filter((product) => !excluded.has(product.slug));
  return selected.slice(0, settings.limit);
}
