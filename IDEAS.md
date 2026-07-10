# Skylite — idea capture

**What Skylite is:** a kid-safe, installable PWA that gives a child a curated,
non-algorithmic window into Bluesky/ATProto — a "walled garden whose door was
always hers." Identity is rooted in a DID the child ultimately controls, so the
account (and its whole history/graph) is portable and the guardian relationship
is a handoff, not a lock-in.

> **Provenance:** extracted from a brainstorming transcript on 2026-07-10.
> Separated out of the arecipe idea-cataloguing session because Skylite is a
> distinct project. Claims flagged _verify_ were called out in the source as
> needing confirmation against current ATProto/PDS/iOS docs before building on
> them. Nothing here is verified engineering — it's a captured idea set.
>
> **Scope:** this doc holds the **identity / ATProto / PWA-hardening** engineering.
> The **product concept + branding** (read-only pitch, Sky-Channels, Scrapbook,
> Sky-Shield moderation, co-viewing, the name/visual/tagline) lives in
> [`CONCEPT.md`](CONCEPT.md), distilled from a separate same-day Gemini dialogue
> ([raw](seeds/transcripts/raw/2026-07-10-gemini-skylite-concept-and-logos.md)).
> See `CONCEPT.md` §3 for where its features meet this doc — notably the guardian
> toggle = the **pause screen / kill switch** below (§4), and the "Sky-Shield" AI
> moderation layer is in tension with the no-server spine of §2/§5.
> The raw transcript behind *this* doc is not yet filed — see
> [`PROVENANCE.md`](PROVENANCE.md).

---

## 1. Identity & lifecycle (the endgame)

### Graduation is a handoff, not a settings change
When the child is old enough, you don't loosen flags — you **migrate the account
to a PDS she controls and give her the keys**. Because identity is rooted in the
DID (not the PDS), her whole history, graph, and posts come with her. Roughly one
command's worth of ceremony:

```
goat account migrate:
  create account on new PDS → import repo as CAR → move blobs
  → sign PLC operation to repoint identity → activate
```

- **Why it matters:** a walled silo can never offer this; the door was always hers.
- **Seam (_verify_):** migration is potentially destructive. A botched PLC
  operation can permanently lock the account out with no recovery. Rehearse on a
  throwaway; keep backups. The migration mechanism is documented *best practice*
  that may still evolve, not frozen spec.

### Pick `did:plc` now; hold a backup rotation key offline
The identity decision that makes both the handoff and any recovery possible — the
concrete form of the bus-factor worry.

- `did:plc` is recoverable and supports **key rotation**. `did:web` ties identity
  to a domain; moving domains creates an entirely new DID and loses the social
  graph. → choose `did:plc`.
- Add a **backup rotation key you hold offline**. As long as one rotation key
  works you can recover, even if the PDS is gone/uncooperative. A second trusted
  adult holding one = redundancy against you being unavailable.
- **Seams (_verify_):** a full delete becomes unrecoverable after a ~72-hour
  window. The PLC directory is currently centralized under Bluesky (they've
  announced moving it to an independent org) — the one dependency in this design
  you don't control.
- Give her a handle on a **subdomain you own** (DNS method), not a `bsky.social`
  one, so the namespace is yours and neutral.

---

## 2. The reading experience

### Her feed is a made thing, not an algorithm
Instead of an algorithmic timeline: the accounts on an **inclusion list**, each
pulled with `getAuthorFeed`, merged newest-first, **client-side, no server**.

- Anti-compulsion, no-ranking feed by construction; needs nothing running.
- **Axis:** a custom feed generator could do the same server-side with more power,
  at the cost of a service to operate. Client-side merge is the lighter path.
- **Ceiling:** she only ever sees who you've included — the point, and the limit.

---

## 3. Safety stance (honest net, not a watchtower)

### An out-of-band "something's wrong" button
One tap reaches the trusted adult **out-of-band** (messaging handoff or email) —
not platform reporting, not activity monitoring. Distress routes to a person;
*she* chooses to reach out. The honest inverse of surveillance.

### A plain "your stuff" view
Shows her what's in her repo and states plainly: it's public under the hood,
portable, and pausable by a guardian. Teaching the real shape of the network >
a comforting fiction. Same anti-decoy stance already landed on.

---

## 4. PWA hardening (iOS-specific)

### Design for the login vanishing
The OAuth browser session lives in the same storage iOS willingly evicts. If
reads are gated behind auth on a closed PDS, eviction doesn't clear a cache — it
**locks her out until re-auth**. Treat "logged in" as temporary; make re-auth a
single calm step; let the passkey front door double as the re-login affordance.
This is where eviction + closed PDS + passkey all meet — handle it deliberately.

### Guarantee she runs the build you shipped
PWAs update silently on next open (no App Store review) — a gift, but iOS
service-worker caching notoriously strands stale builds. Use `skipWaiting` +
`clients.claim`, cache-bust assets, show a visible version stamp. Skylite is a
safety tool: a lingering old build means your patches — and even the client-flag
**pause screen / kill switch** — might not actually be live.

