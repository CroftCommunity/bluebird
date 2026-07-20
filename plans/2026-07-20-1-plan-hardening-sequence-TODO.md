# Followup TODO: the 4-part hardening/feature plan sequence

**Status:** TODO / deferred (2026-07-20). Not yet planned in full. This is a
resumable stub — it records the agreed sequence and the Phase-0 discovery
findings gathered so far, so a later session picks up with grounding rather than
starting cold. Method agreed: **phase-plan each in order (three-pass), then
distill to a skylite-house run brief** (SKYLITE-DIRECTIVES / RUN-* style: TDD
red-first, hermetic Playwright + unit fixtures, no network in the gate, fresh
branch per run, RUN-SUMMARY.md, the named invariant tests).

## The sequence (in order)

1. **PWA hardening (iOS reliability)** — IDEAS.md §4 bundle.
2. **Graduation / identity endgame** — IDEAS.md §1: an explorer graduates into
   owning their own `did:plc` identity (handoff, offline backup rotation key).
3. **Safety features** — IDEAS.md §3: out-of-band "something's wrong" button +
   the plain "your stuff" view.
4. **Close RUN-TRUEUP leftovers** — care-panel copy confirm, remaining landing
   lines, the manual device pass (`e2e:live` OAuth + write cycle), rung-2 search
   out from behind its flag (the BunnyCDN-WAF finding), higher-res sunset render.

Do one at a time with an owner review gate between each plan (and ideally its
implementation) before starting the next.

## Phase-0 discovery findings for #1 (PWA hardening) — gathered 2026-07-20, verify before building

Read against the live repo; **several items are already partly or fully built**,
so the plan must true-up gaps, not rebuild:

- **(e) Lock-on-background — LIKELY ALREADY BUILT.** `src/lock/backgroundLock.ts`
  + `src/lock/pin.ts` exist. Verify coverage (visibilitychange/blur, re-gate on
  return, optional inactivity timeout) before scoping any work here.
- **(b) Guarantee-she-runs-the-build — LARGELY BUILT.** `src/pwa/register.ts`
  registers `/sw.js` with `updateViaCache:'none'`; `build.mjs` emits a service
  worker with a precache list + `skipWaiting()` + `clients.claim()`, and stamps
  a version (`__SKYLITE_VERSION__` = pkg version + git SHA). Gap to verify: is
  the version stamp *visibly surfaced* to the user, and is the update actually
  taking over promptly on iOS? Kill-switch/pause-flag liveness is the safety
  reason this matters.
- **(a) Login-vanishing — NEEDS DISCOVERY.** Auth is OAuth (`src/atproto/oauth/*`
  — client/dpop/pkce/jose/resolve; `src/sponsor/oauth.ts`; explorer
  `src/social/explorer-auth.ts`). Session/secret storage goes through
  `src/crypto/vault.ts`. MUST verify: where the OAuth session/tokens actually
  live (IndexedDB vs localStorage), what iOS eviction does to them, and whether
  re-auth-on-next-write-only (browsing untouched) is already the posture
  (`docs/custody.md`) or needs building.
- **(c) Offline-readable garden — NEEDS DISCOVERY.** SW precache exists in
  build.mjs; verify whether last-fetched posts + blob images are cached for
  offline read (`src/refresh/pull.ts`, `src/saves/*`). The fail-closed decision
  point in IDEAS.md §4 (show cached vs lock-until-reverify the pause flag +
  session) is an **owner call** — surface it, don't resolve.
- **(d) HEIC→JPEG photo upload — LIKELY N/A.** No upload/canvas/HEIC surface
  found in `src/` (grep empty). Skylite is read-first (explorer reads/saves/
  shares; no posting). Confirm there is no photo-upload path before planning
  this; if truly absent, **drop (d) or reclassify it** as a future write-feature
  item, not part of this hardening run.
- **Launch polish (IDEAS.md §4 "give it a real launch")** — verify
  `apple-touch-startup-image` splash set + maskable/`apple-touch` icons +
  status-bar style. manifest.webmanifest exists and already carries the
  "butterfly garden window" description.

## Grounding pointers

- Frozen instruction briefs (pre-execution): `discovery/alpha/seeds/skylite-unpacked/`
  (SKYLITE-DIRECTIVES.md et al.) — the source-of-truth for the runs already shipped.
- Shipped runs: `RUN-*-SUMMARY.md` at repo root (13, incl. TRUEUP).
- Open-item source: `IDEAS.md` §1–§6; `docs/custody.md` (auth/re-auth posture).

## Resume instructions

Start with #1. Re-invoke the `phase-plan` skill (Pass 1) with this stub as input;
run the Phase-0 discovery items above against the live code first, then draft
phases only for the verified gaps. Owner review gate before Pass 2/3 and before
implementation.
