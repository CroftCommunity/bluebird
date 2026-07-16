# Telescope search — the trust gradient

Telescope has two rungs. **Rung 1** (shipped) browses the sponsor's *approved
feeds* — bounded by curation. **Rung 2** is *search*, and search is where the
ceiling comes off: an explorer can type a query and reach authors nobody vetted.

This doc is the model for rung 2. It is a **sponsor-set trust gradient**, not a
single on/off switch, because the right amount of reach for an 11-year-old is
not the right amount for a 16-year-old — and the sponsor is the one who knows.

## Philosophy: a shield, not a locked room

Skylite is not trying to build a room no one can ever climb out of. That's
turtles-all-the-way-down, and it's not the point. The point is a **shield** for
someone the sponsor *trusts* and *wants* to let explore — hobbies, subjects,
interests — on terms both people understand.

So the safeguards here are held to a different bar than "foolproof":

- They are **effective**, not impregnable. A blocklist a determined teenager can
  word around is still worth having — it keeps the accidental and the casual out,
  which is most of the risk, most of the time.
- When a safeguard *is* overcome, we prefer to **leave an indicator** (the
  sponsor can see what was searched) over pretending it can't happen.
- The floor is real and non-negotiable: the **label floor** (no adult/graphic
  content, ever) applies under every tier, at every setting.

Calling the blocklist "security theater" undersells it. It isn't theater — it's
harm reduction with an honest ceiling on its own guarantees.

## The reach tier (`search.tier`)

One sponsor-set value per explorer:

| tier | reach | who it's for |
|---|---|---|
| `off` | no search; approved feeds only | youngest / default |
| `discovery` | search **bounded to authors the approved feeds already surface** | middle — "find that post about volcanoes in my feeds" |
| `open` | search the whole network | older, trusted — "yes, it's open" |

`discovery` introduces **no new author exposure** beyond rung 1 — it just makes
rung-1 content queryable. `open` is the real widening, and it is the tier that
most wants the accountability layer (history) turned on.

## The layered safeguards (independent, can combine)

All of these run *under* whichever tier is set. Two of them (allowlist,
blocklist) can be active at the same time.

- **Label floor** — always on. The conservative baseline (`HIDE_LABELS`): a
  label-bearing result never renders, on any surface, at any tier. Non-negotiable.
- **Blocklist** (negative gate, `useBlocklist`, default **on**) — a seeded
  default list of bad query terms, **sponsor-extensible** (`blocklistExtra`). A
  query containing a blocked term is refused before it's sent. Errs *protective*
  (substring match — may over-block). Effective, not foolproof.
- **Topic allowlist** (positive gate, `useAllowlist`, default **off**) — **one
  seeded default list** of safe topics, **sponsor-extensible** (`allowlistExtra`).
  When on, a query must match an allowed topic to run. Errs *permissive within
  topics* (word match). Turning it off means you rely on the blocklist alone;
  both may be on together (permit iff *matches allowlist* **and** *not blocked*).
- **Search-history logging** (`logHistory`, default **on**) — the "they'll know"
  indicator. Queries are visible to the sponsor. This is the accountability layer
  that makes `open` reasonable: not prevention, but a shared, honest record.

## Defaults (a new explorer)

```
search = {
  tier: 'off',            // no open search until the sponsor opts in
  useBlocklist: true,     // the cheap protective gate is on by default
  blocklistExtra: [],
  useAllowlist: false,    // topic-gating is opt-in (it's the strictest)
  allowlistExtra: [],
  logHistory: true,       // transparency on by default
}
```

Legacy records with the old boolean `telescope: true` migrate to
`tier: 'open'` (and `false` → `off`), with the other fields taking the defaults
above.

## Encrypted history archive (privacy in public)

Search history is sensitive — a young explorer's queries. Syncing it to the
sponsor must not leave those terms in clear text on the public AppView. The model
(owner-ruled):

- **Sealed box.** The sponsor's device generates an ECDH P-256 keypair. The
  **public** key travels the existing sponsor→explorer channel (the config
  record; published only when the archive is turned on). The explorer's device
  seals **the whole payload** (query + blocked + tier + the precise time) to that
  public key — ECDH → HKDF-SHA256 → AES-256-GCM, a fresh ephemeral key per message
  (`src/crypto/sealedbox.ts`) — and writes the ciphertext to her own public repo.
  She can seal but never open. On the public AppView it is inert; lose the
  sponsor's private key and the archive is unrecoverable trash — an accepted
  cost, and the point.
