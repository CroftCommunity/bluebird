# RUN-06 — Guardian write to PDS (Phase 2 remainder)

`Date: 2026-07-14. Branch: claude/skylite-v1-build-plan-heoxq4 (restarted from main
after PR #4 merged). Phase: 2 remainder. Status: built + hermetically verified;
real-network verification pending (see RUN-06-SUMMARY.md).`

## Goal

Close the last build-plan gap: let the guardian, on their own device, sign in and
have Skylite write the config record into their PDS — so the kid device's public
poll (RUN-03) has a real record to read.

## Decision: app-password session, not full OAuth (with rationale)

The plan named OAuth for this page. This run instead uses the legacy
identifier + **app-password** session (`com.atproto.server.createSession` →
`com.atproto.repo.putRecord`). Why:

- It is **verifiable end-to-end** with a real account, today. A from-scratch
  atproto OAuth public client (hosted client-metadata + PAR + PKCE + DPoP) is a
  large, crypto-sensitive surface with no in-scope reference (arecipe's wiring
  isn't in this repo), and its interactive consent can't be verified hermetically
  — high risk of shipping subtly-broken auth.
- It keeps the **guardian-only scope** the plan requires: only the guardian's own
  device ever authenticates; the child device still reads unauthenticated.
- The password is used **only** to create the session and is **never stored** —
  only the returned tokens live in memory for the page session, and the password
  field is cleared on success. App passwords (revocable, non-destructive) are
  recommended in the UI over the main password.

OAuth remains a reasonable future hardening (revocable, no password handling),
but it is not required for a working, safe v1 guardian write.

## Scope

- `src/atproto/write.ts` — `WriteClient`: `createSession`, `putRecord` (Bearer),
  `publishConfig` (sign in → stamp `$type` → put at
  `ing.croft.skylite.config/self`). PDS resolved from the session `didDoc`.
- Guardian page: a "Publish to your Bluesky account (optional)" card — identifier
  + app-password inputs, "Sign in & publish", which on success fills the guardian
  DID + PDS host for the device-link step and shows the record URI. App-password
  guidance inline.
- `guardian.html` CSP `connect-src` extended to `https://bsky.social` +
  `https://*.host.bsky.network`.

## House rules

- No new runtime dependencies (still zero).
- **No credentials in the repo, tests, CI, or run docs.** Hermetic e2e mocks the
  write endpoints; unit tests mock fetch.

## Acceptance

- Sign-in + publish flow works against mocked endpoints (hermetic e2e), fills the
  DID, clears the password. ✅
- Unit: session/put/publish request shapes + error propagation. ✅
- Full `npm test` green: **76 unit + 31 hermetic e2e**. ✅
- **Real-network write** against the test account — verified via the public
  `getRecord` read after an in-browser publish (keeps the password off all
  tooling). Pending — see summary.
