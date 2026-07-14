# RUN-02 — The garden (read path) — SUMMARY

`Date: 2026-07-14. Branch: claude/skylite-v1-build-plan-heoxq4.
Instruction: plans/2026-07-14-RUN-02-garden.md. Phase 1 of the v1 build plan.`

## What shipped

The garden — a merged, newest-first, label-filtered read of a curated inclusion
list, rendered as a calm, no-counts feed. Still backendless, still zero runtime
dependencies, still no login.

### Read path

| Piece | File | Notes |
|---|---|---|
| AppView client | `src/atproto/client.ts` | `getAuthorFeed` over `public.api.bsky.app`, cursor pagination, `Retry-After`-aware exponential backoff on 429/5xx. Injectable fetch/sleep for tests. |
| Wire types | `src/atproto/types.ts` | Structural subset of the getAuthorFeed / embed / richtext lexicons. |
| Merge | `src/feed/merge.ts` | Newest-first, dedup by URI, **reposts dropped** (ceiling), spoofed-future-`createdAt` guard. Pure/deterministic. |
| Labels (D3) | `src/feed/labels.ts` | Hide on adult/graphic labels + `!hide`/`!takedown`/`!warn`; author labels count; negations ignored. No reveal. |
| Richtext | `src/feed/richtext.ts` | UTF-8 **byte-offset** facet segmentation (emoji-safe), link/mention/tag, overlap/out-of-range guards. |
| Inclusion list | `src/feed/inclusion.ts` | Checked-in **dev** fixture (3 real accounts). Replaced by guardian config in Phase 2. |
| Orchestration | `src/garden.ts` | Fetch all authors (`allSettled` — one failure ≠ blank garden), merge, label-filter, render; loading/ready/empty/error states. |

### Rendering (`src/render/`)

- `post.ts` — text via facets, images with **alt text**, video **posters** (no
  playback in v1 — HLS host isn't in the CSP), external cards (**domain + title
  only**, D7), minimal quoted records. **No like/repost/reply counts anywhere.**
- `interstitial.ts` — the D7 "this link leaves Skylite" gate (domain named,
  explicit Continue; `http(s)` only; injectable launcher for tests).
- `dom.ts` — safe builder; all network text via `textContent`, never innerHTML.
- `time.ts` — gentle relative time (buckets, not a live counter).

### UI

`index.html` became the garden (sticky night-sky topbar + feed + build stamp);
`styles.css` gained post cards, media, the interstitial, all on the CONCEPT.md §4
palette. High-contrast, large text, calm.

## Decisions

- Applied **D3** and **D7** at their plan defaults (the AskUserQuestion checkpoint
  aborted on a tool error; user said "continue"/"keep going"). Both low-risk,
  spelled out in the plan — flagged for veto in the run doc.
- Reposts dropped in merge to keep the inclusion ceiling tight (confirmed live:
  `actor=bsky.app` leads with a repost of an outside account).

## Dependencies

**Runtime: still none.** No new packages of any kind.

## Verification

Full `npm test` gate green:

- `lint` clean · `typecheck` clean.
- **unit: 30 passed** (merge, richtext, labels, client, version).
- `build` emits `dist/` with the stamp + hashed entry.
- **e2e (hermetic): 10 passed** — merged order, D3 hide + repost-drop, image alt,
  external card domain-only, D7 interstitial on both card and in-text link, error
  state, build stamp.

Also verified out of band:

- Garden rendered from mocked data in a real browser (screenshot): ordering,
  facet tag, gated link, external card, image alt.
- Live AppView reachable from the shell (200 + JSON) — the unauth-read grounding
  fact holds. The `@live` browser smoke (`npm run e2e:live`) is written but can't
  complete in this sandbox (headless-browser egress is restricted); it is
  local-only and never gates CI.

## Not done here (by design)

- Guardian config + OAuth + provisioning + pause/staleness — Phase 2.
- Service worker / offline / background lock — Phase 3.
- Care features — Phase 4.
