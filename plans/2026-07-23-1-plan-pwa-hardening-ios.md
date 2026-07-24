# PWA hardening (iOS reliability) — item #1 of the 4-part sequence

**Status:** Pass 1 (draft plan + Phase-0 discovery findings). Not yet executed.
Input stub: `plans/2026-07-20-1-plan-hardening-sequence-TODO.md`. Owner review
gate before Pass 2/3 and before implementation.

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
  Standalone-PWA PRF is under-documented → device-verify. Practical floor: iOS
  18.4. Sources in the Review Log.

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

**Unverified — needs a real iOS device (Phase 0 / the deferred manual pass):**
- iOS clears `sessionStorage` on installed-PWA cold launch (strongly expected,
  the basis for the whole Phase 1, but a device-behavior claim — not asserted).
- iOS retention/eviction of `localStorage` across launches and the ITP ~7-day
  no-interaction eviction window (affects whether the *persistent* session also
  eventually vanishes, i.e., whether the graceful degrade still needs to be the
  backstop even after the fix).
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
- `IDEAS.md` §4 — annotate items (a)–(e) with built/gap status. Light touch;
  **Phase 1** for (a), a one-line note for the rest. (IDEAS.md is idea-capture,
  not a living spec — keep edits minimal, or record status in the RUN summary
  instead. Owner preference — see Open Questions.)
- `RUN-*-SUMMARY.md` — a new `RUN-*-SUMMARY.md` for this hardening run
  (house convention), written at the end of execution, not during planning.
- `plans/2026-07-20-1-plan-hardening-sequence-TODO.md` — mark item #1's Phase-0
  discovery as done and point at this plan. **Phase 0** close-out.
- Grepped for references to `explorer.oauth.session` / `sessionStorage` outside
  the two auth files: only `src/social/explorer-auth.ts` and `src/sponsor/oauth.ts`
  define them; `main.ts` consumes via the exported functions (no direct key use).
  No test asserts the storage *backend* directly (oauth.spec.ts drives the flow
  through the UI). So the change surface is contained.

## Concurrency Map

Sequential spine: Phase 0 → 1a → 1b → 1c → Phase 2 → Phase 3 → Phase 4.
All phases sequential. Reason: Phase 0 (device findings, esp. D5 PRF) gates
Phase 1a's crypto refactor; 1b depends on 1a's core; 1c depends on 1b's storage;
Phase 4 (run summary) closes out the code phases. Phase 2 (static apple-meta,
write-set = HTML `<head>` only) is genuinely disjoint from the 1a/1b/1c chain
(write-sets under `src/crypto`, `src/social`, `src/main.ts`, page bootstraps) and
could run in parallel — but wall-clock saving is nil and one-change-in-flight is
simpler, so it stays sequential by choice, not necessity. No hidden shared state
(no git/process/port mutation in any phase).

## Phases

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
Assumptions / Open Questions updated; owner reviews before Phase 1a. **D5 is the
gate** — if PRF doesn't work in the installed PWA, Phase 1a ships fallback-only.

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
- [ ] `src/crypto/vault.ts` — export a generic core: `webauthnAvailable` (exists),
  `prfEnroll(salt, label)` / `prfGet(credentialId, salt)`, `passphraseMaterial`,
  and generic `wrapJson(material, value)` / `unwrapJson(material, wrapped)`
  (generalize the current `wrapPrivateKey`/`unwrapPrivateKey`, which only handle
  a `JsonWebKey`). Add a `label` param to `prfEnroll` (audit vs. session) instead
  of the hardcoded `'skylite-audit'`.
- [ ] Rebuild `createVault`/`unlockVault` on the generic core — identical output
  shape and behavior; this is a pure refactor.

**Call chain:** `sponsor.ts` → `ensureAuditVault` → `createVault` → (now) generic
core. No new entry point; the wiring is the existing audit path, unchanged.

