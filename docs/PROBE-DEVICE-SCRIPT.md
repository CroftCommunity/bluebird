# Device probe script — Phase 0 gates (D1–D6)

Branch-only companion to the throwaway `probe.html` harness. Drives one iOS
device session that answers every Phase 0 gate. See the plan
`plans/2026-07-23-1-plan-pwa-hardening-ios.md` (Phase 0 / Phase 0-prep) for why
each gate matters. This file and the probe never merge to `main`.

## Preconditions

- [ ] A real iOS device, **iOS 18.4+** (PRF floor; earlier had data-loss bugs).
- [ ] **iCloud Keychain ON** (Settings → [name] → iCloud → Passwords) — required
      for a platform passkey to enroll and for PRF. (This is also gate **D6**:
      note whether enrollment hits an Apple-ID friction wall.)
- [ ] The preview is deployed: open the PR, use the `skylite.croft.ing/pr-preview/pr-<N>/probe.html`
      link from the preview comment.
- [ ] Desktop-Safari baseline already passed (A4): the page loads, D1 stamps
      render, Simulate→Wrap→Unwrap shows `OK`, and Enroll works in a tab. This
      isolates the one on-device unknown to **standalone vs tab**.

## Install to home screen (standalone)

1. Open the `…/pr-preview/pr-<N>/probe.html` URL in **Safari** on the device.
2. Share → **Add to Home Screen** → Add.
3. Launch from the **home-screen icon**. Confirm the header reads
   `standalone (installed)` and `WebAuthn: yes`. If it says `browser tab`, iOS
   did not launch standalone — stop and note it (this alone would answer D5's
   standalone question negatively).

## D1 — sessionStorage wipe vs localStorage survival

1. Tap **Stamp both stores**. Both panes show `{"n":1,...}`.
2. Open the app switcher and **swipe-kill** the probe. (For extra certainty,
   also reboot the device.)
3. **Relaunch cold** from the home-screen icon. Read the two panes at boot.

| Observation | Meaning |
|---|---|
| sessionStorage `(empty)`, localStorage keeps `{"n":1}` | premise confirmed — proceed with Phase 1b as written |
| both `(empty)` | localStorage also unreliable — degrade backstop is load-bearing; escalate D2 |
| sessionStorage kept the value | premise wrong — re-scope Phase 1b, hunt the real cause |

Record: D1 = ____________  (session: ____ / local: ____)

## D5 — WebAuthn PRF, real secret, cross-launch round-trip

1. Tap **Enroll passkey (PRF)** → Face ID / Touch ID fires. `material` shows a
   64-hex-char PRF secret. (If it does not prompt biometrics → note.)
2. Tap **Get PRF ×2 + inspect**. Read `PRF inspect`:
   - `enabled=` (either value is fine — `enabled` is meaningless on its own)
   - `first=…B` must be **present, 32B** (absent = the hmac-secret trap → no-PRF)
   - `stable=YES` (NO = unstable within a session → do not persist)
3. Tap **Wrap test blob**. `wrapped` shows `{"iv":…,"ct":…}`.
4. **Swipe-kill** the probe and **relaunch cold**.
5. Tap **Unlock (re-derive via PRF)** → Face ID → `round-trip: OK` means the
   secret was byte-stable across the cold launch and the blob decrypted.

| Observation | Plan impact |
|---|---|
| stable secret, `round-trip: OK` after relaunch | full encrypt-at-rest path buildable → Phase 1b → 1c proceed |
| `first` ABSENT (trap) | treat as no-PRF → fallback (b); never persist |
| secret returned but `stable=NO`, or round-trip FAIL after relaunch | fallback (b) — persistence would write undecryptable tokens |
| works in Safari tab (A4) but `standalone (installed)` fails here | the critical finding — feature blocked on the installed surface; fallback (b) on device |
| no passkey enrollable / iCloud Keychain off | D6 — fallback (b) is the common field experience |

Record: D5 = ____________  (enabled: ____ / first: ____ / stable: ____ / round-trip: ____)

6. If `round-trip: OK`, tap **Copy fixture JSON** and paste it into
   `tests/fixtures/` as the Phase 1a keep-as-fixture seed.

## Free observations in the same session

- **D2** — after several cold launches (and, ideally, leaving the app untouched
  across days), does the localStorage stamp survive? Rough eviction bound: ____
- **D3** — ship a version bump; does the footer `build` stamp advance within a
  launch or two? Manual reload needed? ____
- **D4** — splash art and status-bar legibility on cold launch: ____

## Sign-off

Owner reviews D1–D6 results, then updates the plan's Verified Assumptions /
Open Questions and gates **Phase 1b** on the D5 outcome.