### One canvas pass for photos: HEIC→JPEG, downscale, EXIF-strip (_verify_)
Her iPad shoots HEIC by default; most browsers can't decode HEIC to canvas, but
**Safari can**. Because Skylite is WebKit-only, you get Safari's native HEIC
decoder for free — no ~2MB WASM converter (`heic2any` etc. are heavy).

```
draw image → scale down → canvas.toBlob('image/jpeg')
  ⇒ converts format + shrinks blob (saves storage) + strips EXIF geodata, one pass
```

- Sources disagree on the easy path: one says `accept="image/jpeg"` makes iOS
  auto-convert the pick; another says that transcoding is unreliable (including
  `image/heic` or multi-select changes behavior). The canvas re-encode is the
  robust move. **Verify on her exact iOS version** — decode/transcode behavior
  shifts release to release.

### Lock on background, not just at open
The passkey gate covers launch, but a kid sets the iPad down mid-use. Add a
`visibilitychange`/`blur` handler that locks the garden when Skylite backgrounds;
re-gate on return; optional inactivity timeout. Closes the "left on the couch" /
"handed to a friend" gaps.

### Make the cached garden readable offline
Cache last-fetched posts + blob images in the SW so flaky wifi / a car ride still
shows her garden ("showing saved, you're offline" vs. a blank screen).

- **Decision point (fail-closed?):** offline must either show cached content OR
  lock until it can re-verify the pause flag + session. A safety-vs-usefulness
  call — wire the offline path intentionally either way.

### Give it a real launch
iOS shows a blank white cold-start screen without `apple-touch-startup-image`
splash images. Set those + maskable/`apple-touch` icons, `theme-color`,
status-bar style, and a manifest (name "Skylite", short name). The difference
between launching like an app and launching like a bookmark — matters for
something she's meant to trust and reach for.

---

## 5. Auth clarified: passkey ≠ re-login proxy

Two auth layers that do **not** substitute for each other — only one can revive a
dead session.

```
┌─ OAuth session ──────────────┐     ┌─ Local biometric / passkey ──┐
│ a BADGE the PDS issues to     │     │ the LOCK on Skylite's own     │
│ Skylite → read/write her repo │     │ front door — "right kid       │
│ (access token + refresh token)│     │ opened the app"               │
└───────────────────────────────┘     └───────────────────────────────┘
```

- iOS eviction **shreds the badge**. Unlocking with Face ID does not print a new
  badge — Skylite must walk back to the PDS and get re-badged. So biometric can be
  the thing she *taps to start* re-login, but it **is not** the re-login.
- The token is cryptographically bound to a key in Skylite's own storage → even a
  saved badge is dead once that key is wiped. That's why eviction is *fatal*, not
  inconvenient.
- **Face ID/Touch ID** = the device's local "yes it's me" gesture; holds no
  server-acceptable credential. **A passkey** = a real credential — but the server
  that verifies it is the **PDS**, not Skylite (a public client that just
  redirects to the PDS). The app doesn't implement passkeys; the PDS does.

**Softeners that don't require building custom PDS auth:**
- Live PDS session cookie collapses re-auth to an approve tap (sometimes silent) —
  but it's also evictable/expiring, not durable.
- `login_hint` pre-fills her handle so she isn't typing an identifier. Small, free.

**Bigger levers:**
- **Public vs. confidential client sets session length.** A pure client-side PWA
  is a *public* client; sessions beyond ~2 weeks need a *confidential* client (a
  backend holding a signing key to sign token refreshes). Re-login cadence is
  baked into the no-server choice, not just iOS. Trade: a tiny confidential
  backend for weeks-long sessions vs. staying serverless + periodic re-auth.
- **Gating reads is what turns "expired" into "locked out."** If reads need her
  token, a dead session walls the garden. If reads don't, eviction just means the
  next *write* re-auths while browsing is untouched. Much of the pain is purchased
  by the decision to gate reads.
- **(_verify_)** Whether the current reference PDS login speaks passkey at all, or
  whether you'd be *adding* it. The spec lets the PDS choose its auth technology
  (passkeys, cookies, 2FA, external providers) — but passkeys are described as
  something configurable via the account interface, not shipped in stock login.
  You own the PDS so you *could* build it, but that's custom auth work a
  watchtower update can disturb.

---

## 6. Heavier axis (parked, needs verification)

### Private family federation (_verify_)
Rather than both kids on your one PDS: each family runs a PDS and they allowlist
only each other, **no public relay**. More sovereignty; fits cooperative-governance
leanings — but real ops for the other parent. Confirm the exact peering wiring
(two hosts subscribing to each other vs. a tiny private relay) before calling it a
supported mode rather than hand-rolled.

---

## Open verification list (before building)

1. Exact **migration ceremony for a kid account** (`goat account migrate` +
   PLC op) against current docs.
2. Whether **two-PDS private peering** works cleanly / is a supported mode.
3. The **HEIC canvas pipeline** on the target iPad's exact iOS version.
4. Whether the **reference PDS login speaks passkey** or it must be added.
