# RUN-BRAND — SUMMARY

`Date: 2026-07-15. Branch: run-brand (from main). Brand-integration run: no new
product features. Source: the five owner brand renders + the RUN-BRAND
instructions.`

Skylite is now Skylite-branded in light and dark, from a single semantic token
layer, with the day-window/butterfly/constellation identity across icons,
splash, header, and landing hero.

**Gate: full `npm test` green at every phase — lint · typecheck · 151 unit ·
build · 66 e2e.**

## Red→green evidence per phase

- **P0** bundle-hygiene e2e: proven red by planting a source render in `dist/`
  (2 failures), green once the sources live only under `assets/brand/source/`.
- **P1** `brand-tokens.test.ts` + `brand-nohex.test.ts`: both started red (no
  tokens.css; `styles.css` full of hex), green after tokens.css + the
  hex→alias migration.
- **P2** `theme.spec.ts`: written before `src/brand/theme.ts`.
- **P3** `brand-assets.spec.ts`: written before the pipeline/manifest wiring.
- **P4** `brand-contrast.spec.ts`: rendered-style sweep added with the restyle.

## New dependencies

- **`sharp`** — build-time image tooling, used ONLY by
  `scripts/gen-brand-assets.mjs`. It is **not** a committed dependency (not in
  `package.json`); install transiently to regenerate:
  `npm install --no-save sharp && node scripts/gen-brand-assets.mjs`. CI never
  installs or runs it; the derived assets are committed. Zero new runtime deps.

## Asset generation commands

```
npm install --no-save sharp
node scripts/gen-brand-assets.mjs
```
Crops (in the source renders): logo window `{left:475,top:100,width:450,
height:450}` (both logos); sunset butterfly window `{left:70,top:40,width:580,
height:420}`. Icons = window at 80% on a white field (maskable-safe). Splashes =
butterfly at 72% centered on white, JPEG q82.

## The CTA pair ruling (with ratios)

- **Forbidden:** white on Monarch Orange #FF8C00 = **2.33:1**.
- **Light CTA (final):** `--cta` #FF8C00 fill + `--cta-ink` Twilight Navy
  #1C335C = **5.37:1** (body AA). No fill darkening needed.
- **Dark CTA (final):** `--cta` Rich Monarch #D35400 + white = **4.17:1**, held
  to **large-text AA** (CTA buttons render ≥1.125rem / 700). The instruction's
  forbid rule targets the light #FF8C00 case; the dark pair clears large-text AA.
- Highlight (#FFDD00 / #F1C40F) always carries dark ink (navy / charcoal),
  never white.

## Hex adjustments made to pass AA (before → after)

- **`--ink-muted` (light):** named greys fail — Aero Grey #A1BAC5 = 2.03:1,
  Sky Silver #C0CCD6 = 1.63:1 on white → **#5A6B7A** (a darker navy-grey) =
  **5.50:1** on `--bg`, 5.12:1 on `--bg-raised`.
- **`--ink-muted` (dark):** the named dark greys (#3A3A3A, #1C1C1C) are
  dark-on-dark → use **Aero Grey #A1BAC5** = **7.93:1** on `--bg`, 7.07 on raised.
- **`--danger`** (one stray error color): #C0392B (5.44:1 light) / #FF9A9A
  (7.93:1 dark).
- No change to the primary named palette hexes; only the muted-grey + danger
  roles were assigned/derived.

## `--ink-muted` grey per theme + measured ratios

| Theme | `--ink-muted` | on `--bg` | on `--bg-raised` |
|---|---|---|---|
| light | #5A6B7A | 5.50:1 | 5.12:1 |
| dark  | #A1BAC5 | 7.93:1 | 7.07:1 |

Both clear body AA (4.5) on the surfaces they appear on.

## Splash `prefers-color-scheme` finding

**Investigated; a single light (sunset) variant serves both themes.**
`apple-touch-startup-image` `media` supports device-dimension queries reliably,
but `prefers-color-scheme` support is inconsistent and — critically — an
*unknown* media feature makes the whole query fail on older iOS, which would
leave those devices with **no splash at all**. To guarantee a splash on every
targeted device we ship one sunset-butterfly set keyed on size only. A dark
constellation variant can be added behind `prefers-color-scheme` once the
minimum-iOS floor rises; the wordmark is never baked into the splash, so no
device crop can cut it.

## Splash-resolution adequacy flag

⚠️ **The sunset source is low-resolution (721×599, ~101 KB).** The butterfly is
upscaled ~2.5× for the largest iPad splash (2048×2732) and will look soft there;
smaller iPhone splashes are fine. **Recommend the owner supply a
higher-resolution sunset original** for crisp large-tablet splashes. (Splashes
are JPEG q82: the 2048 splash is 165 KB, down from a 2.9 MB PNG.)

## Halted / noted items (stop rule)

- **Wordmark color:** the instruction says the wordmark is "in `--navy`," but
  `--navy` (dark) is invisible on the dark surface. Rendered with `--ink`
  (= Twilight Navy in light, Cloud White in dark) so it reads on both themes at
  full AA. Flagged as a deliberate, contrast-necessary deviation.
- **Wordmark glyphs:** SVG `<text>` in the platform bold sans with `textLength`
  locking width (crisp 24→200px, never clips). A fully outlined custom-glyph
  wordmark matching the boards' exact type is a follow-up.
- **Accent-colored labels** (section labels, tag/mention text) use `--accent`
  and are held to large-text AA (3:1); load-bearing body text and the CTA are
  swept at body/large AA respectively by `brand-contrast.spec.ts`.
- **Landing hero sunset:** the full uncropped sunset render is reserved for the
  landing hero (a later run) and was not consumed here.
- **Compose card** in the palette boards is decorative concept art; no compose
  surface was added (Skylite has none).
