# RUN-01 — Scaffold and pipeline — SUMMARY

`Date: 2026-07-14. Branch: claude/skylite-v1-build-plan-heoxq4.
Instruction: plans/2026-07-14-RUN-01-scaffold.md. Phase 0 of the v1 build plan.`

## What shipped

A backendless static-PWA scaffold mirroring arecipe. The only rendered surface
is the app shell + a visible build version stamp; the garden (Phase 1) does not
exist yet.

### Toolchain

| Concern | Choice |
|---|---|
| Language | Strict TypeScript (`strict` + `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`) |
| Bundler | esbuild (`build.mjs`) → `dist/`, hashed entry for cache-busting |
| Lint | ESLint 9 flat config, type-checked rules on `src`/`tests` |
| Unit | Vitest (`tests/unit/`) |
| e2e | Playwright (`tests/e2e/`), drives the built `dist/` via a zero-dep static server (`tools/serve.mjs`) |
| Gate | `npm test` = lint · typecheck · unit · build · e2e (hermetic) |
| CI | `.github/workflows/ci.yml` runs the gate on every push + PR |
| Deploy | `.github/workflows/deploy.yml` builds and publishes `dist/` to Pages on `main` |

### Files added

- Config: `package.json`, `tsconfig.json`, `eslint.config.js`,
  `vitest.config.ts`, `playwright.config.ts`.
- Build/tools: `build.mjs`, `tools/serve.mjs`, `tools/gen-icons.mjs`.
- App shell: `index.html` (template with `%VERSION%` / `%MAIN_JS%` / `%STYLES%`
  injected at build), `styles.css`, `src/main.ts`, `src/version.ts`.
- PWA: `manifest.webmanifest`, `icons/` (192, 512, apple-touch 180 — generated
  PNG placeholders), `CNAME`, `.nojekyll`.
- Tests: `tests/unit/version.test.ts`, `tests/e2e/shell.spec.ts`.
- Docs: `plans/2026-07-14-RUN-01-scaffold.md`, this summary.

### Version stamp

`build.mjs` stamps `v1 <pkg.version>+<git short sha>` (e.g. `v1 0.1.0+142541e`)
via an esbuild `define`, injects it into `index.html`, and `src/main.ts` renders
it into `[data-version-stamp]`. The e2e gate asserts the real stamp reaches the
browser and the `%VERSION%` placeholder never does — the first wire of the
IDEAS.md §4 "guarantee she runs the build you shipped" requirement.

## Dependencies

**Runtime: none.** Vanilla TS compiles to a dependency-free ESM bundle; the only
allowed runtime origins are `public.api.bsky.app` and `cdn.bsky.app` (CSP).

**Dev-only** (with reasons): `typescript`, `esbuild` (build), `eslint` +
`typescript-eslint` + `@eslint/js` + `globals` (lint), `vitest` (unit),
`@playwright/test` (e2e), `@types/node` (typed tooling).

## Verification

Full gate run locally — all green:

- `lint` — clean.
- `typecheck` — clean.
- `unit` — 3 passed.
- `build` — `dist/` emitted, stamp + hashed entry injected.
- `e2e` — 3 passed (shell renders, real stamp present, manifest valid).

Rendered shell confirmed in a browser (night-sky palette, moon glyph, wordmark,
tagline, build stamp).

## Decisions & scope

- Applied **D8** (same-repo build). Idea-capture files untouched.
- D1–D7 and the D5 staleness window (N) are Phase 1–4 concerns and were **not**
  ruled on or exercised by this run.

## Not done here (by design)

- Service worker / offline / background lock — Phase 3.
- `getAuthorFeed` read path, post rendering, merge — Phase 1.
- Guardian config record + OAuth — Phase 2.
- Real icon artwork (current icons are generated placeholders).

## Manual follow-ups (outside the repo)

1. DNS record for `skylite.croft.ing` → GitHub Pages.
2. Enable Pages (source: GitHub Actions).
3. Enforce HTTPS after cert provisions.
