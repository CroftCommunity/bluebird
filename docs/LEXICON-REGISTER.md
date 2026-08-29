# The `ing.croft.bluebird.*` register

Bluebird defines four record types of its own. This file exists because minting an
atproto record type is cheap and permanent: a custom type that duplicates an official one
is a fork of the network wearing a namespace, and nothing breaks loudly when you do it —
the data simply sits in a drawer only this app can read.

Rule and its reasoning: `CroftC/.claude/LEXICONS.md`. Audit checks 41+42 require this file
and require every minted type to appear in it.

Every entry answers three questions. The third is the only one that costs anything:

- **Holds** — what goes in the drawer
- **Why ours** — why an existing type would not do
- **Ecosystem check** — *which existing types were actually opened and looked in*

Namespace: `ing.croft.*` is the reverse of **croft.ing**, which the project controls.
**Not yet published:** `_lexicon.croft.ing` has no TXT record (measured 2026-08-29 against
`1.1.1.1`), so nothing outside this app can resolve these NSIDs. That is a stage, not a
destination — see `CroftC/.claude/LEXICONS.md` § 2 and the TODO below.

---

## ing.croft.bluebird.config

**Holds:** the sponsor-authored control record for one explorer's device — the two
switches (`localOnly`, `skin`), the pause switch, channels of curated accounts, curated
friends, approved feeds, the search trust-gradient, and the staleness budget. One record
per explorer at a random rkey, in the **sponsor's** repo, read publicly and unauthenticated
by the explorer's device. It deliberately carries no age, birthday, school or location.

**Why ours:** it is a record **authored by one person to configure another person's
client**, publicly readable, which the subject cannot edit. Nothing in atproto models a
delegated-custody relationship of that shape. Every configuration type in the ecosystem is
self-authored and describes its own author.

**Ecosystem check (2026-08-29):**

| Candidate | What it holds | Why it does not fit |
|---|---|---|
| `app.bsky.actor.profile` | your own display name, avatar, description | self-authored and about yourself; no notion of a second party setting it |
| `app.bsky.actor.defs#preferences` (via `getPreferences`) | your own client preferences, incl. moderation | not a record at all — private, per-account, and unreadable by anyone else, which is the opposite of the public-read this record needs |
| `app.bsky.graph.list` + `listitem` | a curated list of **people** | the closest fit for `channels`, and it holds only accounts: no toggle, no policy, no switches, no search gradient. Bluebird would still need a record to say which lists are on |
| `app.bsky.graph.listblock` / `app.bsky.labeler.service` | moderation applied to yourself / a labelling service | both are self-applied or service-scoped; neither delegates control of one account to another |

**The gap, stated as a pattern rather than an absence:** across the official lexicons,
*configuration is always reflexive* — a record describes or configures its own author.
Bluebird needs the opposite, and the opposite is what makes custody possible.

## ing.croft.bluebird.search

**Holds:** one Telescope search attempt, **sealed** to the sponsor's audit public key
(ephemeral ECDH P-256 → HKDF → AES-256-GCM). Query, blocked-or-not, and the precise time
all ride inside the ciphertext. Only `tier` and a **day-rounded** `createdAt` are cleartext,
so a public reader learns that a search happened on a day and nothing more.

**Why ours:** an accountability record that is public-by-storage and private-by-encryption,
written by one party and readable only by a second. atproto has no encrypted-record
convention at all — the closest thing in the ecosystem is DMs, which are not repo records.

**Ecosystem check (2026-08-29):**

| Candidate | What it holds | Why it does not fit |
|---|---|---|
| `chat.bsky.*` | direct messages | not repo records; served by a separate service with its own access model, and not addressable as an audit trail |
| `com.atproto.moderation.createReport` | a report to a moderation service | a report is about someone else's content and goes to a service, not a per-device audit log kept for one named reader |
| `tools.ozone.moderation.*` | a moderator's actions and events | service-side, requires an Ozone instance, and models moderation of a network rather than custody of a device |
| any official record with an encrypted payload | — | none exists; the ecosystem has no sealed-record pattern to follow |

**Worth flagging beyond this repo:** "a record anyone can store and only one party can
read" is a general shape, and inventing it privately is how two apps end up with two
incompatible sealed-box formats. `CroftC/.claude/LEXICONS.md` § 3 (socialize) applies here
more than to any other type on this page.

## ing.croft.bluebird.follow

**Holds:** an explorer's follow of an actor — a subject DID plus `createdAt` — in the
**explorer's own** repo. The sponsor cannot delete it; the explorer can.

**Why ours: NOT ESTABLISHED — see below.** This is a declared mirror of
`app.bsky.graph.follow`, field for field.

**Ecosystem check (2026-08-29): the official type FITS, and that is the finding.**
`app.bsky.graph.follow` holds exactly `subject` (a DID) and `createdAt`. The lexicon's own
description says it "mirrors" it, and gives one forward-looking reason — that "a follow →
mainline conversion tool is possible later", which is a reason for keeping the *shape*, not
a reason for declining the *type*.

**No recorded reason for the duplication exists in this repo.** Searched
`docs/custody.md`, the README, and the run summaries: `custody.md` says an explorer's
account exists precisely so "hearts and follows become real, public records", which if
anything argues for the mainline type. There are plausible reasons — chiefly that a minor's
follows appearing in the global social graph is a real consequence, and a private namespace
keeps them out of the AppView — but **plausible is not recorded**, and a register entry that
invents a justification is worse than one that admits the gap.

**So this is filed as a question, not a verdict.** If the reason is graph invisibility, it
belongs here in one sentence and the type stays. If there is no reason, this type and
`ing.croft.bluebird.like` should be retired in favour of the official ones, which costs
nothing today and buys interoperability with every other client. TODO below.

## ing.croft.bluebird.like

**Holds:** an explorer's like of a post — a `com.atproto.repo.strongRef` subject plus
`createdAt` — in the explorer's own repo.

**Why ours: NOT ESTABLISHED.** Identical situation to `ing.croft.bluebird.follow`, and it
resolves the same way. `app.bsky.feed.like` holds exactly the same two fields, and this
lexicon says it "mirrors" it.

**Ecosystem check (2026-08-29):** `app.bsky.feed.like` fits field for field. Note that a
sibling repo made the opposite call on the same question: forage's lens substrate writes a
**real `app.bsky.feed.like`** for a boost rather than minting `fyi.forage.vote`, and its
register records that as the rule working in the direction it is meant to. Two repos in one
workspace answering one question two ways is exactly what this register exists to surface.

---

## Owed

- **Publish the namespace** (`CroftC/.claude/LEXICONS.md` § 2). `_lexicon.croft.ing` has
  no TXT record, so no other client can resolve `ing.croft.*`. The worked example, verified
  2026-08-29: `_lexicon.recipe.exchange` → `did:plc:4cx7…` → four
  `com.atproto.lexicon.schema` records whose rkeys are the NSIDs. This is croft.ing-wide
  work, not bluebird's alone — `ing.croft.*` is minted in at least four repos.
- **Answer the `follow`/`like` question**, above. Either record the reason for the
  duplication or retire both types for the official ones. It is much cheaper now than after
  explorers hold records.
- **Socialize the sealed-record shape** (§ 3) before `ing.croft.bluebird.search` carries
  real audit trails.
