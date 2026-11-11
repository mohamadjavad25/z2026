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
app/lib/rateLimit.js     DB-backed rate limiting for sensitive routes
app/lib/bookingExpirySweep.js  background sweep that expires stale bookings
app/lib/db/
  connection.js          Postgres pool/connection, query helpers, withTransaction()
  repos/                 domain-specific database operations
    users.js             account CRUD, publicUser() shaping
    sessions.js           session token issue/lookup/revoke
    salons.js            public facade for salon data operations
    salons/
      bookings.js        door only: re-exports the parts in bookings/
      bookings/          columns, cancellation, day, draft, plan, mirrors, unavailable, lists, create, update,
                         patch, client, artistSync (each file says what it holds in its first lines)
      bookingStaff.js    the team member a booking belongs to
      common.js          shared salon repo helpers
      hours.js           salon hours and default schedule setup
      invites.js         the salon inviting an artist, and her answer
      joinLink.js        joining by the salon's link or QR, and its secret
      membership.js      what every way into a team shares (pair lock, agreed terms, invite states)
      artistTeams.js     the teams an artist is in, and leaving one
      portfolio.js       salon portfolio/posts persistence
      services.js        salon service persistence
      staff.js           salon staff and artist-link helpers
    artists.js           door only: re-exports the parts in artists/
    artists/
      hours.js           artist hours and default schedule setup
      services.js        the artist's own services
      breaks.js          the daily break and «الان استراحت می‌کنم»
      collabs.js         asking to join a salon's team, and the salon's answers
      calendar.js        what already holds an artist's day
      bookings.js        writing bookings (direct ones and calendar copies of salon bookings)
      bookingLists.js    the artist's list and a client's list
      directory.js       the public page, the list of artists, saved artists
    posts.js              explore-feed / portfolio posts (rating system removed)
    social.js             follows and saved-profiles
    media.js              shared data:-URL parsing for avatar/poster streaming
    passport.js            beauty-passport (skin tone/face shape) persistence
    passwordResetRequests.js  manual password-reset request queue
    push.js                push_subscriptions persistence
    userSettings.js        per-user notification/preference toggles
```

A large domain is a folder of small files behind one «door» file with the old name (`salons/bookings.js`,
`artists.js`, `salons.js`): code outside the folder imports from the door, the parts import each other directly.
No file here should grow past about 400 lines; split it the same way (`scripts/tidy/slice.mjs`, `docs/TIDY_WORK.md`).

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

`repos/*.js` write Postgres's native `$1, $2, ...` placeholders directly —
the earlier `?`-placeholder translation layer (`toPgSql()`, a holdover from
an older SQLite-backed version of this codebase) has been removed; every
query across all 18 repo files was converted and re-verified against the
integration test suite. TLS: see `PGSSL_CA_PATH` in `.env.example` for
hardening the DB connection to full certificate verification instead of the
current `rejectUnauthorized: false` default.
