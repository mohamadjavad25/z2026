---
name: frfro-deploy-main
description: Put main on frfro's main server (frfro.ir, real users) and prove it is live. Use when the owner says to deploy, «ببر روی سرور», «آپدیت کن سایت رو», or after Vercel-tested work is approved and merged. Works only from the owner's PC (the deploy key lives there); from a cloud session, say so and prepare everything else.
---

# Deploying to the main server

1. **Where am I?** The deploy key (`~/.ssh/frfro-deploy`) exists only on the owner's PC. In a cloud session: do not try; merge-ready work goes into `main`, and tell the owner in one sentence that it reaches the site the next time they are at the PC (`docs/HANDOFF.md`).
2. **Only `main`, only green.** The main server gets code only from `main` (CLAUDE.md). Before deploying: everything to ship is merged (`git log origin/main`), and CI on that commit is green (`gh run list --branch main --limit 1`). If CI is red, fix that first; never deploy a red main.
3. **Deploy** as `docs/DEPLOY_SERVER.md` §۵ says (`sudo -u frfro /srv/frfro/app/scripts/deploy.sh` on the server). Migrations run inside it.
4. **Prove it is live** (lesson 2026-10-21: the service ran from an old folder): the release folder changed, the service is active, `https://frfro.ir/api/health` answers, and the change itself is visible on the site. The session brief on the PC shows the release and the last 24 hours.
5. **Watch** the first minutes: app errors in the admin panel; any new error is the first thing to tell the owner.
6. Update the private status file (what is live, which commit) and tell the owner in one or two plain sentences.
