# RUN-DISCOVER — SUMMARY (D1: My Sky)

`Date: 2026-07-15. Branch: claude/skylite-directives-runs-rihei2 (from main).
First slice of RUN-DISCOVER: My Sky (device-local follows). Telescope (approved
feeds) is staged, not built — see "Staged" below.`

> Note: the detailed RUN-DISCOVER instruction set was given in-session and is not
> checked into the repo. This D1 is **reconstructed** from the in-repo
> scaffolding that plainly anticipates it — the `getLocalFollows`/`setLocalFollows`
> slot ("My Sky, RUN-DISCOVER D1"), the granted `repo:ing.croft.skylite.follow`
> OAuth scope, the `canFollowLocally`/`canPersistFollows` capabilities, and the
> `renderQuoted` comment ("the only deliberate path in is follow-to-My-Sky, added
> in RUN-DISCOVER"). Owner course-correction welcome.

**Gate: full `npm test` green — lint · typecheck · unit · build · 79 e2e.**

## What D1 delivers

**My Sky** — the explorer's OWN pick of voices, distinct from the sponsor's
garden. It is device-local in **every** mode (no account required): the follow
DID list on the device is the whole source, and My Sky reads it through the
**exact garden path** (inclusion → `getAuthorFeed` → merge → label floor →
`renderPost`), so it inherits the garden's safety posture unchanged — label
floor, no counts, gated links.

- **Follow lexicon** `ing.croft.skylite.follow` — a record in the explorer's OWN
  repo (never the sponsor's), mirroring `app.bsky.graph.follow` (subject DID +
  createdAt), so a follow → mainline conversion stays possible later.
- **`src/social/follows.ts`** — the device-local follow set (add/remove/is, the
  My Sky source in every mode) + account-mode `followActor`/`unfollowActor` that
  ALSO persist/delete the record when a session exists, with a `did → recordUri`
  index for one-tap unfollow. Mirrors `likes.ts`.
- **Follow control** on every post (`＋ Follow` / `✓ In My Sky`) — acts on the
  author DID, available in every mode (`canFollowLocally` is always true).
  Optimistic toggle, reverts on a failed record write. Threaded through the
  garden render exactly like the like control.
- **My Sky page** `/mysky.html` — reuses `mountGarden` over an inclusion built
  from the followed DIDs; empty state until you follow someone; unfollowing there
  re-reads and drops the author. New topbar "My Sky" link.

## Invariants preserved

- **Capability, not skin:** following keys on `canFollowLocally` (always) /
  `canPersistFollows` (account) — never on `skin`.
- **Label floor everywhere:** My Sky runs the same `filterByLabels` as the
  garden — a labeled post never appears, on any surface.
- **No counts**, anywhere, in any mode.
- **Sponsor's repo is untouched:** follow records live only in the explorer's
  own repo.

## Tests

- **Unit** (`follows.test.ts`): the record shape + the device-local set
  (add/dedup/remove/is) via an in-memory localStorage.
- **E2E** (`mysky.spec.ts`, hermetic): follow in the garden → appears in My Sky
  (read by DID, **no account**); empty state; unfollow in My Sky drops the
  author. `getAuthorFeed` is served from fixtures for both handle and DID actors.

## Staged — the rest of RUN-DISCOVER

- **D2 persisted-follow verify-in-run:** the `followActor` record write path is
  built and unit-shaped, but writing to a real PDS needs a live OAuth session
  (can't be hermetic) — same verify-in-run status as likes.
- **Telescope (approved feeds):** the config already carries `approvedFeeds` and
  the `telescope` switch; the discovery-rung UI that browses approved feeds under
  the navigation wall is the next slice, not built here.
- **Follow-to-My-Sky from a quoted/outside author:** the follow control currently
  rides the post action row (garden authors). Surfacing it on an inert quoted
  author (the `renderQuoted` navigation-wall path) is a small follow-up.
- **My Sky display names:** My Sky addresses follows by DID (the feed hydrates
  the author per post); persisting a friendly name at follow time is optional
  polish.
