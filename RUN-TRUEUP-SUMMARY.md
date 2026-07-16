# RUN-TRUEUP — SUMMARY

`Date: 2026-07-16. Branch: claude/run-trueup-gub1zj (from the search-system tip
f895f2d). A correctness, care, and documentation run: every change trues up
something that already shipped — no new product surface.`

**Gate: full `npm test` green — lint · typecheck · unit · build · e2e.**
Baseline → after: **unit 191 → 199**, **e2e 95 → 97**. No new dependencies (zero,
as expected). TDD throughout: each phase's acceptance criteria landed as FAILING
tests first, then implementation (red→green cited per phase below).

---

## Phase 0 — Tagline ruling

The owner's 2026-07-15 ruling replaces **"A window to the stars."** with
**"A butterfly garden window."** on every LIVING surface. `CONCEPT.md` keeps the
old tagline (historical, rule 5) and was not touched.

- **Red:** `tests/e2e/landing.spec.ts` re-pointed to assert the new hero line
  (failed against old copy); new `tests/unit/copy-lint.test.ts` grep failed with
  3 offenders — `src/landing.ts`, `index.html`, `manifest.webmanifest`.
- **Green:** hero subtitle (`src/landing.ts`), `index.html` meta description, and
  `manifest.webmanifest` description now read the new tagline. Grep clean.

## Phase 1 — Archive metadata true-up

The sealed search records exposed a **precise** `createdAt` publicly. Now the
precise time rides *inside* the ciphertext and the public timestamp is day-only.

**Old → new record shape:**

```
OLD:  { $type, enc: seal({ q, blocked, tier }),      createdAt: <precise ISO> }
NEW:  { $type, enc: seal({ q, blocked, tier, at }),  createdAt: <UTC day 00:00:00.000Z> }
         where at = epoch ms (the precise attempt time, sealed)
```

**Tolerant read** (`decryptHistory`): use the inner `at` (epoch ms → ISO) when
present; otherwise fall back to the record `createdAt`. Old records written before
this run carry no inner `at` and still decrypt and display via `createdAt` — no
migration, no data loss.

- **Red:** `search-archive.test.ts` — a non-midnight instant must round to
  `…T00:00:00.000Z` (failed: old code kept the precise ISO). `audit-read.test.ts`
  — a new record must surface the inner precise `at`, an old one its `createdAt`
  (failed: old code always used `createdAt`).
- **Green:** `src/search/archive.ts` (`SearchPayload.at`, `toUtcDay`, round on
  build), `src/search/audit-read.ts` (tolerant `at`), `src/telescope/page.ts`
  (pass `at: now`). Explorer copy softened to scope *what*, not whether/when:
  *"Your sponsor can read what you search here. It is stored scrambled, so no one
  else can read what you searched."* Docs: metadata paragraph + sealed-payload
  note in `docs/telescope-search.md`; `lexicons/ing.croft.skylite.search.json`
  `createdAt` re-described as day-granular with the precise time sealed as `at`.

## Phase 2 — Care-aware refusal (self-harm category)

Blocklist entries now carry a **category**; a self-harm-category refusal opens a
door instead of closing one.

**The two refusal states, in words:**

- **Self-harm** (e.g. *"how to commit suicide"*): the results area clears to a
  centered card — a 💛 glyph, the body *"Some things feel too heavy to carry
  alone. Your sponsor cares about you and wants to hear from you — this button
  reaches them right away."*, and a full-width **Get help** button. No results,
  no generic line, no network search. **Get help** opens the existing RUN-05
  handoff, prefilled to the sponsor's mailto. The attempt still appears in
  "Recent searches (your sponsor can see these)" as *(blocked)*.
- **Generic block** (e.g. *"nsfw stuff"*): no card — the status line reads *"That
  search isn't allowed here."* in the danger colour, results empty, and the
  attempt appears in recent searches as *(blocked)*. Logging is unchanged for
  both.

- **Red:** `search-policy.test.ts` — a blocked verdict must carry the term's
  category, `self-harm` for the self-harm group (failed: verdict had no
  category). `tests/e2e/search-care.spec.ts` (new) — the supportive panel / plain
  refusal split (failed: no panel existed).
