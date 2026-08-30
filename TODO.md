# TODO — bluebird

> Known work only — items whose shape is already decided, and which may therefore be
> proposed as work. Anything still an open question (decide / verify / investigate /
> reconcile) belongs in the backlog of record, `discovery/alpha/ROADMAP_TODO.md`,
> however small or operational it is. Tracking scheme: `CroftC/.claude/TRACKING.md`;
> the two piles and why: its § "Two piles". Cross-reference E-numbers where an item
> here implements a backlog row.

Started 2026-08-29 with the first gap the workspace design standard recorded against
this repo; earlier deferrals live in `IDEAS.md` and the `RUN-*-SUMMARY.md` files.

## Design standard gaps (croft-pwa/docs/DESIGN.md)

- [ ] **Sign-in copy: the noun is "atmo provider", not Bluesky.** `src/social/like-ui.ts`
  says *Your Bluesky handle* and `src/sponsor.ts` *Sign in with Bluesky* for a field that
  takes a handle on any host; `src/sponsor.ts` also says *PDS host (optional)*. Use the
  sheet's words and the verbatim gloss (DESIGN.md § Copy). Workspace audit check 44 FLAGs
  this until it changes.
- [ ] **Adopt the sign-in flow.** Both surfaces (sponsor page, explorer banner) are
  handle-only with no provider registry and no Create. Adopt the pattern in DESIGN.md
  § Flows › Sign in — registry with probed posture + live drift check, two panels split by
  posture, Create only where signups are open, the handle seam; reference
  `croft-pwa/src/signin/`. The container is this repo's call (page or sheet); the copy,
  registry and both-direction Create rule are not. Check 44 NOTEs the missing registry.
