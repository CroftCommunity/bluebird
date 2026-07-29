import { describe, it, expect } from 'vitest';
import { parseConfig, newExplorerConfig } from '../../src/config/parse.js';
import { CONFIG_DEFAULTS } from '../../src/config/types.js';

describe('parseConfig (two-switch v2)', () => {
  it('parses a full valid v2 config', () => {
    const c = parseConfig({
      $type: 'ing.croft.bluebird.config',
      version: 2,
      displayName: 'Star',
      localOnly: false,
      skin: 'full',
      paused: false,
      updatedAt: '2026-07-14T00:00:00Z',
      channels: [
        { id: 'sci', name: 'Science', enabled: true, accounts: [{ actor: 'nasa.gov', displayName: 'NASA' }] },
      ],
      friends: [{ did: 'did:plc:friend', displayName: 'Pat' }],
      showFriendsHearts: true,
      approvedFeeds: [{ uri: 'at://did:plc:x/app.bsky.feed.generator/whats-hot', name: 'Discover' }],
      telescope: true,
      showReposts: false,
      staleHours: 24,
    });
    expect(c?.displayName).toBe('Star');
    expect(c?.localOnly).toBe(false);
    expect(c?.skin).toBe('full');
    expect(c?.channels[0]?.accounts[0]?.actor).toBe('nasa.gov');
    expect(c?.friends[0]?.did).toBe('did:plc:friend');
    expect(c?.showFriendsHearts).toBe(true);
    expect(c?.approvedFeeds[0]?.name).toBe('Discover');
    expect(c?.search.tier).toBe('open'); // legacy telescope:true migrates to tier 'open'
    expect(c?.showReposts).toBe(false);
    expect(c?.staleHours).toBe(24);
  });

  it('migrates a legacy v1 record by filling two-switch defaults', () => {
    // The one existing deployed shape: paused + channels + help, no switches.
    const c = parseConfig({
      version: 1,
      paused: false,
      updatedAt: '2026-07-14T00:00:00Z',
      channels: [{ id: 'sci', name: 'Science', enabled: true, accounts: [{ actor: 'nasa.gov' }] }],
      help: { contactName: 'Mum' },
    });
    expect(c).not.toBeNull();
    expect(c?.localOnly).toBe(CONFIG_DEFAULTS.localOnly); // true
    expect(c?.skin).toBe(CONFIG_DEFAULTS.skin); // simple
    expect(c?.showReposts).toBe(CONFIG_DEFAULTS.showReposts); // true
    expect(c?.search.tier).toBe('off'); // no legacy telescope → off
    expect(c?.search.useBlocklist).toBe(true); // safe default
    expect(c?.showFriendsHearts).toBe(false);
    expect(c?.staleHours).toBe(CONFIG_DEFAULTS.staleHours); // 72
    expect(c?.friends).toEqual([]);
    expect(c?.approvedFeeds).toEqual([]);
    expect(c?.help).toEqual({ contactName: 'Mum' });
    expect(c?.channels[0]?.accounts[0]?.actor).toBe('nasa.gov');
  });

  it('returns null for values that are not recognizably a config', () => {
    expect(parseConfig({ hello: 'world' })).toBeNull();
    expect(parseConfig({ paused: 'yes' })).toBeNull();
    expect(parseConfig(null)).toBeNull();
    expect(parseConfig('nope')).toBeNull();
  });

  it('recognizes a config by a channels array even without paused', () => {
    const c = parseConfig({ channels: [] });
    expect(c).not.toBeNull();
    expect(c?.paused).toBe(false);
    expect(c?.localOnly).toBe(true);
  });

  it('drops malformed channels, accounts, friends and feeds rather than failing', () => {
    const c = parseConfig({
      paused: false,
      channels: [
        { id: 'ok', name: 'Ok', enabled: true, accounts: [{ actor: 'a' }, { actor: '' }, { nope: 1 }] },
        { id: 'bad' }, // missing name → dropped
        'garbage',
      ],
      friends: [{ did: 'did:plc:ok' }, { did: 'notadid' }, 'x'],
      approvedFeeds: [{ uri: 'at://feed' }, { name: 'no uri' }, 5],
    });
    expect(c?.channels).toHaveLength(1);
    expect(c?.channels[0]?.accounts).toHaveLength(1);
    expect(c?.friends).toHaveLength(1);
    expect(c?.friends[0]?.did).toBe('did:plc:ok');
    expect(c?.approvedFeeds).toHaveLength(1);
    expect(c?.approvedFeeds[0]?.name).toBe('at://feed'); // name falls back to uri
  });

  it('treats channel.enabled and switches as strictly boolean', () => {
    const c = parseConfig({ paused: false, channels: [{ id: 'x', name: 'X', accounts: [] }], localOnly: 'no' });
    expect(c?.channels[0]?.enabled).toBe(false);
    expect(c?.localOnly).toBe(true); // non-boolean → default true
  });

  it('coerces an unknown skin to simple (safe default)', () => {
    expect(parseConfig({ paused: false, skin: 'sparkles' })?.skin).toBe('simple');
    expect(parseConfig({ paused: false, skin: 'full' })?.skin).toBe('full');
  });

  it('newExplorerConfig is a fully-defaulted, localOnly=true, simple-skin record', () => {
    const c = newExplorerConfig('Comet');
    expect(c.displayName).toBe('Comet');
    expect(c.localOnly).toBe(true);
    expect(c.skin).toBe('simple');
    expect(c.showReposts).toBe(true);
    expect(c.version).toBe(2);
  });
});
