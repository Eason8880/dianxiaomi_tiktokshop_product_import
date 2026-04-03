const SOFT_SPEC_PATTERNS = [
  /\b#\w+\b/gi,
  /\b\d+(?:\.\d+)?(?:\/\d+(?:\.\d+)?)?(?:m|cm|mm|in|inch|inches)\b/gi,
  /\b\d+\s*hole\b/gi,
  /\b\d+\s*speed\b/gi,
];

const LIGHT_FALLBACK_WORDS = new Set([
  'vintage',
  'retro',
  'multifunctional',
  'portable',
  'cute',
  'design',
  'automatic',
  'rechargeable',
  'handheld',
  'unisex',
  'outdoor',
  'dual',
  'night',
  'micro',
  'ultra',
  'short',
  'long-lasting',
  'beginners',
  'beginner',
  'electric',
]);

const AGGRESSIVE_FALLBACK_WORDS = new Set([
  ...LIGHT_FALLBACK_WORDS,
  'travel',
  'diary',
  'journal',
  'kraft',
  'accessories',
  'accessory',
  'organizer',
  'holder',
  'decor',
  'home',
  'office',
  'gifts',
  'gift',
  'tool',
  'tools',
  'tackle',
  'high',
  'pressure',
  'dust',
  'reflector',
  'color',
]);

function normalizeWhitespace(value: string): string {
  return value.replace(/[^\S\r\n]+/g, ' ').trim();
}

function stripPatterns(title: string): string {
  let next = title;
  for (const pattern of SOFT_SPEC_PATTERNS) {
    next = next.replace(pattern, ' ');
  }
  return normalizeWhitespace(next);
}

function stripWords(title: string, words: Set<string>): string {
  const tokens = title.split(/\s+/).filter(Boolean);
  const kept = tokens.filter((token) => !words.has(token.toLowerCase()));
  return normalizeWhitespace(kept.join(' '));
}

function dedupeWords(title: string): string {
  const seen = new Set<string>();
  const kept: string[] = [];

  for (const token of title.split(/\s+/).filter(Boolean)) {
    const key = token.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(token);
  }

  return normalizeWhitespace(kept.join(' '));
}

function toTitleCase(title: string): string {
  return title
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      if (token === token.toUpperCase() && token.length <= 3) {
        return token;
      }
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(' ');
}

function maybeAddVariant(variants: string[], value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return;
  if (normalized.length < 25 || normalized.length > 255) return;
  if (!variants.includes(normalized)) {
    variants.push(normalized);
  }
}

/**
 * Generate progressively simpler title variants for the category recommender.
 * The API is sensitive to both overly noisy marketing titles and titles below 25 chars,
 * so we keep only viable variants within the platform constraints.
 */
export function generateCategoryTitleVariants(title: string): string[] {
  const variants: string[] = [];
  const base = normalizeWhitespace(title);

  if (base) {
    variants.push(base);
  }

  const withoutSpecs = stripPatterns(base);
  maybeAddVariant(variants, withoutSpecs);

  const lightlyStripped = dedupeWords(stripWords(withoutSpecs, LIGHT_FALLBACK_WORDS));
  maybeAddVariant(variants, lightlyStripped);

  const aggressivelyStripped = dedupeWords(stripWords(withoutSpecs, AGGRESSIVE_FALLBACK_WORDS));
  maybeAddVariant(variants, aggressivelyStripped);
  maybeAddVariant(variants, toTitleCase(aggressivelyStripped));

  return variants;
}
