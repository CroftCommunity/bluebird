import { describe, it, expect } from 'vitest';
import { parseProvisioning, provisioningUrl } from '../../src/config/binding.js';

describe('parseProvisioning', () => {
  it('parses g + r + pds', () => {
    const b = parseProvisioning(new URLSearchParams('g=did:plc:abc&r=self&pds=https://pds.example'));
    expect(b).toEqual({ guardianDid: 'did:plc:abc', rkey: 'self', pdsHost: 'https://pds.example' });
  });

  it('defaults rkey to self', () => {
    expect(parseProvisioning(new URLSearchParams('g=did:plc:abc'))?.rkey).toBe('self');
  });

  it('rejects a missing or non-DID g', () => {
    expect(parseProvisioning(new URLSearchParams(''))).toBeNull();
    expect(parseProvisioning(new URLSearchParams('g=notadid'))).toBeNull();
  });
});

describe('provisioningUrl', () => {
  it('builds a link with g, omitting r when self', () => {
    const url = provisioningUrl('https://skylite.croft.ing/', { guardianDid: 'did:plc:abc', rkey: 'self' });
    const u = new URL(url);
    expect(u.searchParams.get('g')).toBe('did:plc:abc');
    expect(u.searchParams.get('r')).toBeNull();
  });

  it('includes r and pds when present', () => {
    const url = provisioningUrl('https://skylite.croft.ing/', {
      guardianDid: 'did:plc:abc',
      rkey: 'custom',
      pdsHost: 'https://pds.example',
    });
    const u = new URL(url);
    expect(u.searchParams.get('r')).toBe('custom');
    expect(u.searchParams.get('pds')).toBe('https://pds.example');
  });
});
