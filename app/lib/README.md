# Backend Tree

Backend code is split into three layers:

Only three account types exist: client, artist, salon — direct booking is
the product. Chat, wallet, and the "shop" account type were removed
entirely (see `docs/DEVLOG.md`, 2026-09-23); there are no repos/routes for
them anymore.

```text
app/api/                 Next.js route handlers
app/lib/http.js          shared API response/auth guards
app/lib/auth.js          sessions, cookies, password helpers
app/lib/push.js          web push (VAPID) subscribe/send helpers
app/lib/rateLimit.js     in-memory rate limiting for sensitive routes
app/lib/bookingExpirySweep.js  background sweep that expires stale bookings
app/lib/db/
  connection.js          Postgres pool/connection, query helpers, withTransaction()
  repos/                 domain-specific database operations
    users.js             account CRUD, publicUser() shaping
    sessions.js           session token issue/lookup/revoke
    salons.js            public facade for salon data operations
    salons/
      bookings.js        salon booking queries and visit history mapping
      common.js          shared salon repo helpers
      hours.js           salon hours and default schedule setup
      invites.js         salon <-> artist collab invite flow
      portfolio.js       salon portfolio/posts persistence
      services.js        salon service persistence
      staff.js           salon staff and artist-link helpers
    artists.js           public facade for artist data operations
    artists/
      hours.js           artist hours and default schedule setup
    posts.js              explore-feed / portfolio posts (rating system removed)
    social.js             follows and saved-profiles
    media.js              shared data:-URL parsing for avatar/poster streaming
    passport.js            beauty-passport (skin tone/face shape) persistence
    passwordResetRequests.js  manual password-reset request queue
    push.js                push_subscriptions persistence
    userSettings.js        per-user notification/preference toggles
```

Route handlers should stay thin:

```text
request -> auth/role guard -> repo call -> JSON response
```

Database rules:

```text
connection.js            owns the Postgres Pool, ensureDb()/getDb()/withTransaction()
migrations/*.sql         owns CREATE TABLE/INDEX statements, one versioned file per change
repos/*.js               own SQL queries and data mapping per domain (all async now)
```

This app runs on Postgres (`pg` package), not SQLite — see `.env.example`
for the required `POSTGRES_URL`. Schema changes are real, versioned
migrations under `migrations/` (run with `npm run migrate`, via
[node-pg-migrate](https://salsita.github.io/node-pg-migrate/)), applied once
at deploy time — not an idempotent DDL script re-run on every cold start.
`migrations/001_baseline.sql` is a faithful capture of the schema that used
to be bootstrapped that way; every change since is its own numbered file.
`node-pg-migrate` is a migration *runner*, not an ORM or query builder — it
doesn't change how `repos/*.js` issue queries, which stay hand-written SQL
by design.

Running migrations locally: set `POSTGRES_URL` (or `POSTGRES_URL_NON_POOLING`
for a direct, non-pooled connection — preferred for migrations, since some
DDL needs session-level locks a transaction-mode pooler like Supavisor
doesn't support) in `.env.local`, then `npm run migrate`.

`connection.js`'s `?`-placeholder convention (`toPgSql()`, translated to
Postgres's native `$1, $2, ...` before every query) is a deliberate choice,
not unfinished cleanup: `pg` requires `$N` syntax, but many queries across
`repos/*.js` build their SQL from interpolated fragments, where rewriting
~390 placeholders by hand across 18 files risks silently miscounting one
and binding a value to the wrong column. One small, isolated, verifiable
translation function is safer than that. TLS: see `PGSSL_CA_PATH` in
`.env.example` for hardening the DB connection to full certificate
verification instead of the current `rejectUnauthorized: false` default.
