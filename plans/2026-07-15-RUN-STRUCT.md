# RUN-STRUCT — instruction record

`Source of truth: SKYLITE-DIRECTIVES.md (2026-07-15, EXECUTABLE). This is the
first of the three consolidated runs; RUN-SOCIAL and RUN-DISCOVER are gated on
this run being merged. Branch: claude/skylite-directives-runs-rihei2.`

RUN-STRUCT restructures Skylite from the dead tier model to the two-switch model
and establishes the vocabulary, rendering principles, and sponsor tooling that
the later runs build on.

## Phases

- **S1 Landing + role funnel.** `/` = hero + one-switch explainer + two doors
  (verbatim copy, [confirm before publish]). Provisioned devices skip the
  landing. Simple skin.
- **S2 Sponsor multi-explorer dashboard.** listRecords-shaped local authoring,
  one card per explorer, random rkey, per-explorer provisioning links, public-
  record hygiene, onboarding checklist. App passwords rejected everywhere.
- **S3 Vocabulary sweep.** guardian→sponsor, child/kid→explorer, scrapbook→Saves.
- **S4 Switch plumbing + skins + rendering principles.** localOnly + skin,
  label floor as exclusion (incl. embeds), navigation wall, showReposts,
  per-explorer staleHours. Four named invariant tests written first.
- **S5 Backup & restore.** One versioned JSON; export via share/download,
  import on a fresh device.
- **S6 Refresh that works.** Always-visible control + custom pull gesture;
  offline banner, not a dead spinner.
- **S7 Sponsor label-audit view.** Meanings + effectiveness replay over public
  data; per-label per-account hidden counts + label-excluded embeds.

## Standing conventions honored

TDD (failing tests first, red→green per phase), fresh branch, hermetic CI
(lint + typecheck + unit + build + e2e), no credentials in-repo, CSP locked,
idea-capture/provenance docs read-only. See RUN-STRUCT-SUMMARY.md for what
shipped, what is deferred, and the verify-in-run findings.
