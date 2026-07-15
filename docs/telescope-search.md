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

## Status

**Built** (rung 2 is live on `/telescope.html`): the reach tier, both gates
(blocklist substring, allowlist whole-word), the label floor on results,
discovery author-bounding, and device-local search-history logging with a visible
"your grown-up can see these" recent-searches list. The search box is hidden when
`tier: 'off'`.

**Verify-in-run / staged:** live `searchPosts`/`getFeed` against the real AppView;
account-synced or remote search history (today the log is on-device — a sponsor
sees it on the device or, later, via the account path).

## What this is NOT (staged)

- The **default lists are seeds**, deliberately modest — a real deployment
  extends them. They are not a maintained, exhaustive moderation list.
- Semantic / obfuscation-resistant matching (leetspeak, euphemism) is out of
  scope by design — see the philosophy. Word/substring matching is the tool.
- Sponsor *approval-first* search (queue queries for review before results) is a
  possible stricter mode; today history is **retroactive** (results show, sponsor
  sees the log). Retroactive fits the trust model; approval-first is a later
  option if a sponsor wants it.
