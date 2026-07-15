# Git identity & verified commits — a portable guide

A checklist for keeping commits **attributed and verified** when an AI agent
(Claude) and a human share a repo. Written for Skylite; the rules are
repo-agnostic — copy this file into any repo and follow it.

## TL;DR

1. Set the identity **once per clone, before the first commit**:
   ```sh
   git config user.email noreply@anthropic.com
   git config user.name  Claude
   ```
2. End every commit message with the attribution trailers (below).
3. **Never amend or rebase a commit that is already merged** into the default
   branch — including GitHub's own squash/merge commit. Rewriting merged history
   is the one thing this guide exists to prevent.

## Why this exists

A hosting provider marks a commit **Unverified** when its committer email is not
the expected address (here `noreply@anthropic.com`) or it lacks a signature. Two
very different situations produce that flag, and they are handled oppositely:

| Situation | Committer | Fix |
|---|---|---|
| A **local commit you authored** with the wrong/unset identity | e.g. `noreply@github.com`, a personal email, or unset | Re-author it (see below) **before it merges** |
| GitHub's **squash/merge commit** created when a PR is merged | `noreply@github.com` (GitHub's merge machinery) | **Nothing.** It is already on `main`. Leave it. |

The trap: after you merge a PR and reset your working branch to `origin/main`,
the **tip of your branch is GitHub's merge commit**. A generic "unverified
commit" check will flag it. It is not yours to fix — amending it rewrites merged
`main` history. Recognise it by: it is the squash/merge commit, its committer is
the host's noreply address, and it already exists on the default branch.

## The identity, per clone

`git config user.*` is **not** global by default and does **not** travel with a
fresh clone or a new agent container. Set it immediately after cloning, before
committing:

```sh
git config user.email noreply@anthropic.com
git config user.name  Claude
```

(Use `git config --global` only if you own the machine and every repo should use
this identity. In ephemeral/CI containers, per-repo is safer.)

## Attribution trailers

End each commit message body with:

```
Co-Authored-By: Claude <noreply@anthropic.com>
```

Skylite additionally appends a session link trailer supplied by the harness.
Keep model identifiers, marketing names, and internal tokens **out** of commit
messages, PR titles/bodies, and code — attribution trailers only.

## Fixing a local commit that is NOT yet merged

Only ever do this on commits that are still on your branch and **not** part of
the default branch's history.

```sh
# the tip commit only
git config user.email noreply@anthropic.com && git config user.name Claude
git commit --amend --no-edit --reset-author

# several of your own un-merged commits
git rebase --exec "git commit --amend --no-edit --reset-author" origin/main
```

Then push. If the branch was already pushed, this needs a force push — which is
safe here **only because these commits are yours and un-merged**:

```sh
git push --force-with-lease
```

`--force-with-lease` (never a bare `--force`) refuses to clobber if the remote
moved under you.

## The post-merge branch restart (how the tip becomes GitHub's commit)

Skylite's workflow reuses one long-lived branch name across successive PRs. After
a PR merges:

```sh
git fetch origin main
git checkout -B <your-branch> origin/main   # tip is now GitHub's squash commit
```

New work is committed on top with your identity. When you next push, the remote
branch still points at the old (now-squash-merged) commits, so the push is
rejected as non-fast-forward. Because the old tip is **already merged**, a
`--force-with-lease` push is the correct resolution:

```sh
git push --force-with-lease -u origin <your-branch>
```

If the branch instead carried un-merged commits beyond the merged history, you
would **rebase them onto the new base**, not discard them.

## Decision flowchart

```
A commit is flagged Unverified.
│
├─ Is it already on the default branch (main)?
│   └─ YES → it's the host's merge commit or already-shipped history. DO NOTHING.
│
└─ NO — it's a local commit on your branch.
    ├─ Wrong/unset identity? → set config, git commit --amend --reset-author
    │                          (or rebase --exec for several), then force-with-lease.
    └─ Right identity already? → nothing to fix; the flag is signature-only and
                                 the host may verify on push.
```

## Reuse in another repo

1. Clone, then set `user.email` / `user.name` (above) before the first commit.
2. Add the `Co-Authored-By` trailer to commits.
3. Keep the golden rule: **merged history is immutable** — re-author only your
   own un-merged commits, and reach for `--force-with-lease`, never `--force`.
