# RUN-BLUEBIRD — SUMMARY

`Date: 2026-07-29. Branch: claude/skylite-bluebird-rebrand-ycg5wx. The one-time
rebrand from Skylite → Bluebird: name, lexicon NSIDs, domain, pages, palette,
brand assets, and voice. Done as a single run while the window was open — a
greenfield alpha with no user content, no records written against the old
lexicons, and no installed users, so renames (including lexicon NSIDs) were free.`

**Gate: full `npm test` green — lint · typecheck · unit · build · e2e.**
Counts: **unit 199 → 218** (+19: the 3 new unit specs below), **e2e 110 → 111**
(+1: the no-skylite dist gate). No new runtime dependencies. TDD: the four Phase-1
guards landed FAILING first, then the rename turned them green.

## Parameters (resolved from the repo, per rule 3)

- `NEW_REPO` = `CroftCommunity/bluebird` (from `git remote -v`) — already renamed. ✅
- `NEW_DOMAIN` = `bluebird.croft.ing`. ⚠️ **The `CNAME` still read `skylite.croft.ing`**
  at run start — the domain the plan expected the human to have already changed had
  not been changed. Per rule 3 ("if either still contains skylite, STOP and ask")
  the run paused and the human confirmed `bluebird.croft.ing`; the `CNAME` is now
  updated as part of Phase 9.

## What's frozen (untouched, by design)

`CONCEPT.md`, `IDEAS.md`, `PROVENANCE.md`, `seeds/`, and every existing
`RUN-*-SUMMARY.md` keep the Skylite name verbatim — the rebrand is an event in the
record, not a revision of it. Historical `plans/` were left as-is for the same
reason (they document past Skylite-era runs and never ship). The old brand source
renders were **relocated**, not edited, to `assets/brand/archive/source/`
(`assets/brand/archive/source/PROVENANCE.md` keeps its original text). The README's
"Historical seed" section and everything below it is verbatim, with one bridging
line added above it.

---

## Phase 1 — Red tests (red→green cited per phase)

Four guards, added failing first:

- `tests/e2e/no-skylite-dist.spec.ts` — walks `dist/` and fails on `skylite` (any
  case) in any shipped text file. **Red:** dist full of `skylite`. **Green:** after
  the rename, dist is clean (verified: `grep -ril skylite dist/` → none).
- `tests/unit/vocab-lint.test.ts` — bans bird verbs/behaviour nouns (`tweet`,
  `flock`, `nest`, `perch`, `migrate`, `birdwatch`) and the person-noun `groomer`
  (allowing the adjective `groomed`) over UI copy (`*.html` + `src/landing.ts`).
  Green from the start — current copy was already clean; it stands as the
  regression guard that kept the new mountain copy honest.
- `tests/unit/brand-name.test.ts` — manifest `name`/`short_name` === `Bluebird`.
  **Red:** was `Skylite`. **Green:** manifest updated.
- `tests/unit/lexicon-nsid.test.ts` — every lexicon `id` matches
  `^ing\.croft\.bluebird\.`, none match `skylite`, no filename retains the old
  authority. **Red:** four `ing.croft.skylite.*` files. **Green:** renamed.

## Phase 2 — Lexicons (the one-time-free rename)

- `lexicons/ing.croft.skylite.{config,follow,like,search}.json` →
  `ing.croft.bluebird.*` (filenames + `id` + every code reference; `SKYLITE_CONFIG_NSID`
  → `BLUEBIRD_CONFIG_NSID`, etc.).
- **Trust-tier field added while schemas were free:** a required enum
  `tier: green | blue | black` on the **config** main record and the **search**
  record, documented as "Trust distance from the tended garden … a trust rating,
  not a content-maturity rating." Wired through `BluebirdConfig` (`TrustTier`),
  `CONFIG_DEFAULTS.tier = 'green'` (safe default = inside the garden), `parseConfig`,
  `newExplorerConfig`, and the sealed search-record writer (`config.tier` threaded
  into `buildSealedSearchRecord`). No lexicon field carries a mountain term.

## Phase 3 — Pages & routing

`telescope.html`→`trailmap.html`, `saves.html`→`locker.html`,
`sponsor.html`→`patrol.html`, `mysky.html`→`my-mountain.html`; `guide.html`+`help.html`
did **not** merge (different audiences — non-trivial), so per the plan's fallback
`guide.html`→`ski-school.html` and `help.html` stays, linked from Ski School. All
internal links, nav labels (My Sky→My Mountain, Telescope→Trail Map, Saves→Locker,
Garden→Lodge, Sponsor setup→Patrol), page `<title>`s, `build.mjs` PAGES, the OAuth
redirect, and e2e paths were updated to match. Internal `src/` module directory
names (`src/telescope/`, `src/mysky/`, `src/saves/`, `src/sponsor.ts`) and
`data-*` selectors were kept as implementation names (invisible, minified) to
avoid churn/risk; only `src/guide.ts`→`src/ski-school.ts` was renamed.

