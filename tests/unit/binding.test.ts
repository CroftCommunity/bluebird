import { describe, it, expect } from 'vitest';
import { parseProvisioning, provisioningUrl } from '../../src/config/binding.js';

describe('parseProvisioning', () => {
  it('parses s + r + pds', () => {
    const b = parseProvisioning(new URLSearchParams('s=did:plc:abc&r=self&pds=https://pds.example'));
    expect(b).toEqual({ sponsorDid: 'did:plc:abc', rkey: 'self', pdsHost: 'https://pds.example' });
  });

  it('accepts the legacy g alias for the sponsor DID', () => {
    expect(parseProvisioning(new URLSearchParams('g=did:plc:abc'))?.sponsorDid).toBe('did:plc:abc');
  });

  it('defaults rkey to self', () => {
    expect(parseProvisioning(new URLSearchParams('s=did:plc:abc'))?.rkey).toBe('self');
  });

  it('rejects a missing or non-DID sponsor DID', () => {
    expect(parseProvisioning(new URLSearchParams(''))).toBeNull();
    expect(parseProvisioning(new URLSearchParams('s=notadid'))).toBeNull();
  });
});

describe('provisioningUrl', () => {
  it('builds a link with s, omitting r when self', () => {
    const url = provisioningUrl('https://skylite.croft.ing/', { sponsorDid: 'did:plc:abc', rkey: 'self' });
    const u = new URL(url);
    expect(u.searchParams.get('s')).toBe('did:plc:abc');
    expect(u.searchParams.get('r')).toBeNull();
  });

  it('includes r and pds when present', () => {
    const url = provisioningUrl('https://skylite.croft.ing/', {
      sponsorDid: 'did:plc:abc',
      rkey: 'custom',
      pdsHost: 'https://pds.example',
    });
    const u = new URL(url);
    expect(u.searchParams.get('r')).toBe('custom');
    expect(u.searchParams.get('pds')).toBe('https://pds.example');
  });
});
