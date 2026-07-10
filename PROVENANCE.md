# Skylite — raw-artifact provenance

Tracks every incoming transcript/dossier behind the Skylite corpus and its
preservation status, mirroring `discovery/alpha/seeds/transcripts/RAW-ARTIFACTS-MANIFEST.md`.
Filing discipline: PLAYBOOK §2b/§4 ("keep raw"). Skylite is filed self-contained
(its own project dir, not inside the `discovery` repo) but follows the same house style.

| Date | Source | Content | Raw location | Status |
|---|---|---|---|---|
| 2026-07-10 | Gemini chat | Product concept + logo/branding iterations → `CONCEPT.md` | `seeds/transcripts/raw/2026-07-10-gemini-skylite-concept-and-logos.md` | `preserved-condensed (cleaned-paste)` — content-faithful, §4-caveated |
| 2026-07-10 | Unknown (ATProto/PWA-flavored; not Gemini) | Identity/PDS/PWA technical idea set → `IDEAS.md` | **missing** | `distilled-only` — see gap below |

## Known gap

The raw transcript that produced `IDEAS.md` (the `goat`/`did:plc`/PDS/PWA deep-dive)
was **not preserved** — only the distilled `IDEAS.md` survives, and its own header
says it was "extracted from a brainstorming transcript" and "separated out of the
arecipe idea-cataloguing session." Per PLAYBOOK §4 ("keep raw"), if that source chat
still exists it should be filed alongside the Gemini one. If it is unrecoverable, this
row stays `distilled-only` and the gap is acknowledged rather than silently ignored.
Action for a future session: check whether the arecipe session export still holds it.
