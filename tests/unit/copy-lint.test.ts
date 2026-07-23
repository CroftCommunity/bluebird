import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * RUN-TRUEUP copy lint. A grep-style guard over the LIVING surfaces (the app's
 * src/ and the living HTML/manifest/docs) for retired copy: the old tagline
 * (Phase 0), the age-framed role word (Phase 3), and the banned "unbreakable"
 * absolutes (Phase 5). Historical record — CONCEPT/IDEAS/PROVENANCE/seeds and the
 * RUN-*-SUMMARY files — is deliberately NOT scanned: it is frozen (rule 5).
 */

const ROOT = join(__dirname, '..', '..');

/** All .ts files under src/ (the UI-copy string literals live here). */
function srcFiles(): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith('.ts')) out.push(p);
    }
  };
  walk(join(ROOT, 'src'));
  return out;
}

/** Living HTML + manifest surfaces (product copy that ships to the browser). */
const LIVING_SURFACES = [
  'index.html',
  'help.html',
  'guide.html',
  'sponsor.html',
  'audit.html',
  'telescope.html',
  'mysky.html',
  'saves.html',
  'post.html',
  'manifest.webmanifest',
].map((f) => join(ROOT, f));

/** Living design docs (frozen history — the RUN summaries — is excluded). */
const LIVING_DOCS = ['docs/telescope-search.md', 'docs/custody.md', 'docs/git-verified-commits.md'].map((f) =>
  join(ROOT, f),
);

function read(files: string[]): { file: string; text: string }[] {
  return files.map((file) => ({ file: file.replace(ROOT + '/', ''), text: readFileSync(file, 'utf8') }));
}

function offenders(files: { file: string; text: string }[], needle: RegExp): string[] {
  return files.filter(({ text }) => needle.test(text)).map(({ file }) => file);
}

describe('Phase 0 — the retired tagline is gone from living surfaces', () => {
  it('no "window to the stars" in src/, living HTML, or living docs', () => {
    const files = read([...srcFiles(), ...LIVING_SURFACES, ...LIVING_DOCS]);
    expect(offenders(files, /window to the stars/i)).toEqual([]);
  });
});

describe('Phase 3 — the age-framed role word is gone from living copy', () => {
  it('no "grown-up" in src/, living HTML, or living docs (the role is "sponsor")', () => {
    const files = read([...srcFiles(), ...LIVING_SURFACES, ...LIVING_DOCS]);
    expect(offenders(files, /grown-?up/i)).toEqual([]);
  });
});

describe('Phase 5 — no absolute encryption claims in living copy', () => {
  it('no "unbreakable" / "impossible to" / "no one can ever" in src/ or living HTML', () => {
    // The honest shape is "so no one else can read what you searched" — never an
    // absolute. (Docs describe the scheme precisely and are not scanned for this.)
    const files = read([...srcFiles(), ...LIVING_SURFACES]);
    expect(offenders(files, /unbreakable|impossible to|no one can ever/i)).toEqual([]);
  });
});

describe('Phase 6 — living docs use the current role vocabulary', () => {
  it('no dead role vocabulary (guardian / custodian / viewer / child / scrapbook / grown-up) in docs/ living files', () => {
    // The roles are sponsor + explorer. Historical artifacts (CONCEPT/IDEAS/
    // PROVENANCE/seeds, RUN summaries, the README seed) keep their original words
    // and are NOT scanned — this covers only the living docs/ tree.
    const files = read(LIVING_DOCS);
    expect(offenders(files, /\b(guardian|custodian|viewer|scrapbook|child|grown-?up)\b/i)).toEqual([]);
  });
});

describe('Phase 6 — every path referenced in README/docs exists in the tree', () => {
  /** Pull local file references: markdown link targets + file-ish inline code. */
  function referencedPaths(text: string): string[] {
    const out = new Set<string>();
    for (const m of text.matchAll(/\]\(([^)]+)\)/g)) {
      if (m[1]) out.add(m[1]);
    }
    for (const m of text.matchAll(/`([^`]+)`/g)) {
      const p = m[1];
      if (p && (/^\/?[\w./-]+\.(md|ts|html|css|mjs|json|webmanifest)$/.test(p) || /^[\w./-]+\/$/.test(p))) out.add(p);
    }
    return [...out]
      .map((p) => p.trim())
      .filter((p) => p && !/^(https?:|mailto:|#)/.test(p))
      .map((p) => p.replace(/#.*$/, '').replace(/^\//, '').replace(/\/$/, ''))
      .filter(Boolean);
  }

  it('README + docs reference only paths that exist', () => {
    const docs = ['README.md', 'docs/telescope-search.md', 'docs/custody.md', 'docs/git-verified-commits.md'];
    const missing: string[] = [];
    for (const doc of docs) {
      const text = readFileSync(join(ROOT, doc), 'utf8');
      for (const p of referencedPaths(text)) {
        if (!existsSync(join(ROOT, p))) missing.push(`${doc} → ${p}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