- **Encrypt everything.** Not just the term — `blocked`, `tier`, and the precise
  time (`at`, epoch ms) too — so even "a blocked search happened at 3pm" is
  unreadable without the key.
- **The sponsor's private key is protected by the device's WebAuthn** (passkey /
  PIN / biometric) via the PRF extension: the authenticator derives a stable
  secret on unlock that wraps the private key at rest, so a stolen sponsor
  device/localStorage still can't read the archive. A passphrase (PBKDF2, high
  iterations) is the fallback where PRF is unavailable. This is where a "high
  work factor" actually applies — protecting the private key, not the public
  ciphertext (whose margin is the P-256/AES-256 strength itself).
- **Honesty copy** becomes: your sponsor can read what you searched; it's stored
  scrambled so no one else can read what you searched. (The scope is deliberately
  *what*, not *whether* or *when*.)
- **Retention:** last 30 days, max 500 (local log and the synced records).

### Metadata (what a public reader can still see)

The sealed records are ordinary public rows in the explorer's repo, so three
facts are readable by anyone, even though the content is not:

- that a search record **exists**,
- the running **count** of them,
- and the **calendar day** each was written — the record-level `createdAt` is
  rounded to the UTC day (`00:00:00.000Z`).

Sealed inside the ciphertext — unreadable without the sponsor's private key — are
the query **content**, its **blocked** status, the **tier**, and the **precise
time** (`at`, epoch ms). The sponsor's decrypted timeline uses that inner `at`;
records written before the day-rounding landed carry no inner `at` and fall back
to their record `createdAt` on decrypt (a tolerant read).

### User-facing language (owner-ruled)

Sponsor/explorer copy MAY call this **bank-grade encryption** — it is honest: the
same primitives (AES-256 + P-256) as the TLS a bank uses. The precise scheme is
this document. **HARD RULE:** no user-facing copy anywhere may claim the archive
is *unbreakable*, *impossible* to read, or that *no one can ever* see it. The
honest shape is always "so no one else can read what you searched."

## Status

**Built** (rung 2 is live on `/telescope.html`): the reach tier, both gates
(blocklist substring, allowlist whole-word), the label floor on results,
discovery author-bounding, and device-local search-history logging with a visible
"your sponsor can see these" recent-searches list. The search box is hidden when
`tier: 'off'`.

**Encrypted archive — COMPLETE (phases 1–3):**
- sealed box (#19); sponsor key vault (#20);
- config exchange + sealed-record write (#21): `search.auditPubKeyJwk` is
  published in the config; when present and the explorer has an account, each
  attempt is sealed to it and written to `ing.croft.skylite.search` in the
  explorer's own repo (best-effort, mirroring likes/follows), 30-day/500 retention;
- sponsor enables the archive (#22): create/reuse the audit keypair, publish the
  public key;
- **sponsor audit-view decrypt (#23):** the audit page reads the explorer's
  sealed records (public `listRecords`, handle→DID), unlocks the vault on the
  sponsor device, and decrypts to a per-explorer timeline (query · when · blocked
  · tier). A record it can't open is skipped; a wrong passphrase reads nothing.

The **WebAuthn-PRF** path (passkey / PIN / biometric) is now wired into the
sponsor UI (enable-with-passkey; audit-unlock-with-passkey, no passphrase) and
covered end-to-end by a Playwright **virtual-authenticator** e2e — enable → seal
→ unlock → decrypt.

**Verify-in-run / staged:** live `searchPosts`/`getFeed`/`resolveHandle`/PDS reads
and the real PDS record write against the live network + OAuth consent; real
biometric hardware (the virtual authenticator covers the PRF flow; the passphrase
path is fully hermetic); repo-side retention pruning (today the 30-day/500 policy
prunes the on-device log).

## What this is NOT (staged)

- The **default lists are seeds**, deliberately modest — a real deployment
  extends them. They are not a maintained, exhaustive moderation list.
- Semantic / obfuscation-resistant matching (leetspeak, euphemism) is out of
  scope by design — see the philosophy. Word/substring matching is the tool.
- Sponsor *approval-first* search (queue queries for review before results) is a
  possible stricter mode; today history is **retroactive** (results show, sponsor
  sees the log). Retroactive fits the trust model; approval-first is a later
  option if a sponsor wants it.
