/**
 * §Telescope search history — the accountability indicator (docs/trail-map-search.md).
 * When the sponsor left `logHistory` on, every search ATTEMPT (including blocked
 * ones) is recorded on the device so the sponsor can see what was searched. This
 * is deliberately visible, not secret — Bluebird's honesty stance. It lives on the
 * device; account-synced/remote history is staged.
 */

export interface SearchEntry {
  q: string;
  at: number;
  blocked: boolean;
}

const KEY = 'bluebird.search.history';
/** Retention: the device keeps the last 30 days, up to 500 entries. */
const MAX_ENTRIES = 500;
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function getSearchHistory(): SearchEntry[] {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : null;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is SearchEntry =>
        typeof e === 'object' && e !== null && typeof (e as SearchEntry).q === 'string',
    );
  } catch {
    return [];
  }
}

/** Drop entries older than 30 days, then keep the 500 newest. */
export function pruneHistory(entries: SearchEntry[], now: number): SearchEntry[] {
  return entries.filter((e) => now - e.at <= MAX_AGE_MS).slice(0, MAX_ENTRIES);
}

/** Record a search attempt (newest first, 30-day / 500 retention). `at` for testability. */
export function logSearch(q: string, blocked: boolean, at: number): void {
  const next = pruneHistory([{ q, at, blocked }, ...getSearchHistory()], at);
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage disabled — non-fatal */
  }
}

export function clearSearchHistory(): void {
  try {
    globalThis.localStorage?.removeItem(KEY);
  } catch {
    /* non-fatal */
  }
}
