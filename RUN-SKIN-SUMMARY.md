# RUN-SKIN — SUMMARY

`Date: 2026-07-15. Branch: claude/skylite-directives-runs-rihei2 (from main).
Brand/UI follow-up: the "full" skin (§B4) + the landing hero. No new product
capability. Source: the owner's bsky.app reference screenshots + the sunset
shadowbox render.`

The `full` skin now exists. Until now `skin` was wired end-to-end (config,
sponsor UI, `data-skin` on the root) but had **no** styling — `full` looked
identical to `simple`. This run gives it the look the owner's reference asks
for, and dresses the landing with the hero render.

**Gate: full `npm test` green — lint · typecheck · unit · build · 71 e2e.**

## The `full` skin (§B4)

A cosmetic `skin` value that echoes bsky.app's **flat, edge-to-edge,
hairline-divided reading feed**, in contrast to the calm floating cards of the
default `simple` skin. Reference: `assets/brand/reference/bsky-*.png`.

- Flat rows (no card shadow/radius) separated by a `--border` hairline;
  edge-to-edge gutters; display name / `@handle` / time on one inline row;
  calmer body size.
- **ALT badge** on images that carry alt text — a bsky-authentic, positive
  accessibility signal (a small dark pill, bottom-right). Rendered only when
  `alt` is present; shown only in the full skin.
- **Token-only** (no raw hex in `styles.css`, `brand-nohex` still green), so
  both themes and the contrast sweep carry over unchanged.

### Held the line (deliberately NOT copied from bsky)

The full skin borrows bsky's **layout**, not its product surface. It adds **no**
like/repost/reply counts, **no** compose box or FAB, **no** notifications/DMs,
and **no** bottom tab bar — all of which contradict Skylite's read-first,
no-counts, page-per-destination, kid-safe model. The palette stays Skylite's own
(sunset/butterfly/navy), not bsky's navy — so the identity is Skylite, the
ergonomics are familiar.

### Invariant preserved

`skin` remains **cosmetic only**: `capabilities()` keys on `localOnly`, never
`skin` (`capabilities-key-on-localOnly-never-skin`). `skin.spec.ts` proves it at
the surface — flipping to `full` under `localOnly` surfaces no like control and
adds no counts — alongside the existing unit invariant.

## Landing hero

The owner's `hero-shadowbox.png` (the sunset butterfly window mounted in a lit
wooden niche) is cropped to the framed window — the render's **baked wordmark is
excluded** so the crisp SVG wordmark below is never duplicated — and shipped as
an optimized `icons/brand/landing-hero.jpg` (~44 KB, from a 1.5 MB PNG). It
replaces the small header mark as the landing's hero art. Pipeline: a new
`hero()` step in `scripts/gen-brand-assets.mjs`; the derived JPEG is committed,
the multi-MB source never ships (`brand-bundle` guard holds).

## Assets

- `assets/brand/source/hero-shadowbox.png` — owner hero render (source, never shipped).
- `assets/brand/reference/bsky-discover.png`, `bsky-nav.png` — bsky.app design
  reference for the full skin. Reference only: no code reads them,
  `gen-brand-assets.mjs` does not consume them, `build.mjs` never copies
  `assets/`. Provenance recorded in `assets/brand/source/PROVENANCE.md`.

## Config-read hardening (carried in with friends' hearts, noted here)

`getCachedConfig` / `getLocalConfig` now normalize stored configs through
`parseConfig` on read, so gating and `capabilities()` never see a
half-populated legacy record.

## Follow-ups / not done

- **Time inline with the handle:** bsky places the timestamp immediately after
  the handle; Skylite keeps it right-aligned (its existing header structure).
  Cosmetic, reads fine; a full inline reflow is a later polish.
- **Deeper-navy dark surface:** bsky's dark is a deep navy; Skylite's dark stays
  charcoal to hold its own brand + the tested contrast pairs. A skin-scoped
  surface tint is possible later if desired, with a fresh contrast sweep.
- **Full-skin empty/notification states** styled to bsky's centered pattern —
  the garden/saves empties already center; a richer treatment is optional.
