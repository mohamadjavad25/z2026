---
name: frfro-self-review
description: The periodic check-up of how Claude works on frfro and how healthy the project is - is main green, are the rules and docs still true, are the routines followed, what keeps going wrong, what to improve next - published as a page for the owner. Runs on its own twice a month (scheduled task «بازبینی خودکار فرفرو»); also use when the owner asks «وضعیت چطوره؟», «یه بررسی کلی بکن», or how Claude could work better.
---

# Self-review (the check-up)

The owner should never have to ask "where are we?". This review answers it on its own and fixes what it safely can.
It reads; it changes only Claude's own tooling and docs, never the product, and never deploys.

## 1. Gather the facts (read-only)

- The session brief (`node .claude/hooks/session-brief.mjs`): main, unmerged branches, CI on main, the live site where reachable.
- CI: `gh run list --workflow ci.yml --branch main --limit 20 --json conclusion,createdAt,headSha` — how many green, how long red, which step fails (`gh run view <id> --log-failed`).
- Work since the last review: `git log --since=<last review date in docs/HEALTH.md «بازبینی خودکار»> --format='%h %ad %s' --date=short origin/main`; branches not merged after a week.
- `docs/HEALTH.md`: score, open debts, lessons added since the last review. Do lessons repeat in one area? That area needs a guard or a test, not another lesson.
- The guard: `node scripts/guard/check-rules.mjs --base <commit of the last review>` and its warnings.
- Docs drift: anything in `CLAUDE.md` that is no longer true (compare with `docs/DECISIONS.md`, the code and the newest decisions); files growing past their role (`wc -c docs/*.md`); a debt marked done that is not.
- Did the routines get used? Commits that ended work without tests, docs or a lesson for a fixed bug (`git log --stat`); screens changed without fresh pictures.

## 2. Fix what is safe, on a branch

On a branch `claude/self-review-<YYYY-MM-DD>`: correct stale lines in `CLAUDE.md` and the docs, add a guard rule or test for a mistake that repeated, update the «بازبینی خودکار» section of `docs/HEALTH.md` (date, verdict, what changed). Run `npm run check`. Push the branch. Never change product code here; product bugs found become a short list for the owner, and red CI gets its own fix proposal.

## 3. Tell the owner

Publish one page (Artifact) in Persian, in the owner's voice: first a three-sentence summary (healthy or not, the one thing that matters most, what was fixed); then main/CI, the live site, work done, what keeps going wrong, the next three improvements with a recommended order, and anything only the owner can do. Use pictures, not tables of numbers. In chat give the summary in plain sentences and the link.

Things that need the owner's answer (the main server, money, login, bookings) are asked, not done. New ideas go to `docs/ROADMAP.md`.
