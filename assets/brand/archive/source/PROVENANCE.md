# Brand source renders — provenance

Owner-provided concept renders, 2026-07-15. Images:

| File | What it is |
|---|---|
| `palette-light.png` | Light-mode "Bluesky Lite" UI color palette board (silver header). Decorative compose card is concept art only — Skylite has no compose surface. |
| `palette-dark.png` | Dark-mode palette board (night clouds). Same caveat. |
| `logo-light.png` | Day-sky window logo (monarch butterfly + contrail loop) with "Skylite" wordmark. Source for the app icon. |
| `logo-dark.png` | Night-sky window logo (butterfly-shaped star constellation). Source for the in-app dark header mark. |
| `splash-sunset.png` | Leaded-glass butterfly window over a mountain valley at sunset. Source for the PWA splash artwork. |
| `hero-shadowbox.png` | The sunset butterfly window mounted in a lit wooden shadowbox with the "Skylite" wordmark below. Owner-supplied 2026-07-15 as the landing **hero** artwork. (Its butterfly window is ~560px — comparable to `splash-sunset.png`, so it does NOT supersede the splash source; it is the composed hero, used whole.) |

These are the **canonical source of the artwork**, not of the colors: the
authoritative color hexes live in the design-tokens stylesheet
(`tokens.css`), never read back from these images. The renders are several MB
total and are DERIVED into optimized assets by `scripts/gen-brand-assets.mjs`;
they must never ship in the built PWA payload (guarded by
`tests/e2e/brand-bundle.spec.ts`).

## `../reference/` — design reference, never shipped and never derived

`reference/bsky-discover.png` and `reference/bsky-nav.png` are owner-supplied
screenshots of bsky.app's logged-out mobile web (the Discover feed and the side
nav), 2026-07-15. They are the visual reference for the **`full` skin** (a
cosmetic `skin` value that echoes bsky.app's card-based feed; it NEVER gates a
capability — see `capabilities-key-on-localOnly-never-skin`). They are reference
only: no code reads them, `gen-brand-assets.mjs` does not consume them, and
`build.mjs` never copies `assets/`, so they cannot enter the PWA payload.
