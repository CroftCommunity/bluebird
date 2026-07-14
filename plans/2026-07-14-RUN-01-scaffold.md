# RUN-01 — Scaffold and pipeline (Phase 0)

`Date: 2026-07-14. Branch: claude/skylite-v1-build-plan-heoxq4. Phase: 0 of the
v1 build plan. Status: executed — see RUN-01-SUMMARY.md.`

## Goal

Stand up the Skylite toolchain and delivery pipeline, mirroring the arecipe
template (backendless static PWA, vanilla strict TypeScript + esbuild, no
framework, page-per-destination, Vitest unit + Playwright e2e, hermetic
`npm test` gate, GitHub Pages deploy, CNAME). The product surface is out of
scope for this run — the only thing that renders is a version stamp.

## Scope (from build plan Phase 0)

- Strict TS + esbuild build producing `dist/`.
- ESLint (flat config, type-checked), Vitest, Playwright.
- Hermetic `npm test` gate: **lint · typecheck · unit · build · e2e**.
- GitHub Actions push CI running the gate; Pages deploy workflow (main only).
- `CNAME skylite.croft.ing`; `.nojekyll`.
- Web manifest (name **Skylite**, night-sky palette from CONCEPT.md §4).
- Placeholder icon set (real PNGs, generated, not fetched).
- Index page that renders a visible version stamp.

## Decisions applied

- **D8 (same-repo build)** — taken as the plan's default. Build lands alongside
  the concept docs. Idea-capture files (`README.md`, `CONCEPT.md`, `IDEAS.md`,
  `PROVENANCE.md`, `seeds/`) were **not touched** — house rule §4.
- The other `[confirm]` items (D1–D7, staleness N) govern Phases 1–4 and were
  **not** exercised here; none were ruled on by this run.

## House rules honored

- Hermetic tier only in CI; no `@live` in push CI; no credentials in-repo.
- No runtime dependencies added (zero — vanilla TS bundle). Dev-only tooling
  listed in RUN-01-SUMMARY.md with reasons.
- CSP written to the plan's allowlist: `public.api.bsky.app` (reads) +
  `cdn.bsky.app` (blobs). Third-party PDS hosts deferred to Phase 2.
- Idea-capture files read-only.

## Acceptance

- `npm test` green locally (all five stages). ✅
- CI green on push. *(verify on GitHub after push.)*
- Pages serves the version stamp at `skylite.croft.ing`. *(gated on the manual
  follow-ups below.)*

## Manual follow-ups (outside Claude Code)

1. Add the explicit DNS record for `skylite` → GitHub Pages (no-wildcard policy).
2. Enable GitHub Pages (source: GitHub Actions) on the repo.
3. Enforce HTTPS once the cert provisions.
4. Real (non-placeholder) icon artwork — the skylight → night-sky design.
