# RUN-05 — Care features (Phase 4) — SUMMARY

`Date: 2026-07-14. Branch: claude/skylite-v1-build-plan-heoxq4 (restarted from main
after PR #3 merged). Instruction: plans/2026-07-14-RUN-05-care-features.md.
Phase 4 of the v1 build plan.`

## What shipped

The three care features — Scrapbook, the out-of-band help handoff, and the honest
"how it works" view — completing the v1 feature set (bar the deferred OAuth
write). Still backendless, still zero runtime deps.

### Scrapbook (D4) — `src/scrapbook/`

- `clip.ts` — pure `clipFromPost` (author, text, first image thumb, note, time).
- `store.ts` — IndexedDB store (`skylite-scrapbook`), graceful no-op when IDB is
  unavailable. save / remove / list (newest-first) / savedUris.
- **"☆ Save / ★ Saved"** toggle on every post (`src/render/post.ts`); the garden
  marks already-saved posts on load.
- `page.ts` + `scrapbook.html` — the saves list with a private, persisted note per
  clip and Remove. Header states plainly it's local-only and lost if deleted.

### "Something's wrong" handoff — `src/care/handoff.ts`

- One-tap calm dialog → **prefilled `mailto:`** to the trusted adult. No platform
  reporting, no telemetry, nothing sent automatically. Without a configured
  contact it shows gentle guidance instead.
- Contact is an optional `help` field on the config record (`contactName` /
  `contactEmail`), authored on the guardian page; the child device reads it from
  the cached/local config in any gate state. Reachable from the topbar "Get help"
  button and the "how it works" page.

### "How Skylite works" — `help.html` + `src/help.ts`

Honest, kid-appropriate explainer: what she sees + why, what the guardian can do,
and **public** (posts, on Bluesky) vs **private** (Scrapbook + notes, on-device).

### Plumbing

- `ing.croft.skylite.config` lexicon + types + parser gained the optional `help`
  object.
- Topbar nav (Garden / Scrapbook / How it works) + "Get help".
- `build.mjs` generalised to an N-page list (index, guardian, scrapbook, help);
  SW precache covers all four pages.

## Dependencies

**Runtime: still none.**

## Verification

Full `npm test` gate green:

- `lint` clean · `typecheck` clean.
- **unit: 71 passed** (+8: clip extraction, mailto builder, help parsing).
- `build` emits 4 pages + SW (precache 14).
- **e2e: 30 passed** (+6: scrapbook save/note/remove + garden reflect, handoff
  with/without contact + dismiss, "how it works" content).

Screenshots confirmed the handoff modal and the Scrapbook in a browser.

## v1 status

Feature-complete except the **guardian OAuth direct-write** (Phase 2 remainder),
still deferred pending a real guardian account. Garden, guardian config + local
authoring, PWA hardening, and care features are all shipped.
