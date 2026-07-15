/**
 * §Telescope search history — the accountability indicator (docs/telescope-search.md).
 * When the sponsor left `logHistory` on, every search ATTEMPT (including blocked
 * ones) is recorded on the device so the sponsor can see what was searched. This
 * is deliberately visible, not secret — Skylite's honesty stance. It lives on the
 * device; account-synced/remote history is staged.
 */

export interface SearchEntry {
  q: string;
  at: number;
  blocked: boolean;
}

const KEY = 'skylite.search.history';
const CAP = 50;

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

/** Record a search attempt (newest first, capped). `at` is passed in for testability. */
export function logSearch(q: string, blocked: boolean, at: number): void {
  const entry: SearchEntry = { q, at, blocked };
  const next = [entry, ...getSearchHistory()].slice(0, CAP);
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
