# RUN-SEARCH — SUMMARY (Telescope rung 2: search + the encrypted archive)

`Written RETROACTIVELY on 2026-07-16 during RUN-TRUEUP (Phase 4). Reconstructed
from git history — the search-system PRs (#17–#24) shipped without a run summary,
so this one is assembled from the actual commit sequence after the fact.`

> **Retroactive note (read first).** The eight PRs below were merged as **squash
> commits**, so in mainline each phase's tests and implementation land in a
> *single* commit — the intra-PR red-to-green order is not preserved in the
> squashed history. Where this matters the entry says so plainly rather than
> retrofitting a "test landed first" claim. Every commit here nonetheless shipped
> with its tests **in the same commit**, and the whole gate (lint · typecheck ·
> unit · build · e2e) was green at each merge. Dependencies added across the whole
> run: **none** (all WebCrypto / DOM / atproto primitives already in the tree).

Scope: Telescope rung 2 (open search) and the encrypted search-history archive —
the model in `docs/telescope-search.md`. Rung 1 (approved feeds) shipped earlier
under RUN-DISCOVER.

---

## Phase-by-phase (commit-cited)

### #17 — Trust-gradient model + gating policy — `4bbb750`
The config + safety core, no search box yet. Landed the sponsor-set reach **tier**
(`off` / `discovery` / `open`), the layered combinable safeguards (label floor,
blocklist substring gate default-on, topic allowlist whole-word gate default-off,
history logging default-on), the migration of legacy `telescope: true/false`, and
`docs/telescope-search.md` itself.
- Code: `src/search/policy.ts` (new), `src/config/types.ts`, `src/config/parse.ts`,
  `src/sponsor.ts`, lexicon `config.json`.
- Tests **in the same commit**: `tests/unit/search-policy.test.ts` (new, 53 lines),
  plus `config-parse` / `capabilities` updates. `policy.ts` is pure and
  dependency-free, so its unit tests are the whole spec of the gate — the
  red-to-green was demonstrated in the PR's own history, squashed here.

### #18 — Tier-aware search box + history — `f9d0f3c`
The consuming half: wired the foundation into `/telescope.html`. Added
`AuthorFeedClient.searchPosts` (public `app.bsky.feed.searchPosts`), a search box
shown only when a tier is set (hidden on `off`), discovery author-bounding, the
label floor on results, and **device-local** history logging with the visible
"recent searches (your sponsor can see these)" list.
- Code: `src/telescope/page.ts`, `src/atproto/client.ts`, `src/search/history.ts`
  (new).
- Tests **in the same commit**: `tests/e2e/telescope-search.spec.ts` (new, 101
  lines) — hermetic, fixtures for `searchPosts`/`getFeed`. Proves tier gating,
  both gates, the label floor, discovery bounding, and blocked-and-logged.

### #19 — Sealed-box crypto core — `b08d544`
"Privacy in public." ECDH P-256 → HKDF-SHA256 → AES-256-GCM sealed box: `seal`
to the sponsor's public key, `open` only with the private key; fresh ephemeral
key per message; encrypt-everything payload. (Also fixed a pre-existing flaky
saves e2e by awaiting the IndexedDB write.)
- Code: `src/crypto/sealedbox.ts` (new).
- Tests **in the same commit**: `tests/unit/sealedbox.test.ts` (new, 45 lines) —
  round-trip, wrong-key rejection, tamper (GCM tag) rejection, distinct
  ciphertexts for identical plaintext.

### #20 — The sponsor key vault — `c822daf`
Protects the audit **private** key at rest so a stolen device / localStorage
can't read the archive. Generates the audit keypair, keeps the public key ready
to publish, and wraps the private JWK under AES-256-GCM with the wrapping key
derived two ways: **WebAuthn-PRF** (passkey / PIN / biometric) or **passphrase**
(PBKDF2, high iterations).
- Code: `src/crypto/vault.ts` (new).
- Tests **in the same commit**: `tests/unit/vault.test.ts` (new, 36 lines) —
  create → unlock round-trip (passphrase path; the PRF path is hermetically
  covered later by the virtual authenticator in #24).

### #21 — Config exchange + sealed-record write — `5e220c8`
The explorer device now seals each search and syncs the ciphertext when the
archive is on. `search.auditPubKeyJwk` (an EC P-256 **public** JWK) added to
schema / lexicon / parse; `parseAuditPubKey` validates `kty/crv/x/y` and
**rejects any key carrying a private scalar `d`**. Sealed records are written to
`ing.croft.skylite.search` in the explorer's OWN repo (best-effort, mirroring
likes/follows), 30-day / 500 retention.
- Code: `src/search/archive.ts` (new), `src/config/{types,parse}.ts`,
  `src/telescope/page.ts`, `src/search/history.ts`, lexicons `config.json` +
  `search.json` (new).
