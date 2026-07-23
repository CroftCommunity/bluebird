# RUN HARDEN-01 — a11y scan + bundle budget + Croft attribution

Scope: adopt three hardening standards from croft-pwa. Branch:
`harden/a11y-budget-attribution`.

## What shipped

- **a11y scan** (`tests/e2e/a11y.spec.ts`): axe-core over every page in both
  themes, failing on serious/critical. It surfaced **real** violations, all fixed:
  - `--cta` (dark) was `#D35400` = white 4.16:1 (a knowing "large-text AA" pick) —
    darkened to `#C24C00` (4.85:1) so the primary button + landing door pass as
    normal text. Both share the token.
  - `--link` was `var(--accent)` — but `--accent` is a FILL colour and fails as
    text (inline `<code>`: 3.11:1 dark, 3.44:1 light). Gave `--link` its own
    text-safe value per theme (`#1B6FB0` light, `#7FB3E3` dark), owned in
    tokens.css (styles.css no longer sets it).
  - the hidden backup-import `<input type=file>` had no label → added `aria-label`.
- **bundle budget**: `build.mjs` fails if any single emitted JS file exceeds 28K
  gz (skylite code-splits, so this caps any one file, not the transitive total;
  current max is `main` ~16K gz).
- **Croft attribution**: a small `Croft` link in the footer of every page →
  https://croft.ing (placeholder pending the brand-name resolution).

## Evidence — the gate is green

```
lint clean · typecheck clean · unit 199 passed
build 8 pages, budget ok
e2e  112 passed  (incl. a11y: every page × both themes, 0 serious/critical)
```

## Review note (colour changes)

The contrast fixes changed three dark/light token values — visible on the live
site. Eyeball the PR preview (`skylite.croft.ing/pr-preview/pr-N/`): the primary
CTA is slightly darker orange in dark mode, and inline links/code are a touch
darker (light) / lighter (dark). Hues preserved; only lightness moved to clear AA.

## Files touched

New: `tests/e2e/a11y.spec.ts`, `RUN-HARDEN-01-SUMMARY.md`.
Changed: `tokens.css` (--cta dark, --link both themes), `styles.css`
(drop --link default, add .build__croft), all 8 `*.html` (footer attribution),
`src/saves/page.ts` (file-input aria-label), `build.mjs` (bundle budget),
`package.json` (@axe-core/playwright).
