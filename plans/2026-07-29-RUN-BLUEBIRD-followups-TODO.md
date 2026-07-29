# Followup TODO: RUN-BLUEBIRD leftovers

**Status:** TODO / deferred (2026-07-29). Captured at the close of RUN-BLUEBIRD
(the Skylite → Bluebird rebrand, merged in #35). These are the items that run
left open — none block the rebrand, each is a discrete follow-up. Method, as
ever: TDD red-first, hermetic Playwright + unit fixtures, no network in the gate,
fresh branch per run, a `RUN-*-SUMMARY.md` at close.

## Items

1. **corduroy texture (fresh-tracks affordance).** There is no "new / unread"
   concept in the product today, so `corduroy` is only *reserved* (see
   `docs/VOICE.md`). When a fresh-item indicator is added, name it `corduroy` and
   render the subtle ribbed texture strip that fades once read; land a plain
   highlight first if the texture is not ready.

2. **Loading / stroke-draw animation.** `assets/brand/bluebird-mark.svg` is
   authored as a single continuous `<path>` specifically so it can drive a
   stroke-drawing loading animation (animate `stroke-dashoffset`). The animation
   itself is not built.

3. **Re-render the Skylite-era raster brand art.** The topbar header marks are the
   new bluebird glyph, but `icons/brand/landing-hero.jpg` and the
   `icons/splash/*.jpg` iOS launch images are still the old night-sky / butterfly
   renders. Regenerating them needs the `sharp` pipeline
   (`scripts/gen-brand-assets.mjs`), which is out of the zero-dep icon path. Pair
   with on-device visual QA of icon legibility at real home-screen sizes.

4. **guide/help merge question.** RUN-BLUEBIRD kept two instructional pages —
   `ski-school.html` (sponsor setup + About, from the old `guide.html`) and
   `help.html` (explorer "how it works") — because the audiences differ and a
   merge was non-trivial. Revisit whether they should truly consolidate.

5. **Trust tier vs search reach reconciliation.** `config.tier`
   (`green | blue | black`, a trust rating) now sits alongside the pre-existing
   `search.tier` (`off | discovery | open`, a reach control). They are distinct
   axes and documented as such in `docs/trail-map-search.md`; unifying or
   cross-wiring them (e.g. deriving one from the other) was a deliberate non-goal
   in the rebrand and would touch a fair amount of policy logic.

6. **Internal codename cleanup (cosmetic).** Some `src/` module directories
   (`src/telescope/`, `src/mysky/`, `src/saves/`) and `§Telescope` / "rung"
   comments keep their old internal names. They are invisible (minified out of
   `dist/`), so this is optional tidy-up, not correctness.

## Human checklist (not code — from the rebrand plan)

- Point DNS for `bluebird.croft.ing` and register/confirm the Bluesky handle on
  it (OAuth client metadata now claims this domain; login depends on it resolving).
- Trademark sanity check on "Bluebird" (known neighbours: Amex Bluebird, Blue Bird
  buses, the deprecated Bluebird.js promise library — why the repo is not bare
  `bluebird`).
- Final palette tuning by eye.
