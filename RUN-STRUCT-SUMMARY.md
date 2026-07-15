# RUN-STRUCT — SUMMARY

`Date: 2026-07-15. Branch: claude/skylite-directives-runs-rihei2 (from main).
Instruction: SKYLITE-DIRECTIVES.md + plans/2026-07-15-RUN-STRUCT.md. First of
the three consolidated runs; RUN-SOCIAL / RUN-DISCOVER remain gated on merge.`

The tier model is dead. Skylite now runs on the two-switch model
(`localOnly` + `skin`), the sponsor/explorer/Saves vocabulary, the §3 rendering
principles with their named invariants, a multi-explorer sponsor dashboard,
backup/restore, a refresh that works, and a public-data label audit.

**Gate: full `npm test` green — lint · typecheck · 101 unit · build · 46 e2e.**
No new dependencies (the zero-runtime-dep, esbuild + Vitest + Playwright spine
is unchanged).

---

## What shipped, per phase

### S4 — two-switch model + rendering principles (foundation)
- **Lexicon v2** (`ing.croft.skylite.config`): one record **per explorer at a
  random `tid` rkey** (was fixed `self`). New fields: `localOnly` (default
  true), `skin`, `displayName`, `friends[]`, `showFriendsHearts` (default
  false), `approvedFeeds[]`, `telescope` (default false), `showReposts`
  (default true), `staleHours` (default 72). **No age/birthday/school/location,
  ever.** Follows are not in the record.
- **Defensive parse fills `CONFIG_DEFAULTS` for every missing field — the
  defaults ARE the v1→v2 migration** (a legacy `paused`+`channels`+`help`
  record parses into the canonical shape).
- **`capabilities()` derives what the device may do from `localOnly` only,
  never `skin`.**
- **Label floor is exclusion everywhere, now including quoted/embedded records**
  (`recordEmbedHidden`): a labeled quote never renders, its host post stays.
- **Navigation wall:** quotes render inline with an inert (`<span>`, non-link)
  author. **`showReposts`** wired through `fetchGarden`/`main` (reposts are
  label-floored). Per-explorer `staleHours` threaded through the gate.
- **Skin** is stamped as `data-skin` (observable; only "simple" styled — full
  is RUN-SOCIAL B4). Never gates a capability.

### S3 — vocabulary sweep
guardian/custodian→**sponsor**, child/kid→**explorer**, scrapbook→**Saves**
across files, identifiers, routes, copy, build tokens, DB name. DOM
`Child`/`childNodes` left untouched. Lexicon NSIDs unchanged, as required.
Provisioning param `g`→`s`; legacy `g` still accepted.

### S1 — landing + role funnel
`/` is the landing when the device is not set up: hero + one-switch explainer +
two doors + honesty copy, all **byte-verbatim** from §S1. Door A → `/sponsor`;
Door B pastes a link/code → binds → opens the garden. Provisioned devices skip
the landing. Footer carries the project docs; explorer chrome is hidden here
(product surface and project docs never share navigation).

### S2 — sponsor multi-explorer dashboard
One card per explorer (random rkey), create/edit/remove, persisted locally and
across reloads. Every switch editable per explorer; the exported record body
updates live. Per-explorer provisioning link (sponsorDid + rkey, no secrets)
with copy. Public-record hygiene inline (nickname guidance, rkey shown, "public"
notes). Required onboarding checklist (email 2FA · harden inbox · revocation
page). **App passwords removed entirely** (`atproto/write.ts` + its test
deleted, publish card gone, sponsor CSP locked to `'self'`).

### S5 — backup & restore
One versioned JSON (saves + notes, local follows, device settings). Export via
Web Share (file) or download; import restores on a fresh device. Injectable
storage ports make the assembly unit-testable without IndexedDB.

### S6 — refresh that works
Always-visible header control + hand-rolled pull-to-refresh (Pointer Events,
touch/pen only, page-top). Both re-poll config and re-fetch feeds. Offline shows
the offline banner, never a dead spinner. Reduced-motion respected.

