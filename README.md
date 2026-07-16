# Skylite

## Skylite today

**A butterfly garden window.** Skylite is a calm, read-first window into Bluesky,
grown for you by someone who cares about you — no algorithm, no ads, no counts, no
strangers. A **sponsor** tends a garden (the set of voices an **explorer** sees);
the explorer reads, saves, and shares what they find. One switch matters, "on this
device only": while it is on, nothing about the explorer ever leaves the device.

- **Live:** https://skylite.croft.ing (an installable PWA).
- **Roles:** *sponsor* (tends the garden, holds the account) and *explorer* (reads
  it). The vocabulary is role-based, never age-based.

### How it's built

Skylite is built in **runs** — small, self-contained slices of work, each landed
test-first (TDD) behind a hermetic gate (`lint · typecheck · unit · build · e2e`,
never touching the network) and written up in a `RUN-*-SUMMARY.md` at the repo
root. The run summaries are a historical record and are not rewritten after the
fact. `npm test` runs the full gate; `npm run build` emits the static PWA to a dist/
folder.

### Where the docs live

| Where | What |
|---|---|
| [`docs/telescope-search.md`](docs/telescope-search.md) | Telescope search — the trust-gradient model + the encrypted search-history archive. |
| [`docs/custody.md`](docs/custody.md) | Account custody & re-authentication — the spectrum and current posture. |
| [`docs/git-verified-commits.md`](docs/git-verified-commits.md) | Keeping commits attributed & verified when an agent and a human share a repo. |
| [`lexicons/`](lexicons/) | The `ing.croft.skylite.*` record schemas (config, like, follow, search). |
| `RUN-*-SUMMARY.md` | One per run — what shipped, red-to-green evidence, what it left open. |

The idea-capture documents (`CONCEPT.md`, `IDEAS.md`, `PROVENANCE.md`, `seeds/`)
are the frozen historical seed the project grew from; they are preserved verbatim
and not updated as the code evolves.

---

## Historical seed — the original idea-capture README

> Preserved verbatim below as historical record (it predates the runs above). It
> reflects the project's initial framing and vocabulary, not the current product.

# Skylite

A read-only, non-algorithmic window into Bluesky/ATProto built for kids —
**Skylite** = Blue*sky* + *lite*. Strip out posting, replying, and DMs and you
remove most of the open-social child-safety surface while still offering a curated
window into global curiosity. Identity is rooted in a DID the child ultimately
controls, so the account is portable and the guardian relationship is a handoff,
not a lock-in.

> Status: **idea capture**, not verified engineering. This repo currently holds
> captured concept + design thinking distilled from brainstorming transcripts.
> Claims flagged _verify_ need confirmation against current ATProto/PDS/iOS docs
> before anything is built on them.

## Contents

| File | What it holds |
|---|---|
| [`CONCEPT.md`](CONCEPT.md) | Product concept + branding — read-only pitch, Sky-Channels, Scrapbook, Sky-Shield moderation, co-viewing, the name/visual/tagline decision. |
| [`IDEAS.md`](IDEAS.md) | Technical idea set — DID/`did:plc` identity & graduation handoff, client-side feed merge, PWA hardening on iOS, the passkey ≠ re-login distinction. |
| [`PROVENANCE.md`](PROVENANCE.md) | Raw-artifact manifest — which transcript each doc came from and its preservation status. |
| [`seeds/transcripts/raw/`](seeds/transcripts/raw/) | Preserved raw transcripts behind the distilled docs. |

## Provenance

Filed following the CroftC intake discipline: raw transcripts are preserved
verbatim-faithful under `seeds/`, distilled thinking references its source, and
`PROVENANCE.md` tracks preservation status (including any known gaps). See
`PROVENANCE.md` for the current ledger.

## License

AGPL-3.0 (see [`LICENSE`](LICENSE)).
