import { describe, it, expect } from 'vitest';
import { effectiveInclusion } from '../../src/config/inclusion.js';
import { newExplorerConfig } from '../../src/config/parse.js';
import type { SkyliteConfig } from '../../src/config/types.js';

function cfg(channels: SkyliteConfig['channels']): SkyliteConfig {
  return { ...newExplorerConfig(), channels };
}

describe('effectiveInclusion', () => {
  it('includes only accounts from enabled channels', () => {
    const inc = effectiveInclusion(
      cfg([
        { id: 'on', name: 'On', enabled: true, accounts: [{ actor: 'a.test' }] },
        { id: 'off', name: 'Off', enabled: false, accounts: [{ actor: 'b.test' }] },
      ]),
    );
    expect(inc.map((e) => e.actor)).toEqual(['a.test']);
  });

  it('de-duplicates across channels case-insensitively', () => {
    const inc = effectiveInclusion(
      cfg([
        { id: 'c1', name: 'One', enabled: true, accounts: [{ actor: 'Dup.test' }] },
        { id: 'c2', name: 'Two', enabled: true, accounts: [{ actor: 'dup.test' }, { actor: 'c.test' }] },
      ]),
    );
    expect(inc.map((e) => e.actor)).toEqual(['Dup.test', 'c.test']);
  });

  it('falls back to actor for the display name', () => {
    const inc = effectiveInclusion(
      cfg([{ id: 'c', name: 'C', enabled: true, accounts: [{ actor: 'x.test' }] }]),
    );
    expect(inc[0]?.displayName).toBe('x.test');
  });

  it('is empty when no channels are enabled', () => {
    expect(effectiveInclusion(cfg([{ id: 'c', name: 'C', enabled: false, accounts: [{ actor: 'a' }] }]))).toEqual([]);
  });
});
