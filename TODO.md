# TODO — bluebird

> Known work only — items whose shape is already decided, and which may therefore be
> proposed as work. Anything still an open question (decide / verify / investigate /
> reconcile) belongs in the backlog of record, `discovery/alpha/ROADMAP_TODO.md`,
> however small or operational it is. Tracking scheme: `CroftC/.claude/TRACKING.md`;
> the two piles and why: its § "Two piles". Cross-reference E-numbers where an item
> here implements a backlog row.

Started 2026-08-29 with the first gap the workspace design standard recorded against
this repo; earlier deferrals live in `IDEAS.md` and the `RUN-*-SUMMARY.md` files.

## Design standard gaps (croft-pwa/docs/DESIGN.md)

- [x] ~~**Sign-in copy: the noun is "atmo provider", not Bluesky.**~~ Done 2026-08-29 (sheet + banner + Patrol; "Provider host (optional)"). `src/social/like-ui.ts`
  says *Your Bluesky handle* and `src/sponsor.ts` *Sign in with Bluesky* for a field that
  takes a handle on any host; `src/sponsor.ts` also says *PDS host (optional)*. Use the
  sheet's words and the verbatim gloss (DESIGN.md § Copy). Workspace audit check 45 FLAGs
  this until it changes.
- [x] ~~**Adopt the sign-in flow.**~~ Done 2026-08-29: `src/signin/{providers.json,providers.ts,sheet.ts}`, both surfaces open the one sheet, `tests/e2e/signin-sheet.spec.ts` + `tests/live/signin-providers.live.spec.ts`. Both surfaces (sponsor page, explorer banner) are
  handle-only with no provider registry and no Create. Adopt the pattern in DESIGN.md
  § Flows › Sign in — registry with probed posture + live drift check, two panels split by
  posture, Create only where signups are open, the handle seam; reference
  `croft-pwa/src/signin/`. The container is this repo's call (page or sheet); the copy,
  registry and both-direction Create rule are not. Check 45 NOTEs the missing registry.

## Parked on a device

- **PWA hardening for iOS — blocked on an iPhone** (parked 2026-10-27, closing draft #33
  unmerged). The plan and the work live on the branch `pwa-hardening-ios`, kept on origin:
  `plans/2026-07-23-1-plan-pwa-hardening-ios.md` there is the newest copy (2026-07-27, 1249
  lines; the 708-line copy on `fix-sponsor-a11y-contrast` is an older pass). Two parts:
  - *Phase 1a, landable without a device:* the generic crypto core pulled out of
    `src/crypto/vault.ts` (`wrapJson`/`unwrapJson`/`passphraseMaterial`/`prfEnroll`/`prfGet`),
    behavior-preserving for the audit vault, with `tests/unit/vault-core.test.ts` and a
    pre-refactor fixture. Land it fresh off main when a second consumer needs it.
  - *Phase 0, needs a real iPhone:* `probe.html` + `docs/PROBE-DEVICE-SCRIPT.md` (D1–D6:
    storage across a cold launch, WebAuthn PRF stability). Branch-only, never merges.
    `CroftC/.claude/TESTBED.md` registers no iOS device, so it waits for one.
