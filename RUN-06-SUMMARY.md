# RUN-06 — Guardian write to PDS — SUMMARY

`Date: 2026-07-14. Branch: claude/skylite-v1-build-plan-heoxq4 (restarted from main
after PR #4 merged). Instruction: plans/2026-07-14-RUN-06-guardian-write.md.
Phase 2 remainder of the v1 build plan.`

## What shipped

The guardian can now sign in on their own device and Skylite writes the config
record into their PDS — completing the loop with the kid device's public poll.
Backendless, zero runtime deps, and the child device still never authenticates.

### Write client — `src/atproto/write.ts`

`WriteClient` with:
- `createSession(identifier, password)` → session (did, handle, tokens, PDS host
  resolved from the `didDoc`).
- `putRecord(session, {collection, rkey, record})` → Bearer-authed write to the
  session's PDS.
- `publishConfig(identifier, password, config)` → sign in, stamp `$type` +
  `updatedAt`, write `ing.croft.skylite.config/self`.

Uses the legacy **app-password** session, not OAuth — see the run doc for the
rationale (verifiable end-to-end, guardian-only scope, no from-scratch OAuth
crypto). The password is used only to sign in and is **never stored**; the field
is cleared on success.

### Guardian page

A "Publish to your Bluesky account (optional)" card: handle/email + app-password,
"Sign in & publish". On success it fills the guardian DID + PDS host for the
device-link step and shows the record URI. Inline guidance recommends **App
Passwords** over the main password. `guardian.html` CSP `connect-src` now allows
`bsky.social` + `*.host.bsky.network`.

## Security

- **No credentials anywhere in the repo, tests, CI, or docs.** Unit tests mock
  `fetch`; hermetic e2e mocks the write endpoints.
- Password handling is transient and in-memory only.

## Verification

Full `npm test` gate green:
- `lint` clean · `typecheck` clean.
- **unit: 76 passed** (+5: session/put/publish shapes + error propagation).
- **e2e: 31 passed** (+1: guardian sign-in → publish, DID filled, password cleared).

**Real-network write** against the test account: to keep the password off all
tooling, the plan is an in-browser publish on the deployed guardian page (password
goes browser → bsky.social over HTTPS, never through the agent), then confirm the
record landed via the **public unauthenticated `getRecord`**. Pending that check.

## v1 status

With this run, the full v1 build plan is implemented: garden, guardian config
(consume + local author + PDS write), PWA hardening, and care features. OAuth
(vs app-password) for the guardian write is the one remaining optional hardening.
