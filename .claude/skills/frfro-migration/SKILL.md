---
name: frfro-migration
description: Add or change a frfro database migration (migrations/NNN_name.sql) safely - number, independence from other branches, the shared Vercel database, the move bundle and tests. Use whenever a change needs a new table, column, index or constraint.
---

# A new migration

A migration is an important change: ask the owner «اول روی ورسل تست کنیم یا مستقیم روی سرور اصلی؟» first (CLAUDE.md «Which server»), unless they already answered for this work.

1. `git fetch origin`. Find the highest number on `main` **and** on every open branch:
   `git for-each-ref --format='%(refname:short)' refs/remotes/origin | xargs -I{} git ls-tree --name-only {} migrations/ 2>/dev/null | sort -u | tail -5`
   Take a number above all of them. The guard blocks a commit whose new migration is not above `main`.
2. Write `migrations/NNN_short_name.sql` that only touches its own tables and columns, and can run twice and next to any other branch's migration: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, constraints dropped and re-added by name. No data rewrite that a second run would break.
3. Every Vercel deploy, previews included, runs it on the ONE shared test database. So a preview of an unfinished branch changes that database for everyone: never drop or rename something `main` still uses.
4. SQL stays in `app/lib/db/repos/`; zod validates at the edge; bookings take the advisory locks in `app/lib/db/locks.js`; money is written only under row locks.
5. Nothing new on disk outside the database, env file and certificates; anything else goes into the move bundle (`docs/SERVER_MOVE.md`).
6. An integration test on real Postgres covers the new shape (the test setup applies every migration through `npm run migrate`, which also proves the SQL runs).
7. Note it in `docs/PROJECT_NOTES.md` (the area's section) and finish with `frfro-finish`. The main server applies it on the next deploy (`frfro-deploy-main`).
