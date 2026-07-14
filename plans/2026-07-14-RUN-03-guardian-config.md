# RUN-03 — Guardian controls: config consumption + local authoring (Phase 2, part 1)

`Date: 2026-07-14. Branch: claude/skylite-v1-build-plan-heoxq4 (restarted from main
after PR #1 merged). Phase: 2 of the v1 build plan, split. Status: executed —
see RUN-03-SUMMARY.md.`

## Goal

Make the garden's inclusion list a **guardian-authored config record** instead of
a checked-in fixture, and wire the pause switch + offline/staleness gates. Deliver
the whole consumption + local-authoring path — everything that is hermetically
testable and deployable without OAuth.

## Scope covered (build plan Phase 2)

- The `ing.croft.skylite.config` record shape: **in-repo lexicon**
  (`lexicons/ing.croft.skylite.config.json`) + TS types. Versioned.
- Kid-device **provisioning** via a link carrying `guardianDid + rkey (+ pds)`;
  binding persisted; link cleared from the URL after ingest.
- **Config poll** over public `com.atproto.repo.getRecord` (unauthenticated),
  with DID→PDS resolution (did:plc via plc.directory, did:web via well-known).
- **Pause enforcement** (D2/D5) + **D5 staleness lock** (default N=72h) +
  offline "showing saved posts" banner. Pure state machine, unit-tested.
- **Channel toggles as groupings**: effective inclusion = union of enabled
  channels' accounts.
- **Guardian page** (`guardian.html`): local authoring of channels/accounts/pause,
  live-exported record JSON, import, "save to this device" (local-only fallback,
  D2), and provisioning-link generation.

## Decisions applied

- **D2** — config lives in the guardian's PDS as `ing.croft.skylite.config`
  (rkey `self`), read publicly by the kid device; local cache of last-good; and
  the **local-only fallback** (author + save on-device, export/import) for
  guardians without a Bluesky account. Taken at the plan default — the user
  directed "continue on with phase 2".
- **D5 staleness window N = 72h** (the plan's default; `DEFAULT_STALE_HOURS`).
- Reposts still dropped, labels still enforced (Phase 1 carries forward).

## Explicitly deferred to RUN-04 (needs a real guardian account to build safely)

- **Guardian OAuth direct-write.** Signing the guardian in and writing the record
  into their PDS from `guardian.html` (atproto OAuth public client: PAR + PKCE +
  DPoP + `putRecord`). This is the genuinely novel, un-verifiable-here piece the
  plan flags under D2. Until then, the guardian authors config locally and stores
  the exported JSON as their record by whatever means; the kid device reads it.

## CSP

`connect-src` extended to the grounded hosts: `public.api.bsky.app` (feeds),
`plc.directory` (DID resolution), `bsky.social` + `*.host.bsky.network`
(bsky-network PDS getRecord). Non-bsky PDS hosts aren't statically allowlistable
(plan §1 "others vary") — the local-only fallback covers those guardians.
`guardian.html` ships a tighter `connect-src 'self'` (it makes no network calls).

## Acceptance (build plan Phase 2)

- "Flipping pause in the guardian's PDS locks the kid's device on next poll" —
  demonstrated by hermetic e2e (paused record → pause lock). ✅
- "Toggling a channel changes the garden" — hermetic e2e (disabled channel's
  accounts absent). ✅
- Full `npm test` green: **58 unit + 20 hermetic e2e**. ✅

## Not done here

Service worker / offline SW cache / background lock — Phase 3. Care features —
Phase 4. OAuth write — RUN-04 (above).
