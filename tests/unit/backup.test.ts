import { describe, it, expect } from 'vitest';
import {
  buildBackup,
  parseBackup,
  restoreBackup,
  BACKUP_SCHEMA,
  type BackupPorts,
} from '../../src/backup/backup.js';
import type { Clip } from '../../src/saves/clip.js';
import { newExplorerConfig } from '../../src/config/parse.js';

function clip(uri: string, note = ''): Clip {
  return { uri, authorName: 'A', handle: 'a.test', text: 't', note, savedAt: 1 };
}

/** An in-memory device: fake storage ports for hermetic backup tests. */
function fakeDevice(seed: Partial<{ clips: Clip[]; follows: string[] }> = {}): {
  ports: BackupPorts;
  state: { clips: Map<string, Clip>; follows: string[]; binding: unknown; localConfig: unknown };
} {
  const state = {
    clips: new Map<string, Clip>((seed.clips ?? []).map((c) => [c.uri, c])),
    follows: seed.follows ?? [],
    binding: null as unknown,
    localConfig: null as unknown,
  };
  const ports: BackupPorts = {
    listClips: () => Promise.resolve([...state.clips.values()]),
    putClip: (c) => {
      state.clips.set(c.uri, c);
      return Promise.resolve();
    },
    getBinding: () => state.binding as never,
    setBinding: (b) => {
      state.binding = b;
    },
    getLocalConfig: () => state.localConfig as never,
    setLocalConfig: (c) => {
      state.localConfig = c;
    },
    getLocalFollows: () => state.follows,
    setLocalFollows: (f) => {
      state.follows = f;
    },
    now: () => Date.parse('2026-07-15T00:00:00.000Z'),
  };
  return { ports, state };
}

describe('buildBackup', () => {
  it('captures saves, follows, and settings into a versioned envelope', async () => {
    const { ports, state } = fakeDevice({ clips: [clip('at://1', 'draw this')], follows: ['did:plc:f'] });
    state.binding = { sponsorDid: 'did:plc:s', rkey: 'abc' };
    const backup = await buildBackup(ports);
    expect(backup.$schema).toBe(BACKUP_SCHEMA);
    expect(backup.exportedAt).toBe('2026-07-15T00:00:00.000Z');
    expect(backup.saves).toHaveLength(1);
    expect(backup.saves[0]?.note).toBe('draw this');
    expect(backup.localFollows).toEqual(['did:plc:f']);
    expect(backup.settings.binding?.sponsorDid).toBe('did:plc:s');
  });
});

describe('parseBackup', () => {
  it('rejects a non-Bluebird object', () => {
    expect(parseBackup({ hello: 1 })).toBeNull();
    expect(parseBackup(null)).toBeNull();
    expect(parseBackup('nope')).toBeNull();
  });

  it('parses a valid backup and drops malformed clips', () => {
    const parsed = parseBackup({
      $schema: BACKUP_SCHEMA,
      version: 1,
      exportedAt: 'x',
      saves: [clip('at://ok'), { nope: true }, 5],
      localFollows: ['did:plc:a', 7],
      settings: { binding: { sponsorDid: 'did:plc:s', rkey: 'r' } },
    });
    expect(parsed?.saves).toHaveLength(1);
    expect(parsed?.localFollows).toEqual(['did:plc:a']);
    expect(parsed?.settings.binding?.sponsorDid).toBe('did:plc:s');
  });

  it('drops an invalid binding but keeps the rest', () => {
    const parsed = parseBackup({ $schema: BACKUP_SCHEMA, saves: [], settings: { binding: { sponsorDid: 'nope' } } });
    expect(parsed?.settings.binding).toBeUndefined();
  });
});

describe('restore round-trip', () => {
  it('export from device A imports identically on a fresh device B', async () => {
    const a = fakeDevice({ clips: [clip('at://1', 'n1'), clip('at://2', 'n2')], follows: ['did:plc:f'] });
    a.state.binding = { sponsorDid: 'did:plc:s', rkey: 'abc', pdsHost: 'https://pds' };
    a.state.localConfig = newExplorerConfig('Star');

    const file = await buildBackup(a.ports);
    const roundTripped = parseBackup(JSON.parse(JSON.stringify(file)));
    if (!roundTripped) throw new Error('backup failed to round-trip');

    const b = fakeDevice();
    const summary = await restoreBackup(roundTripped, b.ports);

    expect(summary).toEqual({ saves: 2, follows: 1, boundSponsor: true, localConfig: true });
    expect([...b.state.clips.values()].map((c) => c.uri).sort()).toEqual(['at://1', 'at://2']);
    expect(b.state.follows).toEqual(['did:plc:f']);
    expect((b.state.binding as { sponsorDid: string }).sponsorDid).toBe('did:plc:s');
    expect((b.state.localConfig as { displayName: string }).displayName).toBe('Star');
  });
});
