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
