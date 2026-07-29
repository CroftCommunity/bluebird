import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { globSync } from 'node:fs';

// RUN-BLUEBIRD voice guard (docs/VOICE.md). The bird in this brand is a picture
// and a name, never a behavior — so bird verbs / bird-behavior nouns are banned
// from UI-facing copy, along with the person-noun "groomer" (the adjective
// "groomed", applied to trails, is allowed and encouraged). Scanned surfaces:
// every root HTML page (all of it is UI markup + copy) and the copy module
// (src/landing.ts), which carries the verbatim landing copy.

const BANNED: { term: string; re: RegExp }[] = [
  { term: 'tweet', re: /\btweet/i },
  { term: 'flock', re: /\bflock/i },
  { term: 'nest', re: /\bnest/i },
  { term: 'perch', re: /\bperch/i },
  { term: 'migrate', re: /\bmigrat/i },
  { term: 'birdwatch', re: /\bbirdwatch/i },
  // The person-noun only: "groomer(s)". "groomed" (adjective) is intentionally
  // allowed, so anchor on the -er ending.
  { term: 'groomer', re: /\bgroomer/i },
];

const UI_FILES: string[] = [
  ...globSync('*.html'),
  ...['src/landing.ts'].filter((f) => existsSync(f)),
];

describe('UI copy vocabulary lint', () => {
  it('scans a non-empty set of UI-facing files', () => {
    expect(UI_FILES.length).toBeGreaterThan(0);
  });

  it.each(UI_FILES)('%s uses no banned vocabulary', (file) => {
    const text = readFileSync(file, 'utf8');
    const hits = BANNED.filter((b) => b.re.test(text)).map((b) => b.term);
    expect(hits, `banned vocabulary in ${file}: ${hits.join(', ')}`).toEqual([]);
  });
});
