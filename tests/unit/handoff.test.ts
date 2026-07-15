import { describe, it, expect } from 'vitest';
import { buildMailto } from '../../src/care/handoff.js';

describe('buildMailto', () => {
  it('returns null without an email', () => {
    expect(buildMailto({})).toBeNull();
    expect(buildMailto({ contactName: 'Mum' })).toBeNull();
  });

  it('builds a prefilled mailto with the contact email', () => {
    const url = buildMailto({ contactName: 'Mum', contactEmail: 'mum@example.com' });
    expect(url).toMatch(/^mailto:mum@example\.com\?/);
    expect(url).toContain('subject=');
    expect(url).toContain('body=');
    expect(decodeURIComponent(url ?? '')).toContain('Mum');
  });

  it('works without a name', () => {
    const url = buildMailto({ contactEmail: 'a@b.com' });
    expect(url).toMatch(/^mailto:a@b\.com\?/);
  });
});
