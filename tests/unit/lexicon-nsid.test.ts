import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';

// RUN-BLUEBIRD: the lexicon NSIDs were renamed ing.croft.skylite.* →
// ing.croft.bluebird.* while the schemas were still free to change (greenfield,
// no records written). Every schema id must live under the new authority and
// none may retain the old one.
const LEXICONS = globSync('lexicons/**/*.json');

describe('lexicon NSIDs', () => {
  it('finds lexicon files', () => {
    expect(LEXICONS.length).toBeGreaterThan(0);
  });

  it.each(LEXICONS)('%s id is under ing.croft.bluebird', (file) => {
    const { id } = JSON.parse(readFileSync(file, 'utf8')) as { id?: string };
    expect(id, `${file} has no id`).toBeTruthy();
    expect(id).toMatch(/^ing\.croft\.bluebird\./);
    expect(id).not.toMatch(/skylite/i);
  });

  it('no lexicon filename retains the old authority', () => {
    const stale = LEXICONS.filter((f) => /skylite/i.test(f));
    expect(stale, `lexicon files still named skylite: ${stale.join(', ')}`).toEqual([]);
  });
});