- **Green:** `src/search/policy.ts` (`DEFAULT_BLOCKLIST_BY_CATEGORY`,
  `BlockCategory`, category on the blocked verdict; `blocklistExtra` → `custom`).
  `src/telescope/page.ts` renders `carePanel` on `category === 'self-harm'`.
  `styles.css` care-panel styles (tokens only). Copy v1 is
  **[confirm before publish — every line]** and carried verbatim.

## Phase 3 — Vocabulary: "grown-up" → "sponsor"

The role is role-based, not age-based. Swept all explorer-facing copy.

**Sweep counts (13 living-copy occurrences of "grown-up", now zero):**

| File | Occurrences | Notes |
|---|---|---|
| `src/telescope/page.ts` | 3 | recent-searches summary, discovery note, archive note |
| `src/render/locks.ts` | 2 | paused-lock, stale-lock bodies |
| `src/care/handoff.ts` | 3 | primary CTA, no-contact fallback, dialog title |
| `help.html` | 3 | what-you-see, "what your sponsor can do", if-something-feels-wrong |
| `docs/telescope-search.md` | 2 | honesty-copy bullet, Status line |

Judgment calls (noted for the owner): the care-handoff *no-contact fallback* and
help.html's "reach … any time" line denote *any* trusted adult in a distress
moment, so they became **"an adult you trust"** rather than "your sponsor"; the
definite references (the CTA, the title, "what your sponsor can do") became
**"sponsor"**. One code comment in `handoff.ts` ("the trusted adult") was
corrected to "the sponsor". `docs/custody.md`'s *"a second trusted adult (a
co-sponsor…)"* was left as-is: there "trusted adult" describes who a co-sponsor
*is*, not the sponsor-role label.