## Phase 4–5 — Manifest, PWA identity & tokens

- Manifest: `name`/`short_name` = `Bluebird`, description "A gentle, read-first
  window into Bluesky.", `theme_color`/`background_color` = the snow token.
- Titles: bare "Bluebird" in-app; the lockup **"Bluebird for Bluesky"** only on
  the index title and the index meta description (outward-facing).
- `tokens.css`: mountain palette — `--sky` #3BA3E8, `--snow` #FAF6EF, `--evergreen`
  #123A2A, the three trail-marker tokens (`--trail-green/blue/black`), and `--patrol`
  safety orange **with the scope rule written at the token** (Patrol surfaces only).
  Existing semantic token names kept (components unchanged); `--cta` is now calm
  sky-blue (orange is reserved to `--patrol`). All contrast pairs pass
  `brand-tokens.test.ts`; system fonts kept (no webfont dependency).

## Phase 6 — Brand assets

- `assets/brand/bluebird-mark.svg` — one continuous slalom S-curve path, winged
  silhouette at the base, ambiguous bird/butterfly; single `<path>` so it can drive
  a stroke-draw animation later.
- App icon set regenerated by the zero-dep `tools/gen-icons.mjs` (rewritten): a
  white bluebird silhouette on a full-bleed green field (masks to the easiest-run
  green circle), sizes 512/192/180/32/16 + themed transparent topbar marks.
- Old Skylite brand renders relocated to `assets/brand/archive/source/` (not
  deleted); `brand-bundle.spec.ts` + `gen-brand-assets.mjs` repointed.

## Phase 7–8 — Copy & docs

- `docs/VOICE.md` written (patient-ski-instructor voice, banned vocab, role terms,
  Cabin Mode, corduroy, the two canonical sentences) and applied.
- Empty state → "No fresh snow yet. Check back tomorrow."; error → "Whiteout. Hang
  tight."; loading → "Warming up the lift…"; Trail Map / Locker / My Mountain notes
  and empty states reworded.
- Privacy switch → **Cabin Mode** in UI (label + hints in `sponsor.ts`, `landing.ts`,
  `saves/page.ts`); `localOnly` behaviour/storage naming unchanged. Never
  "backcountry".
- `docs/telescope-search.md` → `docs/trail-map-search.md` (Telescope→Trail Map,
  trust gradient→trail ratings, canonical trust-tier sentence added, technical
  content intact); `custody.md` terminology pass (sponsor stays sponsor); README
  live section rewritten with the bridging line; `git-verified-commits.md` had no
  old repo URL to change.

## Phase 9 — OAuth & URLs

`oauth/client-metadata.json` (client_id/uri/logo/redirect → `bluebird.croft.ing`,
redirect → `patrol.html`), `src/sponsor/oauth.ts` (`BLUEBIRD_CLIENT_ID`), `CNAME`,
and the workflows all on `bluebird.croft.ing`. Verified consistent; no
`skylite.croft.ing` remains in scope.

## Phase 10 — Gate & dist

Full `npm test` green. `dist/` eyeballed: no `skylite`, `name: "Bluebird"`,
`CNAME` = `bluebird.croft.ing`, oauth client_id on the new domain, service-worker
cache `bluebird-…`, new icons present. Two a11y contrast regressions from the new
palette were fixed (dark `--cta` darkened to #2A72AE for white ≥4.5; the fixed
build-footer given an opaque `--bg` so the attribution never sits over a coloured
button).

---

## Left open (follow-ups)

- **corduroy texture.** No "new/unread" affordance exists in the product today, so
  `corduroy` is reserved (VOICE.md) rather than retrofitted; the ribbed texture (and
  a plain-highlight fallback) is a follow-up when a fresh-item indicator is added.
- **Loading / stroke-draw animation.** `bluebird-mark.svg` is authored as a single
  path for this; the animation itself is not built.
- **guide/help merge debt.** Kept as two pages (Ski School + How it works) because
  the audiences differ; revisit if they should truly consolidate.
- **Header / hero / splash re-render.** The topbar marks now show the bluebird
  glyph, but `icons/brand/landing-hero.jpg` and the `icons/splash/*.jpg` launch
  images are still the Skylite-era renders (regenerating them needs the sharp
  pipeline, out of the zero-dep path). Visual-QA + re-render on the human checklist.
- **Trust tier vs search reach.** The new `config.tier` (green/blue/black, trust)
  sits alongside the pre-existing `search.tier` (off/discovery/open, reach). They
  are distinct axes and documented as such in `trail-map-search.md`; unifying them
  is a deliberate non-goal here (would touch a lot of policy logic).
- **Internal codenames.** `src/telescope/`, `src/mysky/`, `src/saves/` dirs and some
  `§Telescope`/"rung" comments keep the old internal names (invisible, minified);
  a cosmetic follow-up if desired.
- Human checklist (unchanged): Bluesky handle on the new domain, "Bluebird"
  trademark sanity check, icon legibility on a physical device, final palette tuning.

`PROVENANCE.md` was not modified.
