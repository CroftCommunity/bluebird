import type { InclusionEntry } from '../feed/inclusion.js';
import type { SkyliteConfig } from './types.js';

/**
 * The child's effective inclusion list: the union of accounts across ENABLED
 * channels, de-duplicated by actor. Toggling a channel off removes its accounts
 * from the garden — this is "channel toggles change the garden" (Phase 2).
 */
export function effectiveInclusion(config: SkyliteConfig): InclusionEntry[] {
  const seen = new Set<string>();
  const out: InclusionEntry[] = [];
  for (const channel of config.channels) {
    if (!channel.enabled) continue;
    for (const acct of channel.accounts) {
      const key = acct.actor.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ actor: acct.actor, displayName: acct.displayName ?? acct.actor });
    }
  }
  return out;
}