- Tests **in the same commit**: `tests/unit/search-archive.test.ts` (new, 41
  lines — retention + "seals the whole payload, only the vault opens it, query
  never in cleartext"), `tests/e2e/search-archive.spec.ts` (new, 65 lines —
  honesty copy present; with no account the search still works and NO record is
  written).

### #22 — Sponsor enables the archive (phase 3A) — `30b5c36`
The sponsor can turn the archive ON: create (or reuse) this device's audit
keypair and publish only its PUBLIC key into the explorer's config.
- Code: `src/sponsor/audit-key.ts` (new), `src/sponsor/store.ts`, `src/sponsor.ts`.
- Tests **in the same commit**: `tests/unit/audit-key.test.ts` (new, 40 lines),
  `tests/e2e/sponsor-archive.spec.ts` (new, 45 lines) — enabling publishes a
  public key (`kty:EC`, `crv:P-256`) and **never** a private `d`; turning it off
  removes the key.

### #23 — Sponsor audit-view decrypt (phase 3B) — `0b6faca`
Completes the loop: the sponsor READS an explorer's history — decrypted on the
sponsor device, unreadable anywhere else. `resolveHandleToDid` (public AppView),
`fetchSealedHistory` (resolvePds + public `listRecords`), `decryptHistory` (open
each record newest-first, skip any it can't open). The audit page gained the
encrypted-history section.
- Code: `src/search/audit-read.ts` (new), `src/audit.ts`.
- Tests **in the same commit**: `tests/unit/audit-read.test.ts` (new, decrypt +
  ordering + skip-foreign), `tests/e2e/audit-history.spec.ts` (new, 70 lines —
  the whole loop hermetic: enable → seal in Node → read → unlock → decrypt to
  clear text; and a wrong passphrase decrypts nothing).

### #24 — Wire the WebAuthn passkey path + virtual-authenticator e2e — `f895f2d`
The PRF vault path existed since #20 but was only reachable in code. Wired it into
the sponsor UI (enable-with-passkey; audit-unlock-with-passkey, no passphrase
field) and proved it end-to-end.
- Code: `src/sponsor.ts`, `src/audit.ts`.
- Tests **in the same commit**: `tests/e2e/audit-passkey.spec.ts` (new, 73 lines)
  — a Playwright **virtual authenticator** drives enable → seal → unlock →
  decrypt over the PRF flow, removing the "verify-in-run" caveat on the flow
  itself.

---

## Red-to-green, honestly

Because mainline holds squash commits, there is no in-repo commit that shows a
failing test before its fix for these phases. What the history **does** show, per
commit above, is that **every phase shipped its tests alongside its
implementation** — pure units for the crypto/policy cores (`policy`, `sealedbox`,
`vault`, `archive`, `audit-read`, `audit-key`) and hermetic Playwright e2e for
each user-facing slice. The TDD red-to-green happened inside each PR's own branch
history, which squash-merge did not preserve. This summary does not claim
otherwise.

## Dependencies

**None.** The entire search system is built on primitives already in the tree:
WebCrypto (ECDH / HKDF / AES-GCM / PBKDF2 / WebAuthn-PRF), the DOM helpers, and
the existing atproto client / repo / OAuth code.

## Verify-in-run / left open (as of #24)

Carried forward in `docs/telescope-search.md` → "Verify-in-run / staged":

- Live `searchPosts` / `getFeed` / `resolveHandle` / PDS reads and the real PDS
  record **write** against the live network + OAuth consent (the hermetic specs
  mock these).
- Real **biometric hardware** (the virtual authenticator covers the PRF flow; the
  passphrase path is fully hermetic).
- **Repo-side retention pruning** — today the 30-day / 500 policy prunes the
  on-device log; the synced records are not yet server-pruned.
- The default block/allow lists are **seeds**, deliberately modest — a real
  deployment extends them; semantic / obfuscation-resistant matching is out of
  scope by design.

> RUN-TRUEUP (2026-07-16) later trued up two things this system shipped with: the
> record-level `createdAt` is now rounded to the UTC **day** with the precise time
> sealed inside the payload (Phase 1), and the sealed-box code comment about
> ephemeral-key leakage vs. private-key compromise was corrected (Phase 5). See
> RUN-TRUEUP-SUMMARY.md.
