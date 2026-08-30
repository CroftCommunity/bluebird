import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PROVIDERS,
  SIGNUP,
  ATMO_GLOSS,
  providerById,
  featuredProviders,
  otherProviders,
  canCreateAccount,
  validateProviders,
  type Provider,
} from '../../src/signin/providers.js';

// The sign-in sheet's provider registry — croft-pwa/docs/DESIGN.md § Flows › Sign
// in, ported from croft-pwa/src/signin/. Every fact was probed against the live
// network (forage 2026-08-26..29); tests/live/signin-providers.live.spec.ts re-probes.

const open = (id: string): Provider => ({ id, label: id.toUpperCase(), entryway: `https://${id}.test`, signups: SIGNUP.OPEN });
const invite = (id: string): Provider => ({ id, label: id.toUpperCase(), entryway: `https://${id}.test`, signups: SIGNUP.INVITE });

describe('signin providers: the registry', () => {
  it('passes its own validation', () => {
    expect(() => validateProviders(PROVIDERS)).not.toThrow();
  });
  it('knows the probed postures: bsky, blacksky and eurosky OPEN; northsky INVITE', () => {
    const by = Object.fromEntries(PROVIDERS.map((p) => [p.entryway, p.signups]));
    expect(by['https://bsky.social']).toBe(SIGNUP.OPEN);
    expect(by['https://blacksky.app']).toBe(SIGNUP.OPEN);
    expect(by['https://eurosky.social']).toBe(SIGNUP.OPEN);
    expect(by['https://northsky.social']).toBe(SIGNUP.INVITE);
  });
  it('names what it does not know, and what it does', () => {
    expect(() => providerById('nope')).toThrow(/nope.*bsky/);
    expect(providerById('eurosky').label).toBe('EuroSky');
  });
  it('carries the atmo gloss verbatim (owner wording 2026-08-29)', () => {
    expect(ATMO_GLOSS).toBe('A Personal Data Server provider in the open social Atmosphere');
  });
});

describe('signin providers: two panels, split by posture', () => {
  it('featured = open (registry order, capped); other = invite-only', () => {
    const reg = [open('o1'), invite('i1'), open('o2')];
    expect(featuredProviders(reg).map((p) => p.id)).toEqual(['o1', 'o2']);
    expect(otherProviders(reg).map((p) => p.id)).toEqual(['i1']);
  });
  it('every registered provider is on exactly one panel', () => {
    const all = [...featuredProviders(), ...otherProviders()].map((p) => p.id).sort();
    expect(all).toEqual(PROVIDERS.map((p) => p.id).sort());
  });
  it('the featured list is capped at four', () => {
    expect(featuredProviders(['a', 'b', 'c', 'd', 'e'].map(open))).toHaveLength(4);
  });
  // BOTH directions: an invite-only provider still advertises prompt=create; it
  // would land on a screen that then demands a code. Posture decides.
  it('open providers offer account creation; invite-only ones do NOT', () => {
    expect(canCreateAccount(open('o'))).toBe(true);
    expect(canCreateAccount(invite('i'))).toBe(false);
  });
});

describe('signin providers: bad registry data fails loudly', () => {
  it('an unknown posture names the provider AND the value', () => {
    const bad = [{ id: 'x', label: 'X', entryway: 'https://x.test', signups: 'maybe' }] as unknown as readonly Provider[];
    expect(() => validateProviders(bad)).toThrow(/x.*maybe/);
  });
  it('a non-https entryway is refused', () => {
    expect(() => validateProviders([{ ...open('h'), entryway: 'http://h.test' }])).toThrow(/https/);
  });
  it('two ids on one entryway is a bug, not two providers', () => {
    expect(() => validateProviders([open('a'), { ...invite('b'), entryway: 'https://a.test' }])).toThrow(/a\.test/);
  });
});

// The CSP is per-page static markup here (no build-time injection), so the
// "derive connect-src from the registry" rule (DESIGN.md § Flows › Sign in, rule 7)
// is enforced as PARITY: every page that can start OAuth (it allowlists
// plc.directory) must admit every registered entryway — each provider is its own
// authorization server, so discovery, PAR and token all stay inside the list.
// Without this, a provider button fails with a CSP refusal on a phone, silently.
describe('signin providers: every page that can START sign-in admits every provider in connect-src', () => {
  const ROOT = join(__dirname, '..', '..');
  // The two surfaces that mount the sheet: the Lodge (explorer banner, main.ts)
  // and Patrol (sponsor.ts). Other pages allowlist plc.directory for read-side
  // resolution only and never start OAuth, so they are out of scope on purpose.
  const SIGNIN_PAGES = ['index.html', 'patrol.html'];
  it.each(SIGNIN_PAGES)('%s connect-src lists every registered entryway', (page) => {
    // Read the META content, not the file: patrol.html's authoring comment says
    // "connect-src" in prose, and a file-wide regex matched the comment first.
    const meta = /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(readFileSync(join(ROOT, page), 'utf8'))?.[1] ?? '';
    const csp = /connect-src([^;]*)/.exec(meta)?.[1] ?? '';
    const missing = PROVIDERS.map((p) => p.entryway).filter((o) => !csp.split(/\s+/).includes(o));
    expect(missing, `${page}: add to connect-src`).toEqual([]);
  });
});