### S7 — sponsor label-audit view
Per-explorer `audit.html?r=<rkey>`: (a) a meanings table of every label Skylite
acts on and what it does; (b) an effectiveness replay of the exact garden
fetch+filter over **public data** — posts hidden per label per account plus
label-excluded embeds, with expandable examples. Honest framing: nothing is
collected from the explorer's device.

---

## Named invariant tests (written before their code, per §0)

- `capabilities-key-on-localOnly-never-skin` — `tests/unit/capabilities.test.ts`
- `label-floor-excludes` — `tests/unit/labels.test.ts`
- `labeled-embed-never-renders` — unit logic (`labels.test.ts`) + hermetic DOM
  (`tests/e2e/embeds.spec.ts`)
- `navigation-wall-blocks-embed-browsing` — `tests/e2e/embeds.spec.ts`

Red→green order is visible in the commit sequence (S4 part 1 commit lands the
tests with their implementation; each later phase commits tests alongside code).

---

## New dependencies

**None.** No runtime deps (serverless static spine preserved); no new devDeps.

---

## Verify-in-run findings

- **getAuthorFeed reply/repost handling — resolved client-side.** Default filter
  `posts_no_replies`; reposts are merged in or dropped by `showReposts` and pass
  the same label floor. No server-side filter relied upon.
- **CSP connect-src for arbitrary PDS origins — unchanged tradeoff.** The
  explorer app (`index.html`) allows `public.api.bsky.app`, `plc.directory`,
  `bsky.social`, `*.host.bsky.network`. Config reads to a non-bsky-network
  sponsor PDS host are still not statically allowlistable; the local-config path
  covers that case. The sponsor dashboard makes no network calls (`connect-src
  'self'`). The audit page is `public.api.bsky.app` + CDN only.
- **Not exercised this run (hermetic CI, and gated to later runs):** granular
  multi-action OAuth scope syntax; labeler definition lexicon shape;
  unauthenticated searchPosts/searchActors + cursor; unauthenticated
  popular-feeds endpoint; getFeed-when-generator-offline; rate-limit posture;
  video/HLS playback. These remain open in the consolidated verify-in-run
  ledger for RUN-SOCIAL / RUN-DISCOVER.

---

## Deferred / honest edges (filed, not hidden)

- **OAuth publish to the sponsor's PDS is not implemented live.** App passwords
  are forbidden and were removed; a half-built, untested OAuth flow was **not**
  shipped in their place. The dashboard produces the exact record body + rkey +
  collection for out-of-band storage. Full atproto OAuth (PAR + PKCE + DPoP +
  token refresh + DPoP-bound `putRecord`) is the primary RUN-STRUCT follow-up
  and a verify-in-run item.
- **QR for the provisioning link — deferred.** The copyable link fully
  provisions a device; QR encoding (no external deps allowed) is a small
  follow-up.
- **Garden-change transparency notices** ("3 accounts were added") from §3 are
  **not built this run** — a noted gap for a follow-up; the config-diff hook is
  the place to add them.
- **Full skin** is RUN-SOCIAL B4; only the simple skin is styled (switch is
  plumbed via `data-skin`).
- **PIN-setting UI** was dropped from the (relocated) sponsor page; the D6
  background lock still works when a PIN exists (e2e seeds it) — the setting UI
  needs a new home on the explorer device.
- **friends[] / approvedFeeds[] / telescope / showFriendsHearts** are authored
  in the config and dashboard now; their *consumption* (likes, Telescope UI,
  friends' hearts) is RUN-SOCIAL / RUN-DISCOVER by design.
- **One-time local Saves reset:** the IndexedDB name changed
  `skylite-scrapbook`→`skylite-saves`. Pre-v1; S5 backup/restore mitigates.

## Open [confirm] items

1. **S1 landing copy** [confirm before publish — every line]: carried verbatim,
   laid out, never rewritten. **Pending owner confirmation before publish to
   main/live.**
2. **B1 account custody** — RUN-SOCIAL, not this run.
3. **showFriendsHearts default-false lurk view** — shipped as default false
   (sponsor-toggleable); confirmation noted.
