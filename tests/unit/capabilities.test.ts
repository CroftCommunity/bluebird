import { describe, it, expect } from 'vitest';
import { capabilities } from '../../src/config/capabilities.js';
import { newExplorerConfig } from '../../src/config/parse.js';
import type { BluebirdConfig } from '../../src/config/types.js';

// Named invariant: capabilities-key-on-localOnly-never-skin (BLUEBIRD-DIRECTIVES
// §0 + §2). Written before the code it guards. `skin` is purely cosmetic and
// must NEVER change what the device is allowed to do.

function withSkin(base: BluebirdConfig, skin: BluebirdConfig['skin']): BluebirdConfig {
  return { ...base, skin };
}

describe('capabilities-key-on-localOnly-never-skin', () => {
  it('is identical across skins for a localOnly explorer', () => {
    const base = newExplorerConfig('a');
    expect(capabilities(withSkin(base, 'simple'))).toEqual(capabilities(withSkin(base, 'full')));
  });

  it('is identical across skins for an account-holding explorer', () => {
    const base = { ...newExplorerConfig('a'), localOnly: false };
    expect(capabilities(withSkin(base, 'simple'))).toEqual(capabilities(withSkin(base, 'full')));
  });

  it('is identical across skins with every data switch flipped on', () => {
    const base: BluebirdConfig = {
      ...newExplorerConfig('a'),
      localOnly: false,
      showFriendsHearts: true,
      search: { ...newExplorerConfig('a').search, tier: 'open' },
      showReposts: false,
    };
    expect(capabilities(withSkin(base, 'simple'))).toEqual(capabilities(withSkin(base, 'full')));
  });

  it('keys persistence on localOnly (account), not on skin', () => {
    const localOnly = capabilities(newExplorerConfig('a'));
    expect(localOnly.canPersistLikes).toBe(false);
    expect(localOnly.canPersistFollows).toBe(false);

    const account = capabilities({ ...newExplorerConfig('a'), localOnly: false });
    expect(account.canPersistLikes).toBe(true);
    expect(account.canPersistFollows).toBe(true);
  });

  it('always allows save, share and local follows in every mode', () => {
    for (const localOnly of [true, false]) {
      const caps = capabilities({ ...newExplorerConfig('a'), localOnly });
      expect(caps.canSave).toBe(true);
      expect(caps.canShare).toBe(true);
      expect(caps.canFollowLocally).toBe(true);
    }
  });

  it('lets a localOnly explorer lurk friends hearts only when the sponsor enables it', () => {
    expect(capabilities({ ...newExplorerConfig('a'), showFriendsHearts: false }).canSeeFriendsHearts).toBe(false);
    expect(capabilities({ ...newExplorerConfig('a'), showFriendsHearts: true }).canSeeFriendsHearts).toBe(true);
    // An account-holder sees them regardless of the lurk toggle.
    expect(
      capabilities({ ...newExplorerConfig('a'), localOnly: false, showFriendsHearts: false }).canSeeFriendsHearts,
    ).toBe(true);
  });
});
