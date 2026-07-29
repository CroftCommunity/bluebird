# Custody & re-authentication — the spectrum, and where we stand

This is a living design doc. It exists so the whole custody/usability gradient
lives in one place — the current posture, why we chose it, and what would move
us along it — so we can refine it together rather than re-derive it each time.

Scope: this is about the **explorer's "sharing on" account** — the account that
exists only after an explorer's `localOnly` switch is turned off, so hearts and
follows become real, public records. While `localOnly` is on (the default),
none of this applies: there is no account, no credential, nothing to recover.

> The sponsor's own account (used to author gardens and publish config) is a
> separate thing and always full self-custody by the sponsor. This doc is only
> about the explorer.

---

## The axis

Every position trades **safety/deliberateness** against **explorer autonomy /
convenience**. The question each answers is: *who can (re)authenticate the
explorer's account, and how deliberate is it?*

```
more safety / more deliberate  ← ─────────────────────────── →  more autonomy
   (1) sponsor-only     (2) co-sponsor     (3) explorer self-re-auth   (4) full
      [CURRENT]           [deferred]          via passkey [aspirational]  self-custody
```

### (1) Sponsor-only custody — **CURRENT POSTURE**
- **Sponsor holds** the account email + password (in a password manager) and an
  **offline recovery/rotation key** generated at account creation, stored
  offline, handed to the explorer at "graduation."
- **The explorer's device holds only the scoped OAuth session** (the granular
  `like` + `follow` grant). It never sees the password or the recovery key.
- **Re-auth is a sponsor-assisted event.** If the OAuth session's refresh chain
  breaks, the device cannot silently recover — signing in needs the password,
  which the device does not have. So the explorer's "sign back in to like"
  becomes "ask your sponsor to sign you back in."
- **Reading is never gated.** A lapsed session only grays out hearts/follows;
  the garden, the Locker, and sharing keep working.

**Why this is the default.** Bluebird's thesis is deliberate, sponsor-tended
access for someone who may be young or vulnerable. Sponsor-only custody means
the explorer cannot be phished or socially-engineered out of their own
credentials, graduation is a real event rather than a silent drift, and the
sponsor can revoke instantly. The rare sponsor-assisted re-auth is a **feature —
a checkpoint** — not merely a cost.

**The cost we accept, and how we shrink it.** The one downside is availability:
if the session lapses while the sponsor is unreachable, likes/follows pause. We
make that window *basically never happen in normal use* by:
- **Long-lived refresh tokens** (the session persists for weeks–months as long
  as it is used; atproto refresh tokens rotate on every use).
- **Proactive refresh-on-open**: every time the app opens (and before any
  like/follow), the device refreshes the session if the access token is near
  expiry, so an idle-timeout is rarely reached.
- **Honest degrade**, never a lockout: hearts show a gentle "sign back in to
  like" state; nothing about reading changes.

### (2) Co-sponsor custody — *deferred*
A second trusted adult (a co-sponsor, a second DID — already in the deferred
ledger) can also re-auth and re-tend the garden. This removes the single-point
availability failure of (1) without giving the explorer a reusable credential.
Requires the co-sponsor primitive, which is not built.

### (3) Explorer self-re-auth via passkey — *aspirational*
This is the position that's hardest to picture, so concretely:

At graduation the sponsor enrolls a **passkey (WebAuthn) on the explorer's
device**, bound to the account. When the OAuth session lapses, the device
re-authenticates **on its own** — the explorer gets a device-unlock / biometric
prompt, no sponsor needed — and **the account password is still never on the
device**. In practice it feels like "Face/Touch ID to sign back in," and the
explorer is never blocked.

**The trade-offs, plainly:**
- The device now holds a **reusable credential**. If the device is compromised
  or the explorer is coerced, that credential re-authenticates without the
  sponsor.
- Re-auth stops being a deliberate, sponsor-visible checkpoint.
- **It is not buildable today:** passkey-on-PDS is itself an open,
  verify-in-run question — atproto/Bluesky do not expose a shipped passkey
  primitive we can bind an account to yet. So this position stays aspirational
  until that lands, at which point it becomes a per-explorer sponsor choice, not
  a default.

### (4) Full self-custody — *out of scope for the model*
The explorer holds the password outright. This is really "graduated out of
Bluebird" — appropriate as an endpoint of the graduation story, not a mode we
operate.

---

## What would move us along the axis

| Move | Requires | Effect |
|---|---|---|
| 1 → 2 | Co-sponsor / second-DID primitive (deferred) | Removes single-adult availability risk |
| 1 → 3 | Passkey-on-PDS support upstream (verify-in-run) + a per-explorer sponsor opt-in | Explorer self-recovers; weaker deliberateness |
| 3 → 4 | Handing over the password at graduation | Explorer leaves the sponsored model |

Nothing here is age-based — it is custody-based, and every step is a
**sponsor-set, per-explorer** decision, never a global default flip.

---

## Current implementation status

- **Posture (1) is what the code implements.** Explorer OAuth uses the granular
  `like` + `follow` scope; the device stores only the session (sessionStorage,
  ephemeral); the password/recovery key live with the sponsor, off-device.
- **Refresh + refresh-on-open** are implemented to keep re-auth rare.
- **The degrade** ("sign back in to like", garden unaffected) is wired to the
  capability model (`capabilities()` keys on `localOnly`, never on skin).
- **Deferred / verify-in-run:** in-app account *creation* (invite codes + the
  13+ age gate — for now the account is created/linked out of band by the
  sponsor); co-sponsor; passkey-on-PDS; narrowing the OAuth scope to a
  per-collection grant; the family-PDS route for under-13 explorers.

Revisit this doc whenever one of those lands, or whenever the trade-off in the
current posture starts to chafe in real use.
