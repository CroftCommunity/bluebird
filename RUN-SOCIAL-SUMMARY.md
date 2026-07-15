# RUN-SOCIAL (B1/B2 + custody) — SUMMARY

`Date: 2026-07-15. Branch: claude/skylite-directives-runs-rihei2 (restarted from
main after RUN-STRUCT + OAuth merged). Instruction: SKYLITE-DIRECTIVES.md
RUN-SOCIAL, with the owner's custody ruling (see docs/custody.md).`

This delivers the **"sharing on" identity + likes** half of RUN-SOCIAL on the
ruled custody posture, plus the OAuth refresh mechanics that make that posture
livable, and documents the whole custody/usability spectrum.

**Gate: full `npm test` green — lint · typecheck · 131 unit · build · 53 e2e.**
No new dependencies (still dependency-free on WebCrypto).

---

## The custody ruling (docs/custody.md)

Current posture is **sponsor-only custody**: the sponsor holds the account
email + password + an offline recovery key (handed over at graduation); the
**explorer device holds ONLY the scoped OAuth session**, never the password.
Re-auth is therefore a **sponsor-assisted event** — made rare by **long-lived
refresh + proactive refresh-on-open** — and a lapse degrades gently, never
locking the garden. `docs/custody.md` records the full gradient (sponsor-only →
co-sponsor → passkey self-re-auth → full self-custody), the rationale, what the
passkey position looks like in practice (and why it isn't buildable yet), and
what would move us along the axis. It is a living doc to refine together.

---

## What shipped

### OAuth refresh + refresh-on-open (the "make re-auth rare" mechanics)
- `refresh(session)` — the rotating refresh-token grant over DPoP (atproto
  refresh tokens are single-use and rotate).
- `ensureFresh(session)` — proactive refresh-on-open: returns a comfortably-valid
  session, refreshing only within the expiry skew. Sessions now carry
  `clientId` + `expiresAt`. The sponsor publish path refreshes proactively too.

### B2 — likes
- `ing.croft.skylite.like` lexicon: a subject strongRef + createdAt, mirroring
  `app.bsky.feed.like`, written into the **explorer's own repo** (never the
  sponsor's). rkey is a tid.
- `createRecord` / `deleteRecord` added to the OAuth client (DPoP-bound, nonce
  retry). `src/social/likes.ts`: `buildLikeRecord`, like/unlike, and a local
  index (postUri → like-record-uri) so one-tap unlike needs no round-trip.
- **The explorer can delete her own likes; the sponsor cannot** — her repo is
  hers, by construction.

### B1 — lazy explorer identity + the like UI
- `src/social/explorer-auth.ts`: the explorer-device OAuth with a **granular
  `like` + `follow` scope**, `sub` verified against the resolved DID, session in
  sessionStorage (ephemeral), and **refresh-on-open**. A broken refresh chain
  clears the session and degrades gently.
- The garden shows a **heart** only when `capabilities().canPersistLikes`
  (localOnly off) — keyed on localOnly, **never** skin. **No counts anywhere.**
- **Gentle degrade**: sharing on but no valid session → the heart reads "sign in
  to like" and a banner offers sign-in; **the garden, Saves and sharing are
  never gated**. Reading never needs auth.

### Proof
- Unit (real WebCrypto): refresh + rotation, `ensureFresh` skew logic,
  create/delete record shapes, the pure like builders.
- Hermetic **end-to-end** e2e: localOnly shows no heart; sharing-on-signed-out
  degrades with the garden intact; and a full **sign in with Bluesky → like →
  unlike** round-trip (mocked discovery / PAR / authorize-redirect / token /
  create / delete on CSP-allowlisted hosts).

---

## Deferred / verify-in-run (filed, not hidden)

- **In-app account *creation*** (invite codes + the **13+ age gate**) — for now
  the account is created/linked out of band by the sponsor and the device signs
  in to it. Under-13 explorers stay localOnly until the family-PDS route
  (deferred).
- **Friends' hearts + the `showFriendsHearts` lurk view** (B2's read side —
  friends' likes via public listRecords, see-but-not-be-seen). The config +
  capability (`canSeeFriendsHearts`) already exist; the read/render is the next
  slice.
- **B3 (post-view page + native share)** and **B4 (full skin)** — B4 needs the
  owner's bsky.app reference screenshots.
- **Follows** (`ing.croft.skylite.follow`, My Sky) — RUN-DISCOVER D1; the scope
  is already granted, the records aren't written yet.
- **Granular OAuth scope syntax** (`repo:ing.croft.skylite.*`), the live consent
  screen, server-side DPoP validation, and token-refresh against a real PDS —
  all verify-in-run (a hermetic test can't reach them).
- **Passkey self-re-auth / co-sponsor** — see docs/custody.md; both aspirational
  until their upstream primitives land.
