# PWA hardening (iOS reliability) — item #1 of the 4-part sequence

**Status:** Pass 3 complete (quality gates applied); all open questions
confirmed by the owner. Not yet executed. No BLOCKING owner decisions remain;
finding F is PHASE-GATED (Phase 1b), audit-label stability is ADVISORY. Input
stub: `plans/2026-07-20-1-plan-hardening-sequence-TODO.md`. The only remaining
execution blockers are the Phase 0 device gates (**D1** sessionStorage wipe,
**D5** PRF-in-installed-PWA) — the plan is otherwise execution-ready.

## Problem Statement

Skylite is a PWA that a child (explorer) uses daily on an iOS device, tended by
a sponsor. IDEAS.md §4 lists five iOS-reliability concerns; the 2026-07-20 stub
did a first-pass triage claiming several were already built. This plan verifies
those claims against the live code and scopes work for the *genuine* gaps only —
it is a true-up, not a rebuild.

The headline symptom IDEAS.md §4 names is **"design for the login vanishing"**:
on iOS, an installed PWA loses its OAuth session unexpectedly, so the child's
hearts/follows silently stop working. `docs/custody.md` claims this is handled
by "proactive refresh-on-open" keeping re-auth rare. Pass-1 discovery found the
two claims are in direct conflict (see Verified Assumptions): the sessions live
in `sessionStorage`, which iOS clears on PWA cold launch, so refresh-on-open has
nothing to refresh from after a restart. That is the real defect this plan
targets. The remaining §4 items are largely built; the plan records what was
verified and scopes only the small residual gaps.

Constraints (from the stub and repo conventions):
- Method: phase-plan (three-pass) → distil to a skylite-house run brief.
- TDD red-first; hermetic Playwright + unit fixtures; **no network in the gate**.
- Fresh branch per run; a `RUN-*-SUMMARY.md`; named invariant tests.
- Pre-1.0: no backwards-compat layers (per user's global CLAUDE.md).
- Owner review gate between plan passes and before implementation.

## Reasoning

**Why start here (of the four items):** #1's Phase-0 discovery was already
partly captured, and session-loss is the highest-severity reliability bug for a
daily-driver kids' device — it silently breaks the one interactive feature
(hearts/follows) the child has. Reading is never gated (verified below), so the
blast radius is bounded, but the feature simply not working erodes trust.

**Why the login-vanishing fix is a storage-location change, not new auth:** The
OAuth machinery (PKCE + PAR + DPoP + rotating refresh, `src/atproto/oauth/*`) is
built and unit-tested. `ensureFresh`/`refresh` already implement
refresh-on-open. The only reason it fails across launches is *where the session
is persisted*. So the fix is to move the explorer session (and the DPoP key +
refresh token it carries) from `sessionStorage` to a durable store, so
refresh-on-open can actually run on the next cold launch. This is a small,
localised change (`src/social/explorer-auth.ts`) — but it carries a **security
tradeoff** (a refresh token + DPoP key at rest, vs. the current wipe-on-close
window), which is an owner decision, not an implementation detail. Hence a
BLOCKING open question rather than a picked default.

**Why not just accept the lapse (posture 1):** `docs/custody.md` frames
sponsor-assisted re-auth as a *feature* (a deliberate checkpoint). That's a
coherent position — but if we keep it, the doc must stop claiming
refresh-on-open prevents lapses across launches, because it doesn't. Either we
make refresh-on-open true (persist the token) or we make the docs honest
(re-auth every cold launch is expected). Both are valid; the owner picks. This
plan defaults to *recommending* persistence, because "the child's hearts just
work day to day, and the sponsor is only pulled in when the refresh chain truly
breaks" is the posture custody.md already says it wants (§1, lines 50-59).

**Alternatives considered:**
- *IndexedDB vs localStorage for the durable session.* In a browser both are
  same-origin-JS-readable, so IndexedDB adds no real confidentiality over
  localStorage; it only adds async API + more code. Recommendation: localStorage
  (matches every other persistent Skylite key — binding, cache, PIN, vault),
  unless the owner wants the session encrypted at rest via the existing
  `src/crypto/vault.ts` wrapping (heavier; a possible follow-up, not this run).
- *Encrypt the refresh token at rest (wrap with a device secret).* Deferred —
  the vault is passphrase/passkey-gated and meant for the sponsor's audit key,
  not a child's per-open session. Wrapping the session would reintroduce an
  unlock step, defeating "just works." Note as a future option.
- *Do nothing to the sponsor session.* The sponsor session is also in
  sessionStorage, but the sponsor re-signs-in occasionally by nature (authoring
  sessions), so cold-launch loss is far less painful. Keep sponsor ephemeral;
  scope this run to the explorer. (Revisit only if the owner wants publish to
  survive sponsor app restarts.)

**Why launch-polish is a tiny phase, not skipped:** discovery found the splash /
status-bar / capable meta set is complete on `index.html` but the
`apple-mobile-web-app-capable` + `-title` (+ `-status-bar-style`) tags are
missing on `sponsor.html`, `audit.html`, and the new `guide.html`. Cheap to fix,
keeps the installed-PWA chrome consistent if a sponsor adds those pages to the
home screen. Low risk, no logic.

## Security model (added Pass 3)

This plan stores a **scoped OAuth refresh token + DPoP private key** encrypted at
rest on a **child's** device. The threat model, made explicit so the invariants
below are testable rather than implicit:

- **Asset & blast radius.** The persisted value grants create/delete on the
  explorer's like + follow + search collections **only** (`EXPLORER_SCOPE`,
  `explorer-auth.ts:23`) — never the account password, never full-account
  access. Reading the garden is never gated (`main.ts:40-115`). Worst-case
  compromise: an attacker hearts/follows as the child; they cannot read DMs,
  change credentials, or lock the child out.
- **At-rest threat (app closed) — DEFENDED.** Device theft / localStorage
  exfiltration while the PWA is not running. Mitigated by PRF-wrapped
  AES-256-GCM: nothing brute-forceable is stored (no passphrase-derived path for
  the explorer — see invariant 1). This is the threat the whole plan exists to
  close *without* reintroducing per-heart re-auth.
- **In-use threat (app open) — ACCEPTED, UNCHANGED.** The plaintext session
  lives in the sessionStorage cache while the app is open, exactly as today.
  Phase 1b does not change this exposure; it only adds an encrypted at-rest copy.
- **Live-unlocked-device threat — OUT OF SCOPE.** A thief holding an unlocked,
  app-open device has the same access any signed-in app grants. The 4-digit
  background-lock PIN (`src/lock/pin.ts`) is a separate, weaker gate and is
  explicitly **not** an encryption secret.

**Invariants (each maps to a test or on-device check below):**

1. **Biometric-or-nothing.** The explorer session is wrapped **only** via the
   WebAuthn-PRF path. The passphrase path (`passphraseMaterial`, `vault.ts:89`)
   is **never** invoked for the explorer session. No weakly-wrapped token is ever
   written. *(Phase 1b test: session vault never calls the passphrase path;
   fallback (b) writes no ciphertext.)*
2. **Domain-separated wrapping keys.** The Phase-1a `label` param must feed the
   HKDF `info` (e.g. `skylite-audit-vault-v1` vs `skylite-explorer-session-v1`),
   not only the WebAuthn `user.name`. Audit-material and session-material can then
   never derive the same AES key even if the raw PRF secret collided. *(Phase 1a
   test: ciphertext wrapped under one label fails GCM under the other.)*
3. **Fresh random IV per wrap.** The generic `wrapJson` must keep the current
   per-wrap `crypto.getRandomValues(new Uint8Array(12))` IV (`vault.ts:72`) —
   never a fixed or derived nonce. GCM nonce reuse under one key is catastrophic.
   *(Phase 1a invariant + test: two wraps of identical plaintext yield distinct
   IVs.)*
4. **No stale secret at rest.** On refresh-chain break or any unwrap failure
   (hmac-secret trap, deleted passkey, iCloud Keychain disabled), the at-rest
   `.enc` ciphertext is **cleared**, not left dangling. `clearExplorerSession`
   clears **both** layers. *(Phase 1b test: unwrap failure → NoPersistence +
   both keys removed.)*
5. **Refactor cannot regress the sponsor's audit key.** The hermetic audit suite
   is necessary but not sufficient (it exercises only the passphrase path and
   round-trips within one run). Phase 1a adds a committed fixture — an audit
   `wrapped` blob + material produced by the **pre-refactor** code — that the
   refactored `unwrapJson` must still decrypt, plus an on-device real-PRF unlock
   of a sponsor audit vault (Security finding E; Phase 1a Done-when).

## Verified Assumptions

Confirmed firsthand by reading the live code (file:line evidence):

- **Explorer OAuth session is ephemeral.** `src/social/explorer-auth.ts:32-38`
  `ss()` returns `sessionStorage`; the session (incl. `refreshToken` and the
  `dpopKey`, per `OAuthSession` in `src/atproto/oauth/client.ts:45-58`) is
  stored at `skylite.explorer.oauth.session` (`:26`, `:53-55`). Nothing durable.
- **Sponsor OAuth session is also ephemeral.** `src/sponsor/oauth.ts:33-39`
  same `sessionStorage` pattern (`skylite.oauth.session`).
- **Refresh-on-open is implemented but depends on that session surviving.**
  `refreshExplorerSessionOnOpen` (`explorer-auth.ts:62-73`) reads the stored
  session and calls `ensureFresh`; on any failure it clears and returns null.
  `main.ts:161` calls it on every open. So the mechanism is real — it just has
  nothing to act on after sessionStorage is cleared.
- **Reading is never gated by session.** `main.ts:40-115` renders the garden
  from cached/polled config regardless of session; likes/follows are additive
  UI (`caps.canPersistLikes`), and a missing session only prepends a sign-in
  banner (`main.ts:110-112`). Confirms the degrade posture in custody.md.
- **Lock-on-background is built.** `src/lock/backgroundLock.ts:72-77` listens on
  `visibilitychange` (locks when `document.hidden`) and `pagehide`; `blur` is
  intentionally excluded (`:6-9`). PIN is a SHA-256 hash in localStorage
  (`src/lock/pin.ts:5-...`). Installed in `main.ts:131`. No inactivity-timeout
  lock (IDEAS.md floated it as optional).
