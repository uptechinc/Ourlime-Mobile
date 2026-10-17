---
name: git-workflow
description: Work directly on main in Ourlime-Mobile and Ourlime-Web. No feature branches, worktrees or pull requests; pull first, check, commit, push to main.
---

# Git Workflow: Work Directly on `main`

Applies to Ourlime-Mobile and Ourlime-Web (`../.agents/rules/git-workflow.md` is the web copy of this rule).

## Rule
- All work happens on `main`. Do not create feature branches, worktrees, or pull requests.
- Start every task with `git checkout main && git pull --ff-only`. If local changes block the pull, stash them with a descriptive message (`git stash push -m "..."`). Never discard them, and report the stash.
- Finish a task the same way every time:
  1. Run the checks: `cmd /c "node_modules\.bin\tsc --noEmit"`, `npx expo lint`, `node scripts/check-discipline.cjs`, and the relevant `bun test` files. Build or test on a device when the change warrants it.
  2. Commit to `main` with a descriptive message.
  3. `git push origin main`.
- Never force-push `main`, rewrite its history, or skip hooks.
- Keep local `backup/*` branches. They hold work that exists nowhere else; delete one only when the owner explicitly asks.
- Never commit `.claude/`, `.env*`, `google-services` secrets beyond the tracked file, service-account keys, or `*.apk`.

## Why
Stacked feature branches and PRs left stale branches, out-of-date local `main` checkouts and blocked pulls. A single `main` line keeps the app and the website in step.
