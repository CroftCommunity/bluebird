# RUN-05 — Care features (Phase 4)

`Date: 2026-07-14. Branch: claude/skylite-v1-build-plan-heoxq4 (restarted from main
after PR #3 merged). Phase: 4 of the v1 build plan. Status: executed —
see RUN-05-SUMMARY.md.`

## Goal

The three care features that complete the v1 feature set, each usable by a kid
without help.

## Scope covered (build plan Phase 4)

- **Scrapbook (D4)** — local IndexedDB clip store. "☆ Save" on any post; a
  private per-clip note; a Scrapbook page listing saves; the garden reflects which
  posts are saved. Plainly labelled local-only ("stays even without internet, but
  it is gone if Skylite is deleted") — anti-decoy.
- **"Something's wrong" button** — one tap opens a calm handoff to the trusted
  adult via a **prefilled `mailto:`**. No platform reporting, no telemetry,
  nothing sent automatically. Reachable from the topbar in every gate state
  (garden, paused, stale) and from the "how it works" page.
- **"How Skylite works"** — an honest explainer: what she sees and why, what the
  guardian can do, and what is **public** (the posts, on Bluesky) vs **private**
  (the Scrapbook + notes, only on this device). No repo of her own exists in v1,
  so it teaches the network's shape rather than listing records.

## Decisions applied

- **D4 local-only** Scrapbook (IndexedDB), stated plainly in the UI — as the plan
  and CONCEPT.md cross-check require.
- The trusted-adult contact is an **optional `help` field on the guardian config
  record** (`contactName` / `contactEmail`), set on the guardian page. With no
  contact set, the handoff shows gentle guidance instead of a mailto.

## House rules honored

- No new runtime dependencies (still zero). Scrapbook uses the platform's
  IndexedDB directly; the handoff is a plain `mailto:` anchor.
- CSP unchanged for the garden; the new `scrapbook.html` / `help.html` ship
  tight per-page CSPs (`connect-src 'self'`; scrapbook allows `cdn.bsky.app`
  images for saved thumbs).
- Idea-capture files untouched. `build.mjs` generalised to an N-page list.

## Acceptance (build plan Phase 4)

- Scrapbook: save → appears with a private note that persists → remove. ✅ (e2e)
- "Something's wrong": one tap → prefilled mailto handoff (or guidance). ✅ (e2e)
- "How it works": public-vs-private explained, help reachable. ✅ (e2e)
- Full `npm test` green: **71 unit + 30 hermetic e2e**. ✅

## v1 status after this run

The build-plan feature set is complete except the **guardian OAuth direct-write**
(Phase 2 remainder) — still deferred, since it needs a real guardian account to
build and verify. Everything else (garden, guardian config + local authoring,
PWA hardening, care features) is shipped and deployable.
