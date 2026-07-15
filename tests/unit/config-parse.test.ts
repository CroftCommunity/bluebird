import { describe, it, expect } from 'vitest';
import { parseConfig } from '../../src/config/parse.js';

describe('parseConfig', () => {
  it('parses a full valid config', () => {
    const c = parseConfig({
      $type: 'ing.croft.skylite.config',
      version: 1,
      paused: false,
      updatedAt: '2026-07-14T00:00:00Z',
      channels: [
        { id: 'sci', name: 'Science', enabled: true, accounts: [{ actor: 'nasa.gov', displayName: 'NASA' }] },
      ],
    });
    expect(c?.paused).toBe(false);
    expect(c?.channels[0]?.accounts[0]?.actor).toBe('nasa.gov');
  });

  it('returns null when paused is missing or non-boolean', () => {
    expect(parseConfig({ version: 1, channels: [] })).toBeNull();
    expect(parseConfig({ paused: 'yes' })).toBeNull();
    expect(parseConfig(null)).toBeNull();
    expect(parseConfig('nope')).toBeNull();
  });

  it('defaults version to 1 and updatedAt to empty when absent/invalid', () => {
    const c = parseConfig({ paused: true });
    expect(c?.version).toBe(1);
    expect(c?.updatedAt).toBe('');
    expect(c?.channels).toEqual([]);
  });

  it('drops malformed channels and accounts rather than failing', () => {
    const c = parseConfig({
      paused: false,
      channels: [
        { id: 'ok', name: 'Ok', enabled: true, accounts: [{ actor: 'a' }, { actor: '' }, { nope: 1 }] },
        { id: 'bad' }, // missing name → dropped
        'garbage',
      ],
    });
    expect(c?.channels).toHaveLength(1);
    expect(c?.channels[0]?.accounts).toHaveLength(1);
    expect(c?.channels[0]?.accounts[0]?.actor).toBe('a');
  });

  it('treats enabled as strictly true', () => {
    const c = parseConfig({ paused: false, channels: [{ id: 'x', name: 'X', accounts: [] }] });
    expect(c?.channels[0]?.enabled).toBe(false);
  });

  it('parses an optional help contact and omits it when empty', () => {
    const withHelp = parseConfig({ paused: false, help: { contactName: 'Mum', contactEmail: 'm@x.com' } });
    expect(withHelp?.help).toEqual({ contactName: 'Mum', contactEmail: 'm@x.com' });
    const noHelp = parseConfig({ paused: false, help: { contactName: '   ' } });
    expect(noHelp?.help).toBeUndefined();
  });
});
