# RUN-03 — Guardian controls (config consumption + local authoring) — SUMMARY

`Date: 2026-07-14. Branch: claude/skylite-v1-build-plan-heoxq4 (restarted from
main after PR #1 merged). Instruction: plans/2026-07-14-RUN-03-guardian-config.md.
Phase 2 (part 1) of the v1 build plan.`

## What shipped

The garden is now governed by a **guardian-authored config record** — pause
switch, channel-grouped inclusion list, D5 offline/staleness gates — plus a
**local guardian setup page**. Still backendless, still zero runtime deps, still
no login on the child's device.

### Config model

| Piece | File |
|---|---|
| Lexicon (in-repo, versioned) | `lexicons/ing.croft.skylite.config.json` |
| Types + constants | `src/config/types.ts` |
| Defensive parser (untrusted record → config, drops bad parts) | `src/config/parse.ts` |
| Effective inclusion (union of enabled channels, deduped) | `src/config/inclusion.ts` |
| **D5 state machine** (pause / offline-cached / stale-lock) | `src/config/state.ts` |
| Provisioning + persistence (binding, last-good cache, local config) | `src/config/binding.ts` |
| Provider (PDS poll → gate; fallback local → dev fixture) | `src/config/provider.ts` |

### Read transport

- `src/atproto/repo.ts` — `com.atproto.repo.getRecord` over the PDS host +
  DID→PDS resolution (did:plc via `plc.directory`, did:web via `.well-known`).
  Unauthenticated, read-only — same posture as the garden.

### Behaviour wired into the device (`src/main.ts`, `src/render/locks.ts`)

- **Pause** → calm "Paused for now" lock. Enforced on every successful poll *and*
  persisted from cache while offline (can't be outrun by dropping the network).
- **Offline, fresh cache** → garden from cache + "showing saved posts" banner
  (fails open — cached content already passed the ceiling).
- **Offline, stale cache (>72h) or never reached** → "Can't check in" lock
  (fails closed).
- **Channel toggles** change the effective inclusion list → change the garden.
- Unprovisioned visitor → dev fixture (keeps the public deploy demonstrable).

### Guardian page (`guardian.html`, `src/guardian.ts`)

Local authoring on the guardian's own device: edit channels/accounts, toggle
pause, **live-exported record JSON**, import an existing config, **save to this
device** (local-only mode, D2 fallback), and **generate a provisioning link**.
Ships with `connect-src 'self'` — it touches no network.

### Build

`build.mjs` now emits two pages (`index.html`, `guardian.html`) with two hashed
entries. CSP `connect-src` extended to `plc.directory`, `bsky.social`,
`*.host.bsky.network`.

## Deferred (RUN-04): guardian OAuth direct-write

Writing the record straight into the guardian's PDS over atproto OAuth (PAR +
PKCE + DPoP + `putRecord`) is carried forward — it is the novel D2 piece the plan
flags, and it can't be built safely or verified without a real guardian account.
Today the guardian authors locally and stores the exported JSON as their record;
the child device reads it.

## Dependencies

**Runtime: still none.** No new packages.

## Verification

Full `npm test` gate green:

- `lint` clean · `typecheck` clean.
- **unit: 58 passed** (+28 new: parse, inclusion, D5 state, binding, repo).
- `build` emits both pages + hashed entries.
- **e2e (hermetic): 20 passed** (+10 new): pause lock, channel toggle, provisioning
  bind + URL clean, stale-lock, offline-banner, guardian authoring/link/save.

Screenshots confirmed the guardian page and the pause lock in a browser.

## Acceptance (Phase 2)

- Pause in the record → device locks on next poll. ✅ (hermetic e2e)
- Toggle a channel → garden changes. ✅ (hermetic e2e)

## Not done here

Service worker / offline SW cache / background lock — Phase 3. Scrapbook +
"something's wrong" + "how Skylite works" — Phase 4. OAuth write — RUN-04.