- **"Runs the build you shipped" is built.** `src/pwa/register.ts:11` registers
  `sw.js` with `updateViaCache:'none'`; `build.mjs` emits a SW with a precache
  list + `skipWaiting()` + `clients.claim()` and stamps a version
  (`__SKYLITE_VERSION__`). The version is surfaced visibly in every page footer
  (`[data-version-stamp]`, set in `main.ts:127-128` and each page boot). Gap:
  no "an update is ready — reload" nudge, so a long-open tab keeps old JS until
  the next navigation/cold open.
- **Offline-readable garden is built.** `build.mjs` SW: navigations network-first
  with cached-shell fallback; `/xrpc/` network-first with cache fallback;
  `cdn.bsky.app` images cache-first. Config is cached in localStorage
  (`src/config/binding.ts` `getCachedConfig/setCachedConfig`) and
  `resolveGarden` (`src/config/provider.ts:77-100`) serves the cache when the
  poll is `unreachable`, gated by a staleness window (default 72h,
  `state.ts` `DEFAULT_STALE_HOURS`). So the app fails **open** (shows the cached
  garden) until the stale window, then `stale-locked`. This is the IDEAS.md §4
  fail-open-vs-fail-closed decision point — currently effectively decided as
  fail-open-until-72h. Surfacing it for owner confirmation (advisory).
- **HEIC→JPEG upload is N/A.** No upload/canvas/HEIC surface in `src/`
  (read-first app; explorer reads/saves/shares, never posts). Drop item (d).
- **Launch polish is mostly built, with a per-page gap.** `manifest.webmanifest`
  is standalone/portrait, `background_color`/`theme_color` `#FFFFFF`, maskable
  icons 192/512. `index.html` has the full `apple-touch-startup-image` set +
  `apple-mobile-web-app-capable/-title/-status-bar-style`. Missing
  `apple-mobile-web-app-capable`+`-title` on `sponsor.html`, `audit.html`,
  `guide.html`; `-status-bar-style` present only on `index.html`.

- **The at-rest wrapping primitive already exists and is proven in-repo.**
  `src/crypto/vault.ts` wraps the sponsor's audit private key with two methods:
  `webauthn-prf` (platform authenticator derives a stable secret via the PRF
  extension; wraps the key) and `passphrase` (PBKDF2, 600k iters); payload is
  AES-256-GCM (`:26`, `:41-45`, `ensureAuditVault` used from `sponsor.ts`). The
  explorer session wrapping reuses this pattern rather than adding new crypto.
- **PRF-on-iOS expectations (desk research 2026-07-24, confirm on device in
  Phase 0):** Safari 18.4+ / iOS 18.4+ supports the WebAuthn PRF extension for
  **iCloud Keychain platform passkeys** (Face ID / Touch ID) — the target path.
  Hard dependencies: iCloud Keychain enabled + an enrolled local passkey on
  device B. External security keys do NOT do PRF on iOS (irrelevant — we use the
  built-in authenticator). Known trap: a reported case where `prf.enabled` is
  `true` but no `hmac-secret` is actually used, so the derived secret is not
  real — must verify the secret is stable/usable, not just trust the flag.
  **Trap resolved (armchair 2026-07-24):** the referenced Apple forum thread
  (782466) resolves with "the WebAuthn spec is being fixed to make it clear that
  `hmac-secret` is in fact not required" — i.e. `enabled: true` without a visible
  `hmac-secret` is now spec-**conformant**, not a bug. So `prf.enabled` is not
  merely insufficient, it is semantically meaningless as a has-a-secret signal.
  The only trustworthy check is reading `prf.results.first` and throwing when
  absent — which `vault.ts:127-128` already does. Determinism is documented for
  same-session same-salt (Yubico); byte-for-byte stability **across a cold
  launch** is NOT guaranteed by any source, which is why D5's success criterion
  must be the wrap→relaunch→unwrap round-trip, not a single `get()`.
  Standalone-PWA PRF is under-documented → device-verify (no primary or secondary
  source addresses `display-mode: standalone` for `navigator.credentials`; that
  absence is itself the finding, and it keeps the device gate non-optional).
  Practical floor: iOS 18.4 (Corbado: PRF data-loss bugs in 18.0–18.3, fixed
  18.4+). Sources in the Review Log.

**Pass 2 gap-analysis findings (verified against code 2026-07-24):**
- **`vault.ts` is NOT directly reusable — it is specialized to the audit
  keypair.** `wrapPrivateKey`/`unwrapPrivateKey`/`aesFromMaterial`/`prfEnroll`/
  `prfGet`/`passphraseMaterial` are all **private** (`vault.ts:57-153`); the only
  exports are `createVault`/`unlockVault`/`saveVault`/`loadVault`/
  `webauthnAvailable`/`Vault`/`VaultMethod`. `createVault` internally
  `generateAuditKeypair()`s and wraps *that private JWK* — there is no "wrap
  arbitrary bytes/JSON" entry point. **Reuse therefore requires refactoring
  vault.ts to export a generic crypto core** (Phase 1a), with the sponsor audit
  feature rebuilt on top and its tests (`audit-key.test.ts`,
  `sponsor-archive.spec.ts`, `audit-passkey.spec.ts`) kept green as the
  regression guard. `prfGet` also throws "use a passphrase instead" on
  no-PRF — the explorer layer must map that to fallback (b), not surface a
  passphrase prompt (`vault.ts:128`).
- **WebAuthn needs a user gesture.** `navigator.credentials.get/create`
  (`vault.ts:117`,`:135`) require transient activation on iOS. So the
  once-per-cold-launch unlock **cannot be auto-triggered** on page load — it must
  sit behind a tap ("tap to bring back your hearts"). Enrollment likewise runs on
  a tap after sign-in. Corrects Pass-1 Phase-1b wording ("trigger on first open").
- **The session is read on THREE entry points, synchronously.** `main.ts:161`
  (async, via `refreshExplorerSessionOnOpen`), but `telescope/page.ts:296` and
  `mysky/page.ts:82` do `getExplorerSession()` **synchronously at boot with no
  refresh/unlock**. So the unlock/restore must be a **shared helper invoked by
  all three** — else a cold-launch landing on mysky/telescope misses the
  encrypted session. `getExplorerSession()` stays sync (reads the sessionStorage
  cache); a new async `unlock` populates that cache once per launch.
- **Hermetic testability needs a seam.** Real PRF cannot run in the Playwright
  gate. Design requirement: the explorer-session vault exposes an **injectable
  unwrap** (dependency injection / test hook) so the e2e wiring test simulates
  "unlock succeeded → cache repopulated" without WebAuthn; the crypto core gets
  unit round-trip tests with injected raw key material. Keeps the no-network
  hermetic gate intact.
- **StoredDpopKey is serializable** (`dpop.ts:26-27,42-43`: `privateJwk:
  JsonWebKey` via `exportKey('jwk')`), so the whole `OAuthSession` (incl.
  `dpopKey`) already round-trips JSON to storage today — encrypting it at rest is
  a straight wrap of the existing serialized blob. No non-extractable-key blocker.

**Pass 3 spot-check (re-verified against code 2026-07-24):**
- **The three-entry-point premise holds.** `main.ts:161` reads via
  `refreshExplorerSessionOnOpen` (async); `mysky/page.ts:82` and
  `telescope/page.ts:296` both call `getExplorerSession()` **synchronously at
  boot**. Additionally, both mysky (`:64`) and telescope (`:41,:156`) call
  `persistExplorerSession(s)` on in-page refresh — so the encrypt-on-write path
  (Phase 1b) is exercised from all three entry points, not just sign-in. The
  shared unlock helper (1c) and the shared session-vault module (1b) must
  therefore serve all three.
- **`src/log.ts` is the diagnostic surface and is currently unused in the
  crypto/auth path.** Its API is `log.debug/info/warn/error`; `debug`/`info` are
  gated behind `?debug=1` or `localStorage['skylite-debug']==='1'`, while
  `warn`/`error` **always emit** (`log.ts:19-32`). The header explicitly names
  crypto and OAuth as boundaries that "should log through this so a failure is
  diagnosable from the console alone," and records the gotcha that **`?debug=1`
  does not survive an OAuth redirect — the `skylite-debug` localStorage flag is
  the durable switch around auth.** `grep` confirms neither `vault.ts` nor
  `explorer-auth.ts` nor `src/atproto/oauth/*` import `log` today; the only
  consumer is `src/pwa/register.ts`. So the fallback-(b) and hmac-secret-trap
  diagnosability the owner requires is **net-new work** this plan must schedule.
- **`explorer-auth.ts` uses empty `catch {}` swallows** (`:35-37`, `:44-46`,
  `:69-72`) — `getExplorerSession` and `refreshExplorerSessionOnOpen` silently
  return null on any error. The new crypto paths must **not** copy this pattern
  (house rule: fail loud); crypto failures log through `log.warn`/`log.error`.
- **`WRAP_INFO` is a single hardcoded constant** (`vault.ts:25`,
  `'skylite-audit-vault-v1'`), fed as the HKDF `info` with an **empty salt**
  (`:62`); the wrapping key is derived deterministically from material. Each wrap
  draws a fresh random 12-byte IV (`:72`). See Security model for the
  domain-separation and IV invariants Phase 1a must preserve.
- **The existing hermetic vault tests exercise only the passphrase path.**
  `tests/unit/vault.test.ts` states "The WebAuthn-PRF path needs a real/virtual
  authenticator (verify-in-run), so it isn't exercised here." So the audit
  regression guard is blind to the real-PRF derivation — see Security finding E
  and the Phase 1a fixture requirement.

**Unverified — needs a real iOS device (Phase 0 / the deferred manual pass):**
- iOS clears `sessionStorage` on installed-PWA cold launch (strongly expected,
  the basis for the whole Phase 1, but a device-behavior claim — not asserted).
  *Armchair 2026-07-24: consistent with the platform definition — session storage
  lives only for the lifetime of the top-level browsing context and a true cold
  launch constructs a fresh one — but no developer report nails this exact surface
  (standalone PWA, swipe-kill relaunch, sessionStorage specifically); the threads
  at that surface are about localStorage/OAuth-popups. Mechanism corroborated,
  direct report absent → stays a device probe (D1).*