**Wiring test:** the EXISTING audit tests (`tests/unit/audit-key.test.ts`,
`tests/e2e/sponsor-archive.spec.ts`, `tests/e2e/audit-passkey.spec.ts`) are the
guard — they must stay GREEN with no edits. That proves the refactor preserved
behavior. Add a unit test for the new generic `wrapJson`/`unwrapJson` round-trip
with injected raw material (no WebAuthn).

**Depends on:** Phase 0 D5 (confirms the PRF path is worth building on).

**Read-set:** `src/crypto/vault.ts`, `src/sponsor/audit-key.ts`, `src/sponsor.ts`,
`src/crypto/sealedbox.ts`.
**Write-set:** `src/crypto/vault.ts`, `tests/unit/vault-core.test.ts` (new).
**Shared-state contract:** no storage/ambient change; `skylite.audit.vault` key
and shape unchanged. Pure in-module refactor.

**Risks:** breaking the sponsor audit feature. Mitigation: the audit test suite
must pass untouched; if any audit test needs editing to stay green, the refactor
changed behavior and must be corrected.

**Done when:**
1. **Behavioral:** the sponsor can still create + unlock an audit vault exactly
   as before; the generic core is exported and unit-round-trips.
2. **Verification:** `npx vitest run vault-core audit-key` + `npx playwright test
   sponsor-archive audit-passkey` all green, no edits to the audit tests.

**Validation:** Moderate (refactor of security code) → unit round-trip + the full
audit suite as the behavior lock.

### Phase 1b: Explorer-session vault + encrypt-at-rest storage

**Goal:** The explorer's scoped session is stored **encrypted** in localStorage
(wrapped via the Phase-1a core) and cached plaintext in sessionStorage for
in-app use, so it survives a cold launch. If PRF is unavailable, **nothing
durable is written** (fallback b) and behavior is exactly as today.

**Changes:**
- [ ] `src/social/explorer-session-vault.ts` (new) — `wrapSession(session)` /
  `unwrapSession(ciphertext)` over the Phase-1a core, plus an **injectable
  unwrap seam** for hermetic tests. Maps "no PRF / hmac-secret trap" to a typed
  `NoPersistence` result — never a passphrase prompt.
- [ ] `src/social/explorer-auth.ts` — two layers: at-rest ciphertext in
  localStorage (`skylite.explorer.oauth.session.enc`) + in-use plaintext cache in
  sessionStorage (`skylite.explorer.oauth.session`, existing key/shape unchanged
  so `main.ts`/`mysky`/`telescope` keep reading it synchronously). `persist()`
  writes both (encrypting the durable copy) when a session vault exists; else
  sessionStorage only (fallback b). `getExplorerSession()` stays **sync** (reads
  the cache). Keep `…pending` ephemeral.

**Call chain:** explorer signs in / refreshes → `persistExplorerSession` →
`wrapSession` → localStorage ciphertext + sessionStorage cache. (The *read/unlock*
side is Phase 1c.)

**Wiring test:** unit — round-trip `wrapSession`/`unwrapSession` with injected
material; fallback path asserts NO ciphertext written when PRF unavailable.
(The end-to-end restore assertion is Phase 1c's wiring test.)

**Depends on:** Phase 1a (the crypto core).

**Read-set:** `src/social/explorer-auth.ts`, `src/crypto/vault.ts`,
`src/atproto/oauth/client.ts`.
**Write-set:** `src/social/explorer-session-vault.ts` (new),
`src/social/explorer-auth.ts`, `tests/unit/explorer-session-vault.test.ts` (new).
**Shared-state contract:** owns `skylite.explorer.oauth.session[.enc]`; WebAuthn
touches the platform authenticator, no server/PDS. No git/process/port state.

**Risks:** the plaintext cache is in sessionStorage **while the app is open**
(same as today) — only the at-rest, app-closed copy is encrypted; intended
posture. The hmac-secret trap → unwrap failure means "no persistence," never
"store unwrapped."

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
  device, so it gates Phase 1a. Not an owner decision — a device probe.*
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
