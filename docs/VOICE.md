# Bluebird voice

The voice of Bluebird is a **patient ski instructor**: calm, encouraging, never
gamified, never urgent. We are teaching someone to enjoy the mountain safely, at
their own pace. Nothing here is trying to keep anyone scrolling.

## Register

Trail and mountain vocabulary, used gently and literally.

- A run has a **top** and a **bottom**. Reaching the bottom is a good thing:
  _"You've reached the base. Nice turns today."_ — never "you've run out."
- Snow is fresh, groomed, or waiting. Weather rolls in and clears.
- The mountain is patrolled. Help is always a short traverse away.

## Banned vocabulary

Enforced by `tests/unit/vocab-lint.test.ts` over UI-facing copy. **The bird in
this brand is a picture and a name, never a behavior.**

- All bird verbs and bird-behavior nouns: `tweet`, `flock`, `nest`, `perch`,
  `migrate`, `birdwatching`.
- The noun `groomer` for a person — anywhere, ever. (The adjective **`groomed`**,
  applied to trails/snow, is allowed and encouraged.)
- Any reference to Twitter or the old bird site.

## Role terms (durable, never age-based)

Per the project's founding principle, roles are **role-based, never age-based**.

- **sponsor** and **explorer** are the canonical role nouns. They live in
  schemas, docs, and code and do not change.
- **Patrol** is the UI skin for the sponsor surface (`patrol.html` and
  Patrol-only components) — the mountain's word for the people keeping watch.
  The role noun in code stays `sponsor`.

## Mountain terms are UI-layer only

Patrol, Lodge, Trail Map, Locker, Ski School, Cabin Mode, corduroy. These skin
the UI. **Never write a mountain term into a lexicon field name** — durable role
nouns (`sponsor`, `explorer`) and colour nouns (`tier: green|blue|black`) carry
the protocol layer.

- **the Lodge** — the home surface (`index.html`); where your garden feed lives.
- **Trail Map** — discovery (`trailmap.html`).
- **Locker** — saved posts (`locker.html`); your own gear, on your own device.
- **My Mountain** — the accounts you follow (`my-mountain.html`).
- **Ski School** — how it works / about (`ski-school.html`).
- **Cabin Mode** — the privacy switch (see below).
- **corduroy** — the fresh-tracks affordance (see below).

## Cabin Mode

The privacy switch — "on this device only" — is called **Cabin Mode** in the UI:
_what happens in the cabin stays in the cabin._ The underlying behavior and every
schema/storage name for "on this device only" stay as they are (`localOnly`).

**Never call it backcountry.** In ski vocabulary the backcountry is unpatrolled
and dangerous — exactly the wrong feeling for the safest mode.

## corduroy

**corduroy** is the reserved internal name for any "new / unread / fresh"
affordance — the ribbed texture a grooming machine leaves on fresh snow.
Visually the intent is a subtle ribbed texture strip on fresh items that fades
once read. Bluebird has no unread/new indicator today; when one is added it uses
this name and (until the texture ships) a plain highlight.

## Canonical sentences

These are published in exactly one place each; do not scatter copies.

- **Etymology** — published once, on the About / Ski School page and nowhere
  else:

  > A bluebird day is ski slang for a clear blue sky over fresh snow: the perfect
  > day to be out on the mountain.

- **Trust tiers** — published in the docs and on Ski School:

  > Trail ratings are trust ratings, not content ratings: green is the garden
  > your Patrol tends, blue is one hop beyond it, black is the open mountain.

## Stock copy

- Empty state: **"No fresh snow yet. Check back tomorrow."**
- Error: **"Whiteout. Hang tight."**
- Reaching the end of a run: **"You've reached the base. Nice turns today."**
