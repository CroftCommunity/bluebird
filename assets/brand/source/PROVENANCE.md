# Brand source renders — provenance

Owner-provided concept renders, 2026-07-15. Five images:

| File | What it is |
|---|---|
| `palette-light.png` | Light-mode "Bluesky Lite" UI color palette board (silver header). Decorative compose card is concept art only — Skylite has no compose surface. |
| `palette-dark.png` | Dark-mode palette board (night clouds). Same caveat. |
| `logo-light.png` | Day-sky window logo (monarch butterfly + contrail loop) with "Skylite" wordmark. Source for the app icon. |
| `logo-dark.png` | Night-sky window logo (butterfly-shaped star constellation). Source for the in-app dark header mark. |
| `splash-sunset.png` | Leaded-glass butterfly window over a mountain valley at sunset. Source for the PWA splash artwork and the landing hero (reserved). |

These are the **canonical source of the artwork**, not of the colors: the
authoritative color hexes live in the design-tokens stylesheet
(`tokens.css`), never read back from these images. The renders are several MB
total and are DERIVED into optimized assets by `scripts/gen-brand-assets.mjs`;
they must never ship in the built PWA payload (guarded by
`tests/e2e/brand-bundle.spec.ts`).