- iOS retention/eviction of `localStorage` across launches and the ITP ~7-day
  no-interaction eviction window (affects whether the *persistent* session also
  eventually vanishes, i.e., whether the graceful degrade still needs to be the
  backstop even after the fix). *Armchair 2026-07-24 — LARGELY SETTLED in the
  plan's favor: WebKit's own Tracking Prevention doc states "the first-party
  domain of home screen web applications is exempt from ITP's 7-day cap on all
  script-writeable storage" (the removal algorithm skips that domain). Skylite
  installed to the home screen is exactly that case, so the 7-day-no-interaction
  eviction that motivates D2 does NOT apply to our origin → persisted localStorage
  is durable-by-default; degrade-to-sponsor-reauth is a RARE backstop, not a
  first-class path (shapes custody.md toward "your hearts stay"). Asterisk: the
  exemption is specifically the interaction-based cap; it is NOT a promise against
  eviction under storage-quota pressure or after long device power-off (scattered
  unverified reports, e.g. Apple Dev Forums 710157), so keep the graceful-degrade
  backstop wired even though it should fire rarely.*
- SW `skipWaiting`+`clients.claim` actually takes over promptly on iOS Safari's
  PWA container (update liveness for safety patches).
- Splash/status-bar render correctly when installed to the home screen.

## Documentation Impact

