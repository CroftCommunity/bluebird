import { describe, it, expect } from 'vitest';
import { WriteClient, WriteError } from '../../src/atproto/write.js';
import type { SkyliteConfig } from '../../src/config/types.js';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

const urlOf = (i: RequestInfo | URL): string =>
  i instanceof URL ? i.href : typeof i === 'string' ? i : '';
const bodyOf = (init: RequestInit | undefined): string =>
  typeof init?.body === 'string' ? init.body : '';

const SESSION_OK = {
  did: 'did:plc:guardian',
  handle: 'guardian.test',
  accessJwt: 'access-token',
  refreshJwt: 'refresh-token',
  didDoc: {
    id: 'did:plc:guardian',
    service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.host.bsky.network/' }],
  },
};

const config: SkyliteConfig = { version: 1, paused: false, updatedAt: '2026-07-14T00:00:00Z', channels: [] };

describe('WriteClient.createSession', () => {
  it('posts identifier+password and resolves the PDS from the didDoc', async () => {
    let seenUrl = '';
    let seenBody: unknown;
    const client = new WriteClient({
      fetchImpl: (input, init) => {
        seenUrl = urlOf(input);
        seenBody = JSON.parse(bodyOf(init));
        return Promise.resolve(json(SESSION_OK));
      },
    });
    const session = await client.createSession('guardian.test', 'app-pass');
    expect(seenUrl).toBe('https://bsky.social/xrpc/com.atproto.server.createSession');
    expect(seenBody).toEqual({ identifier: 'guardian.test', password: 'app-pass' });
    expect(session.did).toBe('did:plc:guardian');
    expect(session.pdsHost).toBe('https://pds.host.bsky.network'); // trailing slash trimmed
  });

  it('surfaces an auth error with its code', async () => {
    const client = new WriteClient({
      fetchImpl: () => Promise.resolve(json({ error: 'AuthenticationRequired', message: 'Invalid identifier or password' }, 401)),
    });
    await expect(client.createSession('x', 'y')).rejects.toMatchObject({
      name: 'WriteError',
      code: 'AuthenticationRequired',
    });
  });
});

describe('WriteClient.putRecord', () => {
  it('sends a Bearer token and the record envelope to the PDS', async () => {
    let seenUrl = '';
    let seenAuth: string | null = null;
    let seenBody: Record<string, unknown> = {};
    const client = new WriteClient({
      fetchImpl: (input, init) => {
        seenUrl = urlOf(input);
        seenAuth = new Headers(init?.headers).get('authorization');
        seenBody = JSON.parse(bodyOf(init)) as Record<string, unknown>;
        return Promise.resolve(json({ uri: 'at://did:plc:guardian/ing.croft.skylite.config/self', cid: 'bafy' }));
      },
    });
    const session = {
      did: 'did:plc:guardian',
      handle: 'guardian.test',
      accessJwt: 'ACCESS',
      refreshJwt: 'r',
      pdsHost: 'https://pds.host.bsky.network',
    };
    const res = await client.putRecord(session, { collection: 'ing.croft.skylite.config', rkey: 'self', record: { a: 1 } });
    expect(seenUrl).toBe('https://pds.host.bsky.network/xrpc/com.atproto.repo.putRecord');
    expect(seenAuth).toBe('Bearer ACCESS');
    expect(seenBody).toMatchObject({ repo: 'did:plc:guardian', collection: 'ing.croft.skylite.config', rkey: 'self' });
    expect(res.uri).toContain('ing.croft.skylite.config/self');
  });
});

describe('WriteClient.publishConfig', () => {
  it('signs in then writes the config with $type stamped', async () => {
    const calls: string[] = [];
    let putBody: Record<string, unknown> = {};
    const client = new WriteClient({
      fetchImpl: (input, init) => {
        const url = urlOf(input);
        calls.push(url);
        if (url.endsWith('createSession')) return Promise.resolve(json(SESSION_OK));
        putBody = JSON.parse(bodyOf(init)) as Record<string, unknown>;
        return Promise.resolve(json({ uri: 'at://did:plc:guardian/ing.croft.skylite.config/self', cid: 'c' }));
      },
    });
    const { uri, session } = await client.publishConfig('guardian.test', 'app-pass', config);
    expect(calls[0]).toContain('createSession');
    expect(calls[1]).toContain('putRecord');
    expect((putBody.record as Record<string, unknown>).$type).toBe('ing.croft.skylite.config');
    expect(session.handle).toBe('guardian.test');
    expect(uri).toContain('/self');
  });

  it('propagates a WriteError from a failed publish', async () => {
    const client = new WriteClient({
      fetchImpl: (input) => {
        const url = urlOf(input);
        if (url.endsWith('createSession')) return Promise.resolve(json(SESSION_OK));
        return Promise.resolve(json({ error: 'InvalidRequest', message: 'nope' }, 400));
      },
    });
    await expect(client.publishConfig('a', 'b', config)).rejects.toBeInstanceOf(WriteError);
  });
});
