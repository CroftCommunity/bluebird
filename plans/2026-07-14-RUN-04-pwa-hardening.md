# RUN-04 — PWA hardening (Phase 3)

`Date: 2026-07-14. Branch: claude/skylite-v1-build-plan-heoxq4 (restarted from main
after PR #2 merged). Phase: 3 of the v1 build plan. Status: executed —
see RUN-04-SUMMARY.md.`

## Goal

Harden Skylite as an installable PWA — the IDEAS.md §4 list, minus auth (there is
no session to protect, so the "login vanishing" items don't apply to v1).

## Scope covered (build plan Phase 3)

- **Service worker** with `skipWaiting` + `clients.claim`, generated at build with
  a **precache manifest keyed to the exact build** (so it always matches the
  hashed assets). App-shell HTML is **network-first** (a shipped update is picked
  up next open); content-hashed assets are cache-first; Bluesky blob images and
  feed/config reads are cached so the garden survives offline.
- **Visible version stamp** — already present since Phase 0; the SW cannot strand
  it (network-first HTML). Asserted in e2e.
- **Offline cache** of posts + blob images, with the D5 "showing saved posts"
  banner now also shown when the device itself is offline.
- **Background lock (D6)** — `visibilitychange` / `pagehide` lock the garden when
  Skylite backgrounds; re-entry requires a device PIN (SHA-256 hashed, local
  only). No session behind it — literally a lock on Skylite's own door.
- **Real launch** — `apple-touch-startup-image` splash set (portrait, generated),
  maskable icons (manifest), `theme-color`, status-bar style.

## Decisions applied

- **D6 PIN-first** (the plan default). The PIN is set on the guardian page
  (§5 "Device lock"), stored as a SHA-256 hash; platform-authenticator WebAuthn
  is left as a later nicety. Plain window `blur` is intentionally **not** a lock
  trigger (it fires on incidental focus loss); `visibilitychange` is the reliable
  iOS backgrounding signal.

## Notes / limitations

- The `@live` splash coverage is a representative device set; unmatched devices
  fall back to no splash (harmless).
- Hermetic e2e blocks the service worker by default (its own `fetch()` bypasses
  `page.route` mocks); the `pwa` spec re-enables it to exercise the SW directly.

## Acceptance (build plan Phase 3)

- Airplane-mode iPad shows the cached garden with banner — SW caches feed/blob
  reads + offline banner wired (hermetic coverage of the banner + SW registration;
  true airplane-mode is an on-device check).
- Backgrounding locks — hermetic e2e (visibilitychange → PIN lock → unlock). ✅
- A deployed update is picked up on next open with the new stamp — network-first
  HTML + build-keyed SW cache; stamp asserted post-SW. ✅
- Full `npm test` green: **63 unit + 24 hermetic e2e**. ✅

## Still deferred

- **Guardian OAuth direct-write** (Phase 2 remainder) — sign-in + `putRecord`
  into the guardian's PDS. Needs a real guardian account to build/verify safely.
- Care features (Scrapbook, "something's wrong", "how Skylite works") — Phase 4.
- Auth-related §4/§5 items — not applicable until Skylite gates reads or writes.
