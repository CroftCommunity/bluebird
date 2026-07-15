import type { SkyliteSearch } from '../config/types.js';

/**
 * §Telescope rung 2 — query gating. Pure, dependency-free, unit-tested. This is
 * the shield, not a cage (docs/telescope-search.md): the lists are SEEDS, not an
 * exhaustive moderation corpus, and matching is word/substring — not semantic.
 * The blocklist errs protective (substring); the allowlist errs permissive
 * within topics (whole-word). The label floor is enforced separately, on results.
 */

/**
 * Seed blocklist — clearly-unsafe query terms a kid-safe search should refuse.
 * Modest and category-spanning by intent; a deployment extends it via
 * `search.blocklistExtra`. Substring-matched, so "sexy"/"sexual" are caught by
 * "sex" (and yes, this over-blocks a few innocents — the conservative direction).
 */
export const DEFAULT_BLOCKLIST: readonly string[] = [
  // adult / sexual
  'porn', 'sex', 'nude', 'nsfw', 'xxx', 'hentai', 'fetish', 'onlyfans', 'escort',
  // graphic violence
  'gore', 'beheading', 'execution', 'massacre',
  // self-harm
  'suicide', 'selfharm', 'self harm', 'cutting',
  // hard drugs
  'cocaine', 'heroin', 'meth', 'fentanyl',
  // weapons acquisition
  'ghost gun', 'buy gun',
];

/**
 * Seed topic allowlist — safe subjects a young explorer can search when the
 * positive gate is on. A deployment extends it via `search.allowlistExtra`.
 * Whole-word matched (any query token equal to a topic passes).
 */
export const DEFAULT_ALLOWLIST: readonly string[] = [
  'animals', 'animal', 'dogs', 'cats', 'horses', 'birds', 'dinosaurs', 'dinosaur',
  'space', 'planets', 'stars', 'moon', 'rockets', 'astronomy',
  'science', 'nature', 'ocean', 'weather', 'volcanoes', 'plants', 'gardening',
  'art', 'drawing', 'painting', 'crafts', 'lego', 'origami',
  'music', 'guitar', 'piano', 'singing',
  'books', 'reading', 'stories', 'poetry', 'comics',
  'sports', 'soccer', 'basketball', 'skateboarding', 'swimming', 'cycling',
  'cooking', 'baking', 'recipes',
  'history', 'geography', 'math', 'coding', 'robots', 'minecraft',
];

export type QueryVerdict =
  | { ok: true }
  | { ok: false; reason: 'blocked' | 'not-allowlisted' | 'empty' };

/** Lowercase, strip punctuation to spaces. */
function normalize(query: string): string {
  return query.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokens(query: string): string[] {
  const n = normalize(query);
  return n ? n.split(' ') : [];
}

/**
 * Decide whether a query may run, given the explorer's search settings. Applies
 * BOTH gates when both are active: permit iff (allowlist off OR matches allowlist)
 * AND (blocklist off OR not blocked). The label floor is applied later, to results.
 */
export function queryAllowed(query: string, search: SkyliteSearch): QueryVerdict {
  const norm = normalize(query);
  if (!norm) return { ok: false, reason: 'empty' };

  if (search.useBlocklist) {
    const block = [...DEFAULT_BLOCKLIST, ...search.blocklistExtra.map(normalize)].filter(Boolean);
    // Substring match on the normalized query (protective).
    if (block.some((term) => norm.includes(term))) return { ok: false, reason: 'blocked' };
  }

  if (search.useAllowlist) {
    const allow = new Set([...DEFAULT_ALLOWLIST, ...search.allowlistExtra.map(normalize)].filter(Boolean));
    // Whole-word match: any query token equal to an allowed topic passes.
    if (!tokens(query).some((t) => allow.has(t))) return { ok: false, reason: 'not-allowlisted' };
  }

  return { ok: true };
}