- `docs/custody.md` — the "Current implementation status" and "how we shrink it"
  sections claim refresh-on-open keeps re-auth rare; this is false while the
  session is ephemeral. Updated by **Phase 1c** (the phase that makes the
  behavior real): state that the explorer session is now persisted **encrypted
  at rest** (WebAuthn PRF, wrapped to the device's platform authenticator),
  decrypted with one tap+Face ID per cold launch; clarify this is local
  on-device encryption, distinct from the aspirational posture-(3)
  passkey-account-reauth (which stays blocked on passkey-on-PDS upstream).
  *Wording note (armchair D2, 2026-07-24): WebKit's home-screen exemption from the
  7-day cap means the persisted session is durable-by-default, so lean toward
  "your hearts stay" rather than "you may need to sign back in weekly." Keep the
  degrade path described as a rare backstop (quota pressure / long power-off), not
  a routine weekly re-auth.*
- `IDEAS.md` §4 — annotate items (a)–(e) with built/gap status. Light touch;
  all annotation happens in **Phase 4** (run wrap-up), per the owner decision
  that IDEAS.md is idea-capture, not a living spec, and the real built/gap status
  lives in the RUN summary. *(Pass 3 reconciliation: Pass 1 wrote "Phase 1 for
  (a)"; the actual edit is scheduled in Phase 4's change list, so this section is
  corrected to Phase 4 to remove the contradiction. IDEAS.md never becomes
  "wrong" mid-run — it is capture, not a spec that goes stale when the fix
  ships.)*
- `RUN-*-SUMMARY.md` — a new `RUN-*-SUMMARY.md` for this hardening run
  (house convention), written at the end of execution (**Phase 4**), not during
  planning. This is a *creation* artifact, not a doc that goes stale mid-run.
- `plans/2026-07-20-1-plan-hardening-sequence-TODO.md` — **all** edits to the
  stub happen in **Phase 4** (mark item #1 done, point at this plan, note #2–#4
  remain). *(Pass 3 reconciliation: Pass 1 assigned the "Phase-0 discovery done"
  mark to Phase 0, but Phase 0 runs under the Discovery Exemption and records its
  findings in **this** plan doc, not the stub — its write-set is honestly empty.
  Folding the stub mark into Phase 4 keeps Phase 0's write-set = none truthful.)*
- `docs/telescope-search.md` — referenced by `vault.ts`'s header comment as the
  source for the two protection methods. Grepped: the Phase-1a refactor is
  behavior-preserving for the audit vault (both methods stay), so this reference
  does **not** go stale — no edit scheduled. Recorded here so the reference is
  accounted for, not silently assumed safe.
- Grepped for references to `explorer.oauth.session` / `sessionStorage` outside
  the two auth files: only `src/social/explorer-auth.ts` and `src/sponsor/oauth.ts`
  define them; `main.ts` consumes via the exported functions (no direct key use).
  No test asserts the storage *backend* directly (oauth.spec.ts drives the flow
  through the UI). So the change surface is contained.

## Concurrency Map

Sequential spine: Phase 0-prep (1a refactor + probe harness) → Phase 0 (device
session) → 1b → 1c → Phase 2 → Phase 3 → Phase 4.
All phases sequential. Reason (reordered 2026-07-24, owner-confirmed): the Phase
1a refactor is device-independent and behavior-preserving for the shipping audit
vault, so it runs in **Phase 0-prep** to give the device probe a real crypto core;
the device session (Phase 0) then needs that harness; **D5 gates Phase 1b** (not
1a); 1b depends on 1a's core; 1c depends on 1b's storage; Phase 4 (run summary)
closes out the code phases. *(The Pass-2/Pass-3 text below that says "Phase 0 gates
Phase 1a" predates this reorder — 1a moved earlier; D5's gate moved to 1b.)* Phase 2 (static apple-meta,
write-set = HTML `<head>` only) is genuinely disjoint from the 1a/1b/1c chain
(write-sets under `src/crypto`, `src/social`, `src/main.ts`, page bootstraps) and
could run in parallel — but wall-clock saving is nil and one-change-in-flight is
simpler, so it stays sequential by choice, not necessity. No hidden shared state
(no git/process/port mutation in any phase).

**Pass 3 re-check (2026-07-24):** the map still holds after Pass-3 additions. New
write-set entries are all committed test assets
(`tests/unit/vault-core.test.ts`, `tests/fixtures/audit-vault-pre-refactor.json`,
`tests/unit/explorer-session-vault.test.ts`,
`tests/e2e/session-persistence.spec.ts`) — no new runtime module, no new shared
mutable state. The retained in-memory wrapping key (finding F) is per-JS-runtime
process state, not cross-phase shared state, and each phase is sequential, so it
introduces no concurrency hazard. WebAuthn touches the platform authenticator
(ambient), but sequentially and only within a single phase at a time. No parallel
set is added; no re-entry verification is required. Every phase remains
files-plus-authenticator only — no git/process/port/daemon mutation.

## Phases

### Phase 0-prep: Readiness build (device-independent) — do BEFORE the device session

**Goal:** Make the single iOS device session decisive. Phase 0's D5 criterion is a
wrap→relaunch→unwrap **round-trip**, which cannot be answered by observation alone
(Phase 0's write-set is "none") — it needs real crypto code on the device. This
prep track builds that harness on the production crypto core so the device session
is a clean go/no-go and its D5 output drops straight into the Phase 1a fixture.

**Why this runs before Phase 0 (the reorder):** the Phase 1a refactor is
*behavior-preserving for the audit vault, which already ships PRF in production*,
so it carries no device risk and can be built now. Doing it first lets the probe
exercise the real `prfEnroll`/`prfGet`/`wrapJson`/`unwrapJson` rather than
throwaway crypto — so the probe blob is a valid Phase 1a fixture, not a discard.
D5 still gates **Phase 1b** (building explorer persistence on the core), not this
refactor. *(Owner-confirmed reorder, 2026-07-24.)*

**Track A — build (device-independent):**
- [x] **A1. Execute Phase 1a** (the crypto-core refactor; full spec in the Phase 1a
  section below). Gate: the existing audit tests stay GREEN; the pre-refactor
  unwrap fixture is committed. This is the foundation the probe is built on.
- [x] **A2. Probe harness** — new throwaway `probe.html` + `src/probe/page.ts`
  (added to `build.mjs` PAGES), built on the A1 core, every action behind a button
  (transient-activation requirement, `vault.ts:117`,`:135`). Panels:
  - **D1:** at boot, read + render `sessionStorage['probe']` and
    `localStorage['probe']`; a button (re)writes both with a counter+timestamp. On
    cold relaunch you see at a glance which store survived.
  - **D5 enroll:** `prfEnroll(fixedSalt, 'skylite-explorer-session-v1')`; store the
    credentialId in localStorage; confirm Face ID / Touch ID is invoked.
  - **D5 stability + trap:** `prfGet` ×2 with the same salt; render both secrets as
    hex + a byte-equal verdict; **dump `getClientExtensionResults().prf`** so
    `enabled` vs a present-and-32-byte `results.first` is visible (the resolved
    trap — `enabled` alone is meaningless).
  - **D5 wrap:** derive key, `wrapJson(material, {hello:'world', n})`, write the
    ciphertext to `localStorage['probe.wrapped']`, render it.
  - **D5 unlock/round-trip:** tap → `prfGet` again → `unwrapJson` the stored blob →
    render recovered plaintext + a round-trip verdict.
  - Route everything through `src/log.ts` (so the hmac-secret-trap `log.warn`
    surfaces in the console). This page lives only on the probe branch and **never
    merges** — harness code is throwaway; the blob it emits is not.
- [x] **A3. Fixture-capture button** — the probe emits
  `{ wrapped:{iv,ct}, materialHex, salt, hkdfInfo }` as copyable JSON, so the
  on-device D5 result drops straight into `tests/fixtures/` as the Phase 1a
  keep-as-fixture seed (see Phase 1a's fixture note).
- [ ] **A4. Deploy rehearsal** — open a PR from the probe branch → preview builds at
  `https://skylite.croft.ing/pr-preview/pr-<N>/` → confirm on **desktop Safari
  first** that the page loads, D1 stamps render, and PRF enroll works in a tab.
  This establishes the tab baseline so the device session isolates the one genuine
  unknown (standalone vs tab). *(Pending the push/PR — outward-facing, awaiting
  go-ahead. Hermetic proxy already green: `tests/e2e/probe-smoke.spec.ts` covers
  the D1 stamp + the simulated crypto round-trip.)*

**Track B — device-test script (the artifact you carry to the device):**
- [x] **B1.** A one-page checklist under `docs/` (or the PR body): preconditions
  (iOS 18.4+, iCloud Keychain ON, install the preview URL to the home screen,
  confirm standalone chrome — no address bar), then the exact tap order for
  D1→D5, then a results table to fill. One session answers all six gates: D1/D5
  are the gates; D2 (localStorage survival), D3 (SW update latency), D4
  (splash/status bar), D6 (does the device enroll at all) are captured
  opportunistically in the same sitting.

**Two notes that de-confuse the device session:**
- **rpId transfers, scope does not.** The preview hostname is `skylite.croft.ing`,
  identical to production, and `rpId = location.hostname` (`vault.ts:120`,`:138`),
  so a passkey enrolled on the preview is rpId-bound to prod and the D5 finding
  transfers to the real app. The PWA install *scope* differs
  (`/pr-preview/pr-N/` vs root), but credentials are rpId-scoped, not
  path/scope-scoped, so scope does not affect resolution.
- **Standalone is the only new variable.** Because A4 already confirmed the tab
  path, a device-session failure localizes cleanly to standalone display mode
  (the D5 "works in Safari tab but not standalone PWA" outcome) rather than to a
  bug in the harness.

**Read-set:** `src/crypto/vault.ts` (A1), `build.mjs` (A2).
**Write-set:** everything Phase 1a writes, plus throwaway `probe.html` +
`src/probe/page.ts` (never merged) and `docs/` device-test script (B1).
**Done when:** Phase 1a is green; the probe harness is live at a preview URL and
verified in a desktop Safari tab; the device-test script exists. Only then does the
device session (Phase 0) run — with nothing left to build mid-session.

### Phase 0: Discovery (device-gated) — REQUIRED before Phase 1

**Goal:** Replace the unverified iOS-behavior assumptions above with firsthand
evidence, so Phase 1a's storage + crypto design is made on fact, not folklore.
These need a real installed iOS PWA (or the deferred `e2e:live` pass on a
device); they cannot be resolved in a hermetic context.

- [ ] **D1: Does iOS clear `sessionStorage` on installed-PWA cold launch?**
  - **Probe:** Install Skylite to the iOS home screen, sign an explorer in
    (localOnly off), confirm a heart persists, fully swipe-kill the app, relaunch
    cold. Observe whether the sign-in banner reappears (session gone) or hearts
    still work (session survived).
  - **Success criteria:** A definite yes/no on session survival across cold
    launch, plus whether `refreshExplorerSessionOnOpen` had a token to use.
  - **Disposition:** throwaway (observation only).
- [ ] **D2: `localStorage` retention + eviction window on iOS.**
  - **Probe:** After the fix branch (or a manual localStorage write), relaunch
    cold repeatedly; leave the app untouched across the ITP window; check
    whether `skylite.*` keys survive and roughly when they're evicted.
  - **Success criteria:** Confirmation that localStorage survives normal cold
    launches, and a rough eviction bound (so the graceful-degrade backstop is
    still justified).
  - **Disposition:** throwaway.
- [ ] **D3: Does the SW update take over promptly on iOS?**
  - **Probe:** Ship a version bump, open the installed PWA, confirm the footer
    version stamp advances within one/next launch; note whether a long-open tab
    needs a manual reload.
  - **Success criteria:** Observed update latency; whether a reload nudge (Phase
    3) is warranted for safety-patch liveness.
  - **Disposition:** throwaway.
- [ ] **D4: Splash + status-bar render on install.**
  - **Probe:** Add to home screen, cold launch, observe splash image and
    status-bar style.
  - **Success criteria:** Splash shows the intended art; status bar legible in
    light default.
  - **Disposition:** throwaway.
- [ ] **D5: Does WebAuthn PRF work inside the installed iOS PWA, and is the
  derived secret real?** *(Gates Phase 1a — the whole encrypt-at-rest design.)*
  - **Probe:** In the installed PWA on the target iOS (18.4+), with iCloud
    Keychain on, create a local passkey with the `prf` extension, then `get()`
    and confirm a **stable** secret is returned across calls. Explicitly check
    the "reports true but no hmac-secret" trap — derive, wrap a test blob,
    relaunch, unwrap, confirm it round-trips.
  - **Success criteria:** A stable PRF secret is derived in standalone display
    mode and round-trips an AES-GCM wrap across a cold launch. If not → Phase 1a
    ships as fallback-(b)-only (no persistence) until PRF is available.
  - **Disposition:** keep-as-fixture (the probe blob/flow seeds the Phase 1a
    wiring test).
- [ ] **D6: iCloud Keychain / passkey-enrollment reality on the child's device.**
  - **Probe:** Check whether the target child devices actually have iCloud
    Keychain enabled and can enroll a passkey without an Apple ID friction wall.
  - **Success criteria:** A yes/no on how often fallback (b) will be the real
    experience in the field (informs whether persistence is the common path or
    the exception).
  - **Disposition:** throwaway.

**Read-set:** none (runtime observation).
**Write-set:** none (findings recorded in this plan + Verified Assumptions).
**Shared-state contract:** none beyond a test device.
**Done when:** D1–D6 answered with observed behavior and the plan's Verified
Assumptions / Open Questions updated; owner reviews before Phase 1b. **D5 is the
gate** — if PRF doesn't work in the installed PWA, **Phase 1b ships
fallback-(b)-only** (no explorer persistence; behavior stays as today). The Phase
1a refactor is done in Phase 0-prep and stands regardless — it is behavior-
preserving for the audit vault, which ships PRF today, so it is not wasted even
if D5 fails.

> **Pass 2 restructure (2026-07-24):** Pass-1's Phase 1a/1b assumed `vault.ts`
> was reusable as-is and the unlock could auto-fire. Neither holds (see Verified
> Assumptions / Pass 2 findings). Split into **1a** (extract a reusable crypto
> core from vault.ts — new work), **1b** (explorer-session vault + storage), and
> **1c** (tap-to-unlock/enroll UX wired into all three entry points). Each stays
> ≤4 files and single-context. Sequential: 1a → 1b → 1c.

### Phase 1a: Extract a reusable crypto core from `vault.ts` (no behavior change)

**Goal:** `vault.ts` exposes generic wrap/unwrap + key-material primitives so a
second consumer (the explorer session) can reuse the exact PRF + AES-GCM code.
The sponsor audit-key feature is rebuilt on the core with **zero behavior
change** — its tests are the regression guard.

**Changes:**
- [x] `src/crypto/vault.ts` — export a generic core: `webauthnAvailable` (exists),
  `prfEnroll(opts)` / `prfGet(credentialId, salt)`, `passphraseMaterial`,
  and generic `wrapJson(value, ctx)` / `unwrapJson(wrapped, ctx)`
  (generalize the current `wrapPrivateKey`/`unwrapPrivateKey`, which only handled
  a `JsonWebKey`). `prfEnroll` takes `{ salt, label, displayName }` (audit vs.
  session) instead of the hardcoded `'skylite-audit'`. *(Impl deviation from the
  Pass-2 sketch, house style: the domain-separation `info` and `material` travel
  in a `WrapContext` options object — `wrapJson(value, { material, info })` — not
  positionally, and `prfEnroll` takes an options object carrying both `label` and
  `displayName` so the session credential can be labelled distinctly.)*
- [x] **Domain separation (Security invariant 2):** the `label` must feed the
  HKDF `info` (`aesFromMaterial`, `vault.ts:62`) — `skylite-audit-vault-v1` for
  audit, `skylite-explorer-session-v1` for the session — not only the WebAuthn
  `user.name`. The audit label MUST stay byte-for-byte `skylite-audit-vault-v1`
  so an existing sponsor vault still unlocks (pre-1.0, but a live sponsor's
  at-rest vault must survive this refactor).
- [x] **Preserve the fresh-random-IV per wrap (Security invariant 3):**
  `wrapJson` keeps `crypto.getRandomValues(new Uint8Array(12))` per call
  (`vault.ts:72`) — never a fixed/derived nonce.
- [x] **Diagnostic logging:** `prfGet`'s no-`first` branch (`vault.ts:128`, the
  hmac-secret-trap signal) logs `log.warn('[vault] PRF returned no hmac-secret')`
  **before** throwing, so the trap is diagnosable from the console. Route through
  `src/log.ts` (warn/error always emit; `?debug=1` won't survive the OAuth
  redirect, so warn/error are the right levels here).
- [x] Rebuild `createVault`/`unlockVault` on the generic core — identical output
  shape and behavior; this is a pure refactor.

**Call chain:** `sponsor.ts` → `ensureAuditVault` → `createVault` → (now) generic
core. No new entry point; the wiring is the existing audit path, unchanged.

**Wiring test:** the EXISTING audit tests (`tests/unit/audit-key.test.ts`,
`tests/e2e/sponsor-archive.spec.ts`, `tests/e2e/audit-passkey.spec.ts`) are the
guard — they must stay GREEN with no edits. That proves the refactor preserved
behavior. In `tests/unit/vault-core.test.ts` (new), RED-first, add and name:
- `wrapJson/unwrapJson round-trips arbitrary JSON with injected raw material`
  (no WebAuthn) — the generic-core happy path.
- `two labels derive distinct keys` (invariant 2): a blob wrapped under the
  `session` label fails GCM `decrypt` under the `audit` label.
- `each wrap uses a fresh IV` (invariant 3): two wraps of identical plaintext
  produce different `iv` fields.
- **`a pre-refactor audit blob still unwraps` (invariant 5, the regression the
  hermetic same-run round-trip cannot catch):** commit a fixture — a `wrapped`
  `{iv,ct}` blob + its raw material, produced by the CURRENT (pre-refactor)
  `wrapPrivateKey` under `skylite-audit-vault-v1` — and assert the refactored
  `unwrapJson` decrypts it byte-for-byte. This fails if the refactor changes the
  HKDF `info`/salt or the AES params, which a wrap-then-unwrap-in-one-run test
  would silently pass. *(Fixture disposition: keep-as-fixture. If Phase 0's D5
  probe blob is available, prefer it; otherwise generate from the pre-refactor
  code on the first RED run and commit it.)*

**Depends on:** nothing device-side. This is a behavior-preserving refactor of a
shipping feature (the audit vault already uses PRF in production), so it runs in
**Phase 0-prep, BEFORE the device session**, to give the probe harness the real
crypto core. *(Corrects the Pass-2 ordering, which had this gated on D5. D5 gates
Phase 1b — building explorer persistence on this core — not the refactor itself.
Owner-confirmed reorder, 2026-07-24.)*

**Read-set:** `src/crypto/vault.ts`, `src/sponsor/audit-key.ts`, `src/sponsor.ts`,
`src/crypto/sealedbox.ts`, `docs/telescope-search.md`.
**Write-set:** `src/crypto/vault.ts`, `tests/unit/vault-core.test.ts` (new),
`tests/fixtures/audit-vault-pre-refactor.json` (new, committed fixture).
**Shared-state contract:** no storage/ambient change; `skylite.audit.vault` key
and shape unchanged. Pure in-module refactor. No git/process/port mutation.

**Risks:** breaking the sponsor audit feature — **especially the real-PRF path,
which no hermetic test exercises** (`vault.test.ts` runs only the passphrase
path). Mitigation: (a) the audit test suite must pass untouched; if any audit
test needs editing to stay green, the refactor changed behavior and must be
corrected. (b) the pre-refactor fixture guards against a derivation change. (c)
the on-device unlock in Done-when catches a real-PRF regression the fixture and
mocked tests can't.

**Done when:**
1. **Behavioral:** the sponsor can still create + unlock an audit vault exactly
   as before; the generic core is exported and unit-round-trips; the pre-refactor
   fixture still unwraps.
2. **Verification (hermetic):** `npx vitest run vault-core audit-key` + `npx
   playwright test sponsor-archive audit-passkey` all green, no edits to the
   audit tests.
3. **Verification (on-device — required, do not skip):** on a real device with a
   sponsor audit vault created **before** this refactor lands, a Face ID / PRF
   unlock still recovers the audit private key. This is the only check that
   exercises the real-PRF derivation end to end.

**Validation:** **Broad** (refactor of security-critical crypto that a live
sponsor's at-rest key depends on) → unit round-trip + distinct-key + IV +
pre-refactor-fixture tests, the full audit suite as the behavior lock, **and** the
on-device real-PRF unlock. Do not close 1a on the hermetic suite alone — it is
blind to the real-PRF path.

### Phase 1b: Explorer-session vault + encrypt-at-rest storage

**Goal:** The explorer's scoped session is stored **encrypted** in localStorage
(wrapped via the Phase-1a core) and cached plaintext in sessionStorage for
in-app use, so it survives a cold launch. If PRF is unavailable, **nothing
durable is written** (fallback b) and behavior is exactly as today.

**Changes:**
- [ ] `src/social/explorer-session-vault.ts` (new) — `wrapSession(session)` /
  `unwrapSession(ciphertext)` over the Phase-1a core (session `label`, invariant
  2), plus an **injectable unwrap seam** for hermetic tests. Wraps **only** via
  the PRF path — the passphrase path is never referenced (Security invariant 1).
  Maps "no PRF / hmac-secret trap" to a typed `NoPersistence` result — never a
  passphrase prompt.
- [ ] **Retain the PRF-derived wrapping material for the runtime (Security /
  finding F):** after the launch unlock (or first enrollment) derives the PRF
  secret, the module holds the derived wrapping key in memory for the JS-runtime
  lifetime, so a subsequent proactive/in-page refresh can **re-encrypt the
  rotated refresh token silently** — without a second Face ID gesture. Same
  in-use exposure as the plaintext cache; documented, not a new leak. Without
  this, atproto's rotating refresh (`ensureFresh`) would re-prompt on every open.
- [ ] `src/social/explorer-auth.ts` — two layers: at-rest ciphertext in
  localStorage (`skylite.explorer.oauth.session.enc`) + in-use plaintext cache in
  sessionStorage (`skylite.explorer.oauth.session`, existing key/shape unchanged
  so `main.ts`/`mysky`/`telescope` keep reading it synchronously). `persist()`
  writes both (encrypting the durable copy) when a session vault exists **and**
  the wrapping material is held; else sessionStorage only (fallback b).
  `getExplorerSession()` stays **sync** (reads the cache). Keep `…pending`
  ephemeral.
- [ ] **`clearExplorerSession()` clears BOTH layers (Security invariant 4):**
  today it removes only the sessionStorage cache (`:49-51`). It must also remove
  `skylite.explorer.oauth.session.enc`. Wire it into (a) the existing
  refresh-chain-break path (`refreshExplorerSessionOnOpen` catch, `:69-72`) and
  (b) any `unwrapSession` GCM failure (deleted passkey / iCloud Keychain off /
  hmac-secret trap) — so no undecryptable secret lingers at rest.
- [ ] **Diagnostic logging (loud degrade):** the fallback-(b) path logs
  `log.warn('[explorer-vault] PRF unavailable — session not persisted
  (fallback b)')`; an `unwrapSession` GCM failure logs
  `log.error('[explorer-vault] stored session could not be decrypted — clearing
  at-rest copy')`. New crypto paths do **not** use the empty-`catch {}` swallow
  pattern of the surrounding file.

**Call chain:** explorer signs in / refreshes → `persistExplorerSession` →
`wrapSession` → localStorage ciphertext + sessionStorage cache. (The *read/unlock*
side is Phase 1c.)

**Wiring test:** unit in `tests/unit/explorer-session-vault.test.ts` (new),
RED-first, named:
- `wrapSession/unwrapSession round-trips a full OAuthSession (incl. dpopKey) with
  injected material`.
- `fallback (b): PRF unavailable → NoPersistence, no ciphertext written` (asserts
  `skylite.explorer.oauth.session.enc` absent).
- `unwrap GCM failure → NoPersistence and BOTH storage keys cleared` (invariant
  4, the third edge — not just happy-path + no-PRF).
- `session vault never invokes the passphrase path` (invariant 1) — e.g. spy /
  seam asserts `passphraseMaterial` is not reached.
- `a post-unlock refresh re-encrypts without a second gesture` (finding F): with
  material retained, a simulated `persist(fresh)` writes new ciphertext and does
  NOT call the unlock seam again.

(The end-to-end restore assertion across a cold launch is Phase 1c's wiring test.)

**Depends on:** Phase 1a (the crypto core).

**Read-set:** `src/social/explorer-auth.ts`, `src/crypto/vault.ts`,
`src/atproto/oauth/client.ts`.
**Write-set:** `src/social/explorer-session-vault.ts` (new),
`src/social/explorer-auth.ts`, `tests/unit/explorer-session-vault.test.ts` (new).
**Shared-state contract:** owns `skylite.explorer.oauth.session[.enc]`; WebAuthn
touches the platform authenticator, no server/PDS. No git/process/port state.

**Risks:** the plaintext cache is in sessionStorage **while the app is open**
(same as today) — only the at-rest, app-closed copy is encrypted; intended
posture. The retained in-memory wrapping key (finding F) shares that same
app-open exposure window and is discarded when the runtime tears down — no new
at-rest surface. The hmac-secret trap → unwrap failure means "no persistence"
**and clears the at-rest copy** (invariant 4), never "store unwrapped."

**Done when:**
1. **Behavioral:** a signed-in explorer's session is written encrypted at rest
   when PRF is available, and not written at all when it isn't.
2. **Verification:** `npx vitest run explorer-session-vault` green; existing
   `oauth`/`likes`/`refresh` suites stay green.

**Validation:** Broad (crypto + auth) → unit round-trip + fallback assertion;
on-device confirm folded into Phase 1c.

### Phase 1c: Tap-to-unlock + enroll UX, wired into all three entry points

**Goal:** One tap + Face ID per **cold launch** restores hearts (not per heart,
not per page nav); a one-time passkey enrollment happens after the explorer's
first sign-in; PRF-unavailable degrades cleanly to the sign-in banner. Works
whether the explorer lands on the garden, My Sky, or Telescope first.

**Changes:**
- [ ] `src/social/explorer-unlock.ts` (new) — a shared helper: if the
  sessionStorage cache is empty AND encrypted localStorage exists, render a
  **tap** affordance ("bring back your hearts"); the tap (a user gesture, as iOS
  requires) runs `unwrapSession` → repopulates the cache. Enrollment
  (`prfEnroll`) runs on a tap right after a successful sign-in. Idempotent within
  a JS runtime (guarded by the cache).
- [ ] `src/main.ts`, `src/mysky/page.ts`, `src/telescope/page.ts` — call the
  shared unlock helper at boot (each is a separate entry point that reads the
  session; all three must offer the unlock, else a cold-launch landing there
  misses the encrypted session).
- [ ] **Diagnostic logging:** the helper logs the branch it took —
  `log.info('[unlock] restoring session from at-rest copy')` on the tap→unwrap
  success path, `log.warn('[unlock] no PRF — showing sign-in banner')` on the
  degrade path. Because the explorer flow crosses an OAuth redirect (`?debug=1`
  does not survive it), the degrade uses `warn` (always emits) so a field failure
  is diagnosable via the console with only the durable `skylite-debug` flag.

**Call chain:** any entry point boot → `explorer-unlock` sees cache empty +
ciphertext present → shows tap affordance → tap → `unwrapSession` → cache filled →
`refreshExplorerSessionOnOpen`/`getExplorerSession` now returns the session →
hearts/follows live.

**Wiring test:** Playwright with the injectable unlock seam (no real WebAuthn):
encrypted session present, cold launch (sessionStorage cleared), assert the tap
affordance appears; "tap" → like control becomes live; navigate to `saves.html`
and `mysky.html` and assert **no second prompt** (cache survives in-app nav).
Second case: seam reports no-PRF → sign-in banner shown, no affordance. RED
before, GREEN after. Exercises the real boot paths of all three pages.

**Depends on:** Phase 1b (the session vault + storage layers).

**Read-set:** `src/social/explorer-auth.ts`, `src/social/explorer-session-vault.ts`,
`src/main.ts`, `src/mysky/page.ts`, `src/telescope/page.ts`, `src/social/like-ui.ts`.
**Write-set:** `src/social/explorer-unlock.ts` (new), `src/main.ts`,
`src/mysky/page.ts`, `src/telescope/page.ts`,
`tests/e2e/session-persistence.spec.ts` (new). *(5 files — over the 4-file rule
because three near-identical one-line boot wire-ups are unavoidable; if it
strains a single context, split the mysky/telescope wire-ups into a Phase 1c.2.)*
**Shared-state contract:** as Phase 1b; the unlock is idempotent within a JS
runtime, guarded by the sessionStorage cache presence.

**Risks:** (a) auto-firing the unlock without a gesture — iOS blocks it; MUST be
tap-driven. (b) the MPA re-prompt trap — the sessionStorage cache prevents it;
the wiring test asserts no second prompt across page navigation. (c) missing one
entry point — the test loads all three.

**Done when:**
1. **Behavioral:** one tap+Face ID per cold launch restores hearts from any of
   the three entry pages; in-app navigation never re-prompts; no-PRF shows the
   sign-in banner, never a broken state; `docs/custody.md` updated to match.
2. **Verification:** `npx playwright test session-persistence` passes (incl. the
   cross-page no-reprompt case); full suite green.

**Validation:** Broad → wiring test + **mandatory on-device confirm** (cold
relaunch → one Face ID → hearts work; page-nav no re-prompt; iCloud Keychain off
→ clean sign-in-banner fallback). Do not close on hermetic tests alone.

### Phase 2: Make the installed-PWA meta consistent across pages

**Goal:** `sponsor.html`, `audit.html`, and `guide.html` present the same
standalone chrome as `index.html` when added to the home screen.

**Changes:**
- [ ] `sponsor.html`, `audit.html`, `guide.html` — add
  `apple-mobile-web-app-capable`, `apple-mobile-web-app-title`, and
  `apple-mobile-web-app-status-bar-style` to match `index.html`. (Splash images
  stay on `index.html` only — they key off the `start_url`.)

**Call chain:** static `<head>` metadata → consumed by iOS at
add-to-home-screen; no JS. Verified by asserting the tags exist in the built
pages.

**Wiring test:** extend an existing HTML/asset spec (or copy-lint-style unit)
to assert each of the three pages contains `apple-mobile-web-app-capable`.
RED now (absent), GREEN after.

**Depends on:** none (independent of Phase 1); sequenced after only to keep one
change in flight at a time.

**Read-set:** the three HTML files, `index.html` (reference).
**Write-set:** `sponsor.html`, `audit.html`, `guide.html`, the test file.
**Shared-state contract:** none.

**Risks:** negligible; static tags. Watch the `build.mjs` absolute-path guard
(the tags are meta, not href/src, so unaffected).

**Done when:**
1. **Behavioral:** All four primary pages carry the capable/title/status-bar
   tags; a home-screen install of the sponsor page renders standalone.
2. **Verification:** the tag-presence test passes; `npm run build` succeeds.

**Validation:** Narrow → tests sufficient (plus the Phase-0 D4 device glance).

### Phase 3 (ADVISORY / optional): "update ready — reload" nudge

**Goal:** When a new SW has installed and taken control, a long-open session is
nudged to reload into the shipped build, so a safety patch (e.g., a pause-flag
logic fix) can't be stranded behind a tab that never navigates.

**Changes:**
- [ ] `src/pwa/register.ts` — listen for `updatefound` / `controllerchange` and
  surface a small, dismissible "a new version is ready — tap to reload" affordance
  (reuse existing banner styling). No forced reload mid-read.

**Call chain:** `registerServiceWorker()` (`main.ts:130`) → registration
`updatefound` → new worker `statechange`→`installed` with an existing controller
→ show nudge → user tap → `location.reload()`.

**Wiring test:** Playwright with a stubbed SW registration emitting
`updatefound`; assert the nudge appears and reload is wired. Feasibility of
faithfully simulating SW lifecycle in Playwright is itself a small unknown —
confirm during the phase; fall back to a unit test around the state-machine
handler if the e2e is flaky.

**Depends on:** Phase 0 D3 (only build this if update latency on iOS actually
warrants it).

**Read-set:** `src/pwa/register.ts`, `src/main.ts`.
**Write-set:** `src/pwa/register.ts`, a test file, possibly a line of CSS.
**Shared-state contract:** none.

**Risks:** a reload nudge that fires spuriously is annoying; gate strictly on
"new worker installed AND an old controller exists."

**Done when:**
1. **Behavioral:** After a version bump, an already-open session shows a reload
   nudge; tapping it loads the new build.
2. **Verification:** the nudge test passes.

**Validation:** Moderate; and only undertaken if D3 shows a real latency gap.

### Phase 4: Run wrap-up (RUN summary + doc true-up)

**Goal:** Close the run per house convention — a `RUN-*-SUMMARY.md`, the IDEAS.md
§4 status annotations, and the stub true-up — so the record matches what shipped.

**Changes:**
- [ ] `RUN-PWA-HARDENING-SUMMARY.md` (or the next `RUN-*` name in sequence) —
  what was built, what stayed fallback-only pending device gates, invariant
  tests added.
- [ ] `IDEAS.md` §4 — one-line built/gap annotation per item (a)–(e); (d) HEIC
  marked N/A.
- [ ] `plans/2026-07-20-1-plan-hardening-sequence-TODO.md` — mark item #1 done,
  point at this plan; note items #2–#4 remain.

**Call chain:** docs only; no runtime wiring.

**Wiring test:** none (docs). The `copy-lint` unit test already guards living
surfaces; confirm it still passes after edits.

**Depends on:** Phases 1a–1c and 2 (so the summary reflects what actually shipped).

**Read-set:** the three docs above, the shipped diffs.
**Write-set:** `RUN-PWA-HARDENING-SUMMARY.md` (new), `IDEAS.md`,
`plans/2026-07-20-1-plan-hardening-sequence-TODO.md`.
**Shared-state contract:** none.

**Risks:** none material; keep IDEAS.md edits minimal (owner decision).

**Done when:**
1. **Behavioral:** the run is documented; the stub reflects #1 complete.
2. **Verification:** `npx vitest run copy-lint` green; docs reference only
   existing paths.

**Validation:** Narrow → the copy-lint/path-existence guard suffices.

## Open Questions

- [CONFIRMED: BLOCKING — RESOLVED 2026-07-23: **persist (Option A)**]
  Explorer session persistence posture: persist the refresh token + DPoP key so
  refresh-on-open works across cold launches, vs. keep it ephemeral. **Owner
  chose persist (A)**, and further chose to **encrypt it at rest** (see Q3).
- [CONFIRMED: PHASE-GATED (Phase 1) — RESOLVED 2026-07-24: **encrypt at rest via
  WebAuthn PRF, fallback (b)**] The persisted session is wrapped at rest via the
  device's platform authenticator (Face ID / Touch ID / device passcode) using
  the WebAuthn **PRF** extension — reusing the existing `src/crypto/vault.ts`
  pattern (AES-256-GCM payload, PRF-derived wrapping key, nothing brute-forceable
  stored). **Decisions:**
  - **Fallback (b):** if PRF is unavailable (no iCloud Keychain, no enrolled
    passkey, unsupported iOS, or the hmac-secret quirk), **do not persist** —
    fall back to the current ephemeral + sponsor-re-auth behavior. Never store a
    weakly-wrapped token; the passphrase fallback in vault.ts is NOT used for the
    explorer. "Biometric or nothing."
  - **Unlock cadence:** once per **cold launch** — decrypt on first open into a
    per-app-session cache (see Q-cadence), so in-app page navigation does not
    re-prompt but a cold relaunch does.
  - This is **local, on-device encryption** of one scoped value — explicitly NOT
    the aspirational passkey-account-reauth in custody.md posture (3), so the
    passkey-on-PDS upstream blocker does not apply.
- [CONFIRMED: BLOCKING] **Does iOS actually clear `sessionStorage` on
  installed-PWA cold launch (Phase 0 D1)?** *If, surprisingly, it does not, the
  premise of Phase 1 weakens and we'd re-scope. This is verifiable only on a
  device, so it gates **Phase 1b** (the encrypt-at-rest build); the Phase 1a
  refactor runs earlier in Phase 0-prep regardless. Not an owner decision — a
  device probe. Armchair
  2026-07-24: the mechanism is well-supported (session storage is scoped to the
  top-level browsing context's lifetime; a cold launch builds a fresh context)
  and the localStorage-exempt/sessionStorage-non-persistent asymmetry points the
  same way — but no report nails this exact surface, so the probe still runs. If
  the probe shows sessionStorage survived, the real cause of the reported symptom
  is elsewhere (ITP eviction, a `clearExplorerSession` error path, or an
  OAuth-refresh failure) and Phase 1 re-scopes before building encrypt-at-rest.*
- [CONFIRMED: ADVISORY — cadence definition, resolve in Pass 2] **What exactly
  counts as a "cold launch" for the once-per-launch unlock?** *Decision: start
  with the sessionStorage boundary — encrypted session in localStorage; on unlock
  decrypt into sessionStorage, which survives same-tab in-app navigation (the MPA
  page-to-page moves) but is cleared when iOS tears down the PWA, giving exactly
  one re-unlock per cold launch. Refine later if a longer "remember for N hours"
  is wanted. Owner said "define cold launch, but start there."*
- [CONFIRMED: ADVISORY — 2026-07-24] **Offline fail-OPEN posture (show cached
  garden until the 72h stale window) is confirmed intended.** *Nothing to build;
  decision recorded. Reading is low-risk and never a lockout; the stale-lock is
  the safety valve.*
- [CONFIRMED: ADVISORY — 2026-07-24] **`IDEAS.md` gets minimal annotation; the
  real built/gap status lives in the RUN summary.** *IDEAS.md is idea-capture,
  not a living spec.*
- [CONFIRMED: ADVISORY — 2026-07-24] **The four-part order still stands;
  PWA-hardening remains item #1.** *Owner confirmed priorities are unchanged from
  the 2026-07-20 stub.*
- [RECOMMENDED: ADVISORY — new in Pass 2] **The explorer session enrolls its
  OWN WebAuthn credential (separate from the sponsor's audit-key credential),
  labelled distinctly.** *On the explorer's device there is no audit credential
  anyway (that lives on the sponsor's device), so a dedicated session credential
  is the natural design. Recommend confirm. Flagging only because Phase 1a adds a
  `label` param to `prfEnroll` to keep the two uses distinct.*
- [RECOMMENDED: ADVISORY — new in Pass 2] **Phase 1c's write-set is 5 files
  (over the "split at 4" rule) because three entry points each need a one-line
  boot wire-up.** *Recommend accept as one phase — the three wire-ups are
  near-identical and trivial. Fallback: split the mysky/telescope wire-ups into a
  Phase 1c.2 if it strains a single execution context. Owner/executor call at
  execution time.*
- [CONFIRMED: PHASE-GATED (Phase 1b) — 2026-07-24] **How does a post-unlock
  refresh re-encrypt the rotated token without a second Face ID gesture?**
  *Owner confirmed PHASE-GATED and endorsed the retained-in-memory-wrapping-key
  approach.*
  *atproto refresh tokens rotate on use; `ensureFresh` → `persist(fresh)` runs on
  every open and from mysky/telescope in-page refreshes. If the PRF-derived
  wrapping key is only obtainable via a user-gesture `prfGet`, a background
  re-encrypt is impossible without re-prompting. Recommend: the session-vault
  module **retains the derived wrapping key in memory for the JS-runtime
  lifetime** (encoded in Phase 1b), so re-wraps are silent; exposure equals the
  existing plaintext cache. Resolve before Phase 1b — it shapes the module's
  interface.*
- [CONFIRMED: ADVISORY — 2026-07-24] **The audit `label`/HKDF-`info` value
  must stay byte-for-byte `skylite-audit-vault-v1` through the 1a refactor.**
  *A live sponsor's existing at-rest audit vault becomes un-unlockable if the
  derivation string changes. The pre-refactor fixture test + on-device unlock
  guard this; flagging because it constrains the refactor's freedom (pre-1.0
  no-backwards-compat does NOT extend to a live sponsor's already-stored key).*

## Review Log

- **2026-07-23 — Pass 1 (draft + Phase-0 code discovery).** Read the live code
  for all five IDEAS.md §4 items. Confirmed lock-on-background, SW/version-stamp,
  offline garden, and (mostly) launch polish are built; HEIC is N/A (dropped).
  Pinpointed the login-vanishing gap: both OAuth sessions in `sessionStorage`
  (`explorer-auth.ts:32`, `sponsor/oauth.ts:33`), conflicting with custody.md's
  refresh-on-open claim. Scoped Phase 1 (explorer session persistence, the real
  fix), Phase 2 (per-page apple meta), Phase 3 (advisory update nudge), and a
  device-gated Phase 0. Six open questions surfaced (2 BLOCKING). No code changed.
- **2026-07-23 — Owner decision.** BLOCKING Q1 resolved: **persist the explorer
  session (Option A, localStorage).** Phase 1 confirmed as a code change, not
  docs-only. Remaining open questions still to be confirmed before Pass 2.
- **2026-07-24 — Owner decision + PRF research.** Q3 resolved: **encrypt the
  persisted session at rest via WebAuthn PRF** (platform authenticator; reuse
  `src/crypto/vault.ts`), **fallback (b)** — no persistence when PRF is
  unavailable (never a weakly-wrapped token; passphrase fallback not used for the
  explorer), unlock **once per cold launch** (sessionStorage cache boundary).
  Split Phase 1 into **1a** (storage + crypto) and **1b** (unlock/enroll UX);
  added Phase-0 **D5** (PRF-in-PWA gate) and **D6** (iCloud Keychain reality).
  Clarified the Skylite 4-digit PIN is only the background-lock gate, never an
  encryption secret. Desk research on PRF/iOS expectations recorded in Verified
  Assumptions. Sources:
  - Apple Developer Forums — "PRF reports true despite no hmac-secret extension":
    https://developer.apple.com/forums/thread/782466
  - Yubico — Developer's Guide to PRF:
    https://developers.yubico.com/WebAuthn/Concepts/PRF_Extension/Developers_Guide_to_PRF.html
  - Corbado — Passkeys & WebAuthn PRF for E2E encryption (2026):
    https://www.corbado.com/blog/passkeys-prf-webauthn
  - Progressier — Biometric auth with passkeys in PWAs:
    https://progressier.com/pwa-capabilities/biometric-authentication-with-passkeys
- **2026-07-24 — Pass 1 close-out.** All 6 open questions confirmed (2 BLOCKING
  — Q1 persist resolved, Q2 sessionStorage-wipe is a device probe/D1; 2
  PHASE-GATED/cadence resolved; 3 ADVISORY confirmed: offline fail-open intended,
  IDEAS.md minimal, four-part order unchanged with PWA-hardening as #1). Plan
  ready for Pass 2 (gap analysis) in a fresh context. No code changed.
- **2026-07-24 — Armchair de-risking of D1/D2/D5 (no device).** Chased the two
  highest-value unknowns against primary sources. **D2 moves (settled):** WebKit's
  Tracking Prevention doc documents a home-screen-app exemption from the 7-day
  script-writeable-storage cap → persisted localStorage is durable-by-default for
  our installed origin; degrade is a rare backstop, not a first-class path.
  Asterisk: exemption covers the interaction cap only, not quota-pressure/long
  power-off eviction → keep the backstop wired. **D5 stays open (gate stays):** no
  source addresses PRF in `display-mode: standalone` vs a Safari tab — the absence
  is the finding, so fallback-(b)-first sequencing (build 1a refactor + fixtures
  now, gate persistence on device) is the right hedge. Also resolved the
  hmac-secret trap: forum 782466 closes with the spec being clarified that
  `hmac-secret` is not required, so `prf.enabled` is a meaningless has-a-secret
  signal — read `results.first` (as `vault.ts` already does). Corroborated the
  iOS 18.4 floor (Corbado) and the 32-byte/same-salt-deterministic secret shape
  (Yubico); cross-launch stability remains unproven by any source → D5 criterion
  stays the round-trip. **D1 mechanism corroborated** by the sessionStorage
  lifetime definition but no direct standalone-swipe-kill report → stays a device
  probe. New sources:
  - WebKit — Tracking Prevention (home-screen storage exemption; ITP 7-day cap):
    https://webkit.org/tracking-prevention/
  - passkeys.dev — iOS & iPadOS platform reference (PRF version floors):
    https://passkeys.dev/device-support/
  - Apple Developer Forums 710157 — PWA data persistence beyond 7 days
    (*unverified — not fetched; treat as scattered-report only*):
    https://developer.apple.com/forums/thread/710157
  No code changed; edits landed in Verified Assumptions (PRF trap resolution) and
  the Unverified list (D1/D2 armchair annotations).
- **2026-07-24 — Readiness plan + reorder (owner-confirmed).** Surfaced that Phase
  0's write-set ("none, observation only") cannot satisfy D5's round-trip criterion
  — the device session needs a probe harness on the device. Added **Phase 0-prep**
  (device-independent): execute the 1a refactor first, build a throwaway probe page
  (`probe.html` / `src/probe/page.ts`) on the real crypto core, capture the D5 blob
  as the 1a fixture, deploy via PR preview (`skylite.croft.ing/pr-preview/pr-<N>/`),
  and write a device-test script. **Reorder:** the 1a refactor moves before the
  device session (it is behavior-preserving for the shipping audit vault, so
  carries no device risk); **D5's gate moves from 1a to 1b** (explorer persistence
  built on the core). Corrected the Concurrency Map spine, Phase 0 "done when",
  and Phase 1a "Depends on". Confirmed the deploy path: GitHub Pages at
  `skylite.croft.ing`, per-PR previews at `/pr-preview/pr-<N>/` (HTTPS, relative
  asset paths, `rpId = skylite.croft.ing` identical to prod so the D5 finding
  transfers). No runtime code changed yet — Phase 0-prep is the next execution
  step.
- **2026-07-24 — Phase 1a executed (A1 done).** Extracted the generic crypto core
  from `src/crypto/vault.ts`: new exports `wrapJson(value, {material, info})` /
  `unwrapJson(wrapped, {material, info})` (replacing the private
  `wrapPrivateKey`/`unwrapPrivateKey`), `passphraseMaterial`, `prfEnroll({salt,
  label, displayName})`, `prfGet`, and the `WrapContext` type. Domain separation
  is by HKDF `info`; `aesFromMaterial(material, info)` now takes the label. Audit
  info kept byte-for-byte `skylite-audit-vault-v1` (named const `AUDIT_VAULT_INFO`).
  Fresh-random 12-byte IV per wrap preserved. `prfGet`'s no-`results.first` branch
  now `log.warn`s '[vault] PRF returned no hmac-secret' before throwing (routed
  through `src/log.ts`). `createVault`/`unlockVault` rebuilt on the core (pure
  refactor). TDD: RED-first `tests/unit/vault-core.test.ts` (4 named tests:
  round-trip, two-labels-distinct, fresh-IV, pre-refactor-blob-unwraps), and the
  cross-version fixture `tests/fixtures/audit-vault-pre-refactor.json` generated
  from the PRE-refactor code (throwaway generator, since removed). **Evidence
  (fresh run):** typecheck clean, eslint clean, unit 203/203 (incl. the 4 new +
  audit-key + search-archive regression), build ok (9 pages, budget ok), e2e
  110/110 — including `audit-passkey.spec.ts`, which drives the real PRF path via a
  virtual authenticator, so the `prfEnroll`/`prfGet` label refactor is proven
  behavior-preserving, not only the passphrase path. Next: A2 (probe harness).
- **2026-07-24 — Phase 0-prep A2/A3/B1 done.** Built the throwaway device probe:
  `probe.html` + `src/probe/page.ts` (wired into `build.mjs` PAGES, branch-only,
  never merges), on the Phase 1a core. D1 storage-stamp panel; D5 enroll / get-×2
  (intra-session stability + the `enabled`-vs-`results.first` trap dump) / wrap /
  unlock-re-derive-round-trip; a "simulate material" path so desktop Safari (A4)
  can verify the AES-GCM wiring with no passkey; A3 copy-fixture button emitting a
  valid Phase 1a fixture shape. Installs standalone via apple-mobile-web-app meta;
  strict CSP, no inline JS. **B1:** `docs/PROBE-DEVICE-SCRIPT.md` — the one-page
  device runbook (preconditions incl. iOS 18.4+/iCloud Keychain, install steps,
  D1 and D5 tap order with decision tables, D2/D3/D4/D6 free-observations,
  sign-off). TDD: RED-first `tests/e2e/probe-smoke.spec.ts` (D1 stamp + simulated
  round-trip), now green. Full suite: unit 203/203, e2e 112/112, build ok
  (10 pages, budget ok). **A4 remains** — needs the push + PR to get a preview URL
  (outward-facing; awaiting go-ahead), then the desktop-Safari tab baseline. After
  A4, the device session runs the B1 script.
- **2026-07-27 — A4 pushed; preview live; pre-existing CI red flagged.** Pushed
  `pwa-hardening-ios` and opened draft PR #33 (CroftCommunity/skylite). The
  preview workflow deployed in 18s; the probe is live and serving —
  `https://skylite.croft.ing/pr-preview/pr-33/probe.html` returns HTTP 200 with
  the correct title. **CI is red, but the failure is inherited from `main`, not
  introduced here:** `tests/e2e/a11y.spec.ts` reports `color-contrast (serious)`
  on `sponsor.html` (light + dark). Confirmed identical failure on main's latest
  CI (run 30052394794, commit `2057767` "Sponsor UX"), and it passes locally in
  both themes — an environment-specific axe discrepancy (CI Chromium vs local),
  pre-dating this branch. The a11y scan uses a fixed page list that does NOT
  include `probe.html`, and `sponsor.html` is byte-identical to main here. So
  Phase 1a + the probe are green in their own scope; the red is an unrelated
  pre-existing sponsor-UX a11y regression to be fixed separately. A4's remaining
  half (desktop-Safari tab baseline) and the device session are the human steps.

### Pass 2: Gap Analysis — 2026-07-24
**Found:**
- **`vault.ts` is not reusable as claimed** — wrap/unwrap + PRF helpers are
  private and specialized to the audit *keypair* (`vault.ts:57-153`); only
  `createVault`/`unlockVault`/`save`/`load`/`webauthnAvailable` are exported.
  Reuse needs a crypto-core refactor first → **new Phase 1a**.
- **WebAuthn needs a user gesture** (`vault.ts:117`,`:135`): the once-per-launch
  unlock can't auto-fire on load — must be **tap-driven**. Corrected in Phase 1c.
- **Three entry points read the session synchronously** (`main.ts:161` async,
  but `telescope/page.ts:296` + `mysky/page.ts:82` sync at boot with no
  refresh/unlock). The unlock/restore must be a shared helper wired into all
  three → Phase 1c write-set expanded to 5 files.
- **Hermetic testability** needs an injectable unwrap seam (real PRF can't run in
  the Playwright gate) → added to Phase 1b design + Phase 1c wiring test.
- Confirmed **StoredDpopKey is serializable** (`dpop.ts:26-43`) — the session
  already JSON-round-trips, so encrypt-at-rest is a straight wrap; no
  non-extractable-key blocker.
- Missing **run wrap-up** (RUN summary + IDEAS/stub true-up) → **new Phase 4**.

**Concurrency:**
- No changes to the sequential decision. Map updated for the new phase list
  (0 → 1a → 1b → 1c → 2 → 3 → 4). Noted Phase 2's write-set (HTML `<head>`) is
  genuinely disjoint from the 1a–1c chain and could parallelize, but kept
  sequential by choice. No hidden git/process/port state in any phase.

**Changed:**
- Split Pass-1 Phase 1a/1b into **1a** (vault crypto-core refactor, audit tests
  as regression guard), **1b** (explorer-session vault + encrypt-at-rest
  storage), **1c** (tap-to-unlock/enroll UX across all three entry points).
- Added **Phase 4** (run wrap-up). Moved the `custody.md` update to Phase 1c
  (the phase that makes the behavior real). Added an injectable-seam requirement
  and the multi-entry-point wiring. Two new ADVISORY open questions (separate
  session credential; the 5-file Phase 1c exception).

**Confirmed:**
- The core storage model (encrypted localStorage at rest + sessionStorage cache
  in use) holds. Fallback (b), once-per-cold-launch cadence, and the "local
  encryption ≠ posture-3 account passkey" distinction all survive review.
- Phase 0 device gates (esp. D5 PRF-in-PWA) remain the correct blocking checks.
- Reading the garden stays authless and unaffected.

### Pass 3: Quality Gates — 2026-07-24
Spot-checked the live code (HEAD 365fa8b): all touch-point files exist; test
conventions confirmed (`tests/unit/*.test.ts` vitest, `tests/e2e/*.spec.ts`
playwright); `mysky/page.ts:82` + `telescope/page.ts:296` sync reads re-verified;
`src/log.ts` API + the OAuth-redirect gotcha confirmed; `WRAP_INFO` single
constant + random-IV confirmed at `vault.ts:25,62,72`; existing `vault.test.ts`
exercises only the passphrase path.

**TDD ordering:**
- Named the specific RED-first tests for every phase rather than leaving them
  generic. Phase 1a: added distinct-key, fresh-IV, and pre-refactor-fixture
  round-trip tests (the last is mutation-resistant — a same-run wrap/unwrap would
  survive a derivation-change mutation; the fixture won't). Phase 1b: named the
  five unit cases incl. the third edge (unwrap-failure → clear) and the
  no-passphrase-path invariant, so the fallback branch isn't a single-point
  assertion. Wiring tests unchanged and still exercise real entry points (1c
  loads all three pages; 1a's guard is the untouched audit suite).

**Observability:**
- The plan had **zero** logging content; `src/log.ts` exists and its header names
  crypto/OAuth as must-log boundaries, yet neither `vault.ts` nor
  `explorer-auth.ts` logs today. Added `log.warn`/`log.error`/`log.info` calls to
  Phases 1a (hmac-secret trap), 1b (fallback-b + unwrap-failure), and 1c (unlock
  success / no-PRF degrade). Chose warn/error for the degrade traps because
  `?debug=1` does not survive the OAuth redirect and warn/error always emit.
  Prohibited copying the file's empty-`catch {}` swallow pattern into crypto
  paths (house rule: fail loud).

**Debugging readiness:**
- Sequential commit-per-phase gives natural checkpoints; the D5 keep-as-fixture
  blob now also seeds the Phase 1a fixture test, so a device finding is captured
  as a committed regression guard rather than lost after the probe.

**Validation calibration:**
- Upgraded Phase 1a from **Moderate → Broad** and added a **required on-device
  real-PRF unlock** to its Done-when. Rationale: 1a's hermetic guard exercises
  only the passphrase path and round-trips within one run, so it is blind to a
  real-PRF derivation regression that could brick a live sponsor's at-rest audit
  key. This closes the gap where 1a could otherwise "close on hermetic tests
  alone." 1b/1c on-device confirms unchanged (1c already Broad + mandatory
  device gate; 1b's device confirm is explicitly folded into 1c).

**Concurrency honesty:**
- Map confirmed; sequential plan. Re-checked write-set disjointness after Pass-3
  additions — all new entries are committed test assets; no new runtime module,
  no new shared mutable state, no parallel set introduced. Retained in-memory
  wrapping key is per-runtime process state, not cross-phase. No re-entry
  verification required (no parallel set). Added an explicit Pass-3 re-check note
  to the Concurrency Map.

**Discovery (Phase 0):**
- D1–D6 each have a concrete question, probe, success criterion, and disposition;
  D5 is correctly the blocking gate. Confirmed D5's `keep-as-fixture` disposition
  now wires into a named Phase 1a test. No Phase 0 task can be resolved during
  planning — all six are genuine device-behavior probes.

**Coherence:**
- Plan still solves the original problem (session survives cold launch, hearts
  keep working) and scope did not creep — Pass 3 added guards and diagnostics,
  not new features. Surfaced one genuine **new design gap** (finding F: silent
  re-encrypt of the rotated token) and one **new invariant** (audit label must
  stay byte-stable), both as tagged open questions.

**Documentation impact:**
- Reconciled two internal contradictions: (1) IDEAS.md annotation and the RUN
  summary are both Phase 4 (Pass 1 mislabelled IDEAS.md "Phase 1"); (2) all stub
  edits are Phase 4, keeping Phase 0's write-set honestly empty (Phase 0 records
  findings in this plan doc under the Discovery Exemption, not the stub). Added a
  grep record for `docs/telescope-search.md` (referenced by `vault.ts`; not made
  stale by the behavior-preserving 1a refactor). custody.md remains correctly
  scheduled in Phase 1c (the phase that makes the behavior real).

**Security review:**
- Added an explicit **Security model** section (threat model + five testable
  invariants) — previously the invariants were scattered across Reasoning and the
  Open Questions. New concrete findings folded into phases: domain-separated
  wrapping keys (invariant 2, Phase 1a), fresh-random-IV preservation (invariant
  3, Phase 1a), `clearExplorerSession` must clear BOTH layers so no undecryptable
  secret lingers at rest (invariant 4, Phase 1b), the pre-refactor fixture +
  on-device unlock proving the refactor can't regress the sponsor's key
  (invariant 5, Phase 1a), and the biometric-or-nothing / no-passphrase-path
  invariant made a test (invariant 1, Phase 1b).

**Confirmed ready:** yes (pending device gates). All open questions confirmed by
the owner — the two Pass-3 items resolved at their recommended severities
(finding F → PHASE-GATED Phase 1b, with the retained-in-memory-wrapping-key
approach endorsed; audit-label stability → ADVISORY). No BLOCKING owner
decisions remain. The only execution blockers are Phase 0's device gates (D1
sessionStorage wipe, D5 PRF-in-PWA), which are device probes, not plan defects.
