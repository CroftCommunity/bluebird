import type { ConfigSource, SkyliteConfig } from './types.js';

/**
 * D5 — the offline/staleness gate for a PDS-provisioned device.
 *
 *  - The pause flag is enforced on every successful poll, and also persists from
 *    the last-good cache while offline (pause must not be defeated by pulling the
 *    network).
 *  - Offline **fails open for cached content** — anything cached already passed
 *    the inclusion ceiling, so showing it (with a banner) is safe.
 *  - Offline **fails closed for staleness** — if the config has not been reachable
 *    for N hours (default 72) the garden locks until it is, so a sponsor's pause
 *    or list change can't be indefinitely outrun by staying offline.
 */

export const DEFAULT_STALE_HOURS = 72;

export interface CachedConfig {
  config: SkyliteConfig;
  fetchedAt: number;
}

export type PollResult =
  | { status: 'ok'; config: SkyliteConfig }
  | { status: 'unreachable' };

export type Gate =
  | { kind: 'active'; config: SkyliteConfig; source: ConfigSource; offline: boolean }
  | { kind: 'paused'; source: ConfigSource }
  | { kind: 'stale-locked'; lastFetchedAt: number | null };

export function resolvePdsGate(
  poll: PollResult,
  lastGood: CachedConfig | null,
  now: number,
  staleHours: number = DEFAULT_STALE_HOURS,
): Gate {
  if (poll.status === 'ok') {
    if (poll.config.paused) return { kind: 'paused', source: 'pds' };
    return { kind: 'active', config: poll.config, source: 'pds', offline: false };
  }

  // Unreachable — lean on the last-good cache.
  if (!lastGood) return { kind: 'stale-locked', lastFetchedAt: null };

  // Pause persists offline (safety cannot be outrun by dropping the network).
  if (lastGood.config.paused) return { kind: 'paused', source: 'pds-cached' };

  const ageMs = now - lastGood.fetchedAt;
  const staleMs = staleHours * 60 * 60 * 1000;
  if (ageMs <= staleMs) {
    return { kind: 'active', config: lastGood.config, source: 'pds-cached', offline: true };
  }
  return { kind: 'stale-locked', lastFetchedAt: lastGood.fetchedAt };
}

/** Local-only / dev-fixture gate — no polling, just the pause flag. */
export function resolveLocalGate(config: SkyliteConfig, source: ConfigSource): Gate {
  if (config.paused) return { kind: 'paused', source };
  return { kind: 'active', config, source, offline: false };
}