- **Red:** `copy-lint.test.ts` grep for `grown-up` across src/ + living HTML +
  living docs (failed with 5 offending files). Positive assertions added to
  `telescope-search.spec.ts` (summary text) and `care.spec.ts` ("adult you
  trust").
- **Green:** all swept; grep clean.

## Phase 4 — Retroactive RUN-SEARCH-SUMMARY.md

Wrote `RUN-SEARCH-SUMMARY.md`, reconstructing the search system (#17–#24) from
git history: what shipped per phase with commit hashes, dependencies (none), and
the verify-in-run items left open. Marked clearly as written retroactively and
dated. Because the PRs were **squash-merged**, tests and implementation share one
commit per phase — the summary says so plainly rather than retrofitting a
"test-first" claim to the squashed mainline.

## Phase 5 — Encryption language true-up

- **Sealed-box comment fixed** (`src/crypto/sealedbox.ts`): a leaked *ephemeral*
  key exposes only its own message; compromising the sponsor's **private** key
  decrypts the entire archive — which is exactly what the vault (WebAuthn PRF /
  passphrase wrap) protects. The old "forward secrecy against a future
  ephemeral-key leak" line was removed (misleading for a static recipient key).
- **"bank-grade encryption"** applied where the archive is explained: the sponsor
  enable-archive copy (`src/sponsor.ts`) and the audit page
  (`src/audit.ts`) — honest: the same AES-256 + P-256 as banking TLS.
- **HARD RULE guard:** no *"unbreakable" / "impossible to" / "no one can ever"*
  anywhere in living copy.

- **Red:** `sponsor-archive.spec.ts` + `audit-history.spec.ts` assert
  "bank-grade encryption" is present (failed before the copy landed).
- **Green:** copy added; `copy-lint.test.ts` banned-absolutes guard green (no
  offenders — a standing regression guard).

## Phase 6 — Documentation correctness & consistency pass

**Files touched (with one-line reason):**

| File | Reason |
|---|---|
| `README.md` | Added a "Skylite today" top section (framing, live URL, run-based build, docs map); preserved the original idea-capture README verbatim below it under a "Historical seed" heading. |
| `docs/telescope-search.md` | Phase 1 metadata paragraph + sealed-payload note; Phase 3 vocabulary; Phase 5 user-facing-language rules subsection; Phase 6 "child" → "young explorer". |
| `lexicons/ing.croft.skylite.search.json` | Phase 1 record-shape true-up (day-granular `createdAt`, precise time sealed as `at`). |
| `help.html`, `index.html`, `manifest.webmanifest` | Phase 3 vocabulary / Phase 0 tagline (listed above). |

**Consistency check — lexicons vs. code (docs fixed to match code, never the
reverse):**
- `config.json` — verified against `src/config/types.ts` (`SkyliteConfig` +
  `SkyliteSearch`): consistent, no change.
- `like.json` — verified against `buildLikeRecord` (subject strongRef +
  `createdAt`): consistent, no change.
- `follow.json` — verified against `buildFollowRecord` (subject DID +
  `createdAt`): consistent, no change.
- `search.json` — updated for the Phase 1 shape (the one record-shape change in
  this run, and it is owner-directed, not a drift fix).

**Stale claims / cross-references:** `docs/telescope-search.md`'s Status section
reconciles with reality (rung 2 + the encrypted archive are COMPLETE incl. the
PRF path; the "What this is NOT / staged" items remain genuinely staged). Every
path referenced in README + docs exists in the tree, and NSIDs / page paths are
correct — both asserted by the scripted checks below.

**Scripted checks (`tests/unit/copy-lint.test.ts`):** banned role vocabulary
(guardian / custodian / viewer / child / scrapbook / grown-up) absent from docs/
living files; every path referenced in README + docs/ resolves on disk. Both
green. (The lint-grep vocabulary + tagline + banned-absolutes guards cover src/
and the living HTML.)

---

## [confirm before publish] copy still pending

- **Phase 2 care-panel copy v1** — carried verbatim, every line pending the
  owner's confirmation.
- **Landing copy** — remains `[confirm before publish — every line]` except the
  hero tagline, which is now ruled (Phase 0). Laid out, never rewritten.

## Live verification (2026-07-16, post-merge)

The hermetic gate is fully mocked by design. A follow-up pass exercised the real
network to close what could be closed here. This environment's egress is the
important caveat: server-side `fetch` (Node / curl) traverses the managed proxy,
but headless **Chromium connections are reset** by the egress policy, so the
browser-driven live tier could not run from here at all.

**Live-validated server-side** (the app's OWN client code against the real
network — not mocks):

- `getAuthorFeed` — the garden read path over the dev inclusion accounts; the
  label floor runs on live data.
- `getFeed` — Telescope rung-1 discovery against a real public feed generator.
- `resolveHandle → resolvePds → listRecords(ing.croft.skylite.search)` — the whole
  audit-read fetch chain, end to end against a real PDS (empty sealed collection,
  as expected — no writes were made).
- Query-gating policy incl. the Phase 2 categories (`nsfw` → `{blocked, adult}`).

**Could NOT be validated in this environment** (external / infra, not Skylite
code):

- `searchPosts` — returns **403 from BunnyCDN's WAF** (the CDN fronting
  `public.api.bsky.app`) for this datacenter egress IP; other AppView endpoints
  pass the same path. Re-run `npm run e2e:live` from a normal machine to confirm.
- The in-browser live tier (`npm run e2e:live`) — sandbox egress resets
  headless-Chromium TLS; not runnable here without disabling TLS verification
  (which the proxy rules forbid).
- Live **writes** (config publish, likes/follows, sealed-search records) and the
  **OAuth consent** flow — Skylite is OAuth-only (no password path), so these need
  a real browser + device and create real public records; left for a manual
  device pass.

## Freeze / preservation confirmation

`CONCEPT.md`, `IDEAS.md`, `PROVENANCE.md`, `seeds/`, and all prior
`RUN-*-SUMMARY.md` files are **byte-identical** to before the run (`git diff`
against the branch point reports no changes to any of them). The README exception
(granted this run) is the only historical-adjacent file modified, and it preserves
the original content verbatim under a heading. `RUN-SEARCH-SUMMARY.md` and this
file are the two new summaries.
