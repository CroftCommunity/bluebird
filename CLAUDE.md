# Bluebird — agent orientation

## Identity (workspace architecture)

**Scope:** Bluebird — a gentle, read-first window into Bluesky (no algorithm, ads, counts,
or strangers; a sponsor tends a garden). Served at `bluebird.croft.ing`. Also the
**origin of the workspace's hand-rolled atproto OAuth client** (`src/atproto/oauth/` —
PAR + PKCE + DPoP, zero dependencies), registered prior art in
`CroftC/.claude/DECISIONS.md`.
**Not this repo:** the standards site and its documented port of this OAuth module
(croft-pwa); anything calling-related (connect / croft / croft-stack).
**Provides:** the Bluebird PWA; the reference atproto OAuth implementation others port.
**Consumes:** the public Bluesky AppView.
Card + altitudes: `CroftC/.claude/ARCHITECTURE.md`.

**Naming — read this before editing docs.** Renamed **Skylite → Bluebird**: the product
in PR #35 (`RUN-BLUEBIRD` — lexicons `ing.croft.bluebird.*`, pages renamed
telescope→trailmap, saves→locker, sponsor→patrol, mysky→my-mountain, guide→ski-school,
mountain palette, `bluebird.croft.ing`), and the **repo, remote, and directory on
2026-08-26** (`CroftCommunity/bluebird`; GitHub redirects the old URL, but use the new
one). The frozen historical seed (CONCEPT / IDEAS / PROVENANCE / seeds, old RUN
summaries) is preserved verbatim and deliberately still says Skylite — do not "fix" it.

## Layout

- `src/atproto/oauth/` — the OAuth client (client · dpop · jose · pkce · resolve). Treat
  as reference: croft-pwa ports it, and `docs/ATPROTO.md` there points back here.
- `oauth/client-metadata.json` — the hosted OAuth client metadata for
  `bluebird.croft.ing` (a served artifact, not source).
- `tests/e2e/` hermetic suite · `tests/live/` real-AppView smoke via
  `playwright.live.config.ts` (local only, never in push CI —
  `CroftC/.claude/WEB-TESTING.md`).

## Gate

`npm test` (lint · typecheck · unit · build · e2e). Live smoke: `npm run e2e:live`.

Known drift, low priority: `@playwright/test` declares `^1.49.1` while the lockfile
resolves the canonical `1.61.1`. The declared range is stale, the running version is
correct; align the range when next touching `package.json`
(`CroftC/.claude/WEB-TESTING.md` — the range is the policy, the lockfile is the pin).

## Concurrent sessions (workspace norm)

Multiple agent sessions share the `CroftC/` workspace. Do multi-turn work in a dedicated
worktree — `git -C bluebird worktree add ../worktrees/bluebird/<slug> -b claude/<slug>` —
never in this checkout (peer sessions stage with `git add -A`; loose files get swept into
unrelated commits). Contested surfaces here: **landing on `main`** (a push deploys
`bluebird.croft.ing`) and the OAuth module, which other repos port from. Open PRs live
upstream — check `gh pr list` before assuming a branch is abandoned. Full protocol and
the reasons behind it: `CroftC/.claude/COORDINATION.md`.
