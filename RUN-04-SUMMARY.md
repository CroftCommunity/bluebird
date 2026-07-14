# RUN-04 — PWA hardening (Phase 3) — SUMMARY

`Date: 2026-07-14. Branch: claude/skylite-v1-build-plan-heoxq4 (restarted from main
after PR #2 merged). Instruction: plans/2026-07-14-RUN-04-pwa-hardening.md.
Phase 3 of the v1 build plan.`

## What shipped

Skylite is now a hardened installable PWA: it caches for offline, locks on
background, and guarantees the child runs the build we shipped. Still backendless,
still zero runtime deps.

### Service worker (`build.mjs` generates `dist/sw.js`)

- Generated at build time with a **precache manifest keyed to this exact build**
  (`CACHE = skylite-<version>`), so it can never drift from the hashed assets.
- `skipWaiting` + `clients.claim` on install/activate; old caches purged.
- Fetch strategy:
  - **App-shell HTML → network-first** (a shipped update is picked up next open;
    cached shell is the offline fallback). Directly serves the IDEAS.md §4
    "guarantee she runs the build you shipped" requirement.
  - Content-hashed same-origin assets → cache-first.
  - Bluesky blob images (`cdn.bsky.app`) → cache-first (pictures survive offline).
  - Feed / config reads (`/xrpc/…`) → network-first with cache fallback (offline
    garden).
- Registered from both pages via `src/pwa/register.ts` (`updateViaCache: 'none'`).

### Background lock — D6 (`src/lock/`)

- `pin.ts` — PIN stored only as a **SHA-256 hash** (`crypto.subtle`), never plain.
  Set/clear from the guardian page (§5 "Device lock").
- `backgroundLock.ts` — `visibilitychange` / `pagehide` lock the garden when a PIN
  is set; a full-screen PIN overlay gates re-entry. Plain `blur` is deliberately
  not a trigger (spurious). No session behind the gate — a pure local door lock.

### Launch polish

- `apple-touch-startup-image` splash set (6 portrait sizes, generated as real PNGs
  by `tools/gen-icons.mjs`), maskable icons (manifest), `theme-color`,
  `apple-mobile-web-app-status-bar-style`, `mobile-web-app-capable`.
- Offline banner now also shows when `navigator.onLine` is false.

### Guardian page addition

Section 5 "Device lock (PIN)" — set/remove the local PIN (hashed).

## Dependencies

**Runtime: still none.**

## Verification

Full `npm test` gate green:

- `lint` clean · `typecheck` clean.
- **unit: 63 passed** (+5: PIN hash/roundtrip).
- `build` emits `dist/sw.js` (precache 10) + splash set; cache name
  `skylite-v1_0.1.0+<sha>`.
- **e2e: 24 passed** (+4: SW registers/activates, shell+stamp after reload,
  background-lock PIN unlock, no-lock-without-PIN).

Screenshot confirmed the PIN lock in a browser.

## Acceptance (Phase 3)

- Backgrounding locks; correct PIN unlocks. ✅ (hermetic e2e)
- Deployed update picked up next open with the new stamp (network-first HTML +
  build-keyed SW). ✅
- Offline cached garden + banner wired (true airplane-mode is an on-device check).

## Still deferred

- Guardian OAuth direct-write (Phase 2 remainder) — needs a real guardian account.
- Care features — Phase 4 (Scrapbook, "something's wrong", "how Skylite works").
