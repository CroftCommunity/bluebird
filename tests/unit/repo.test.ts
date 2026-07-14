import { describe, it, expect } from 'vitest';
import { RepoClient, pdsEndpointFromDoc } from '../../src/atproto/repo.js';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
}

describe('pdsEndpointFromDoc', () => {
  it('extracts the atproto PDS service endpoint', () => {
    expect(
      pdsEndpointFromDoc({
        id: 'did:plc:abc',
        service: [
          { id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example' },
        ],
      }),
    ).toBe('https://pds.example');
  });

  it('returns null when there is no PDS service', () => {
    expect(pdsEndpointFromDoc({ id: 'did:plc:abc' })).toBeNull();
  });
});

describe('RepoClient.resolvePds', () => {
  it('resolves did:plc via the PLC directory', async () => {
    let seen = '';
    const client = new RepoClient({
      fetchImpl: (input) => {
        seen = input instanceof URL ? input.href : typeof input === 'string' ? input : '';
        return Promise.resolve(
          jsonResponse({
            id: 'did:plc:abc',
            service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example/' }],
          }),
        );
      },
    });
    const endpoint = await client.resolvePds('did:plc:abc');
    expect(seen).toBe('https://plc.directory/did:plc:abc');
    expect(endpoint).toBe('https://pds.example'); // trailing slash trimmed
  });

  it('resolves did:web via well-known', async () => {
    let seen = '';
    const client = new RepoClient({
      fetchImpl: (input) => {
        seen = input instanceof URL ? input.href : typeof input === 'string' ? input : '';
        return Promise.resolve(
          jsonResponse({ id: 'did:web:example.com', service: [{ id: '#atproto_pds', type: 'AtprotoPersonalDataServer', serviceEndpoint: 'https://pds.example' }] }),
        );
      },
    });
    await client.resolvePds('did:web:example.com');
    expect(seen).toBe('https://example.com/.well-known/did.json');
  });
});

describe('RepoClient.getRecord', () => {
  it('builds the getRecord URL from repo/collection/rkey', async () => {
    let seen: URL | undefined;
    const client = new RepoClient({
      fetchImpl: (input) => {
        seen = input as URL;
        return Promise.resolve(jsonResponse({ uri: 'at://x', value: { paused: false } }));
      },
    });
    const res = await client.getRecord('https://pds.example', {
      repo: 'did:plc:abc',
      collection: 'ing.croft.skylite.config',
      rkey: 'self',
    });
    expect(seen?.pathname).toBe('/xrpc/com.atproto.repo.getRecord');
    expect(seen?.searchParams.get('repo')).toBe('did:plc:abc');
    expect(seen?.searchParams.get('collection')).toBe('ing.croft.skylite.config');
    expect(seen?.searchParams.get('rkey')).toBe('self');
    expect(res.value).toEqual({ paused: false });
  });
});
