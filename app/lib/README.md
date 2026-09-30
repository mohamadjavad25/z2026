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
  connection.js          Postgres pool/connection and runtime readiness
  schema.js              canonical table/index definitions (applied fresh on every cold start)
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
schema.js                owns CREATE TABLE/INDEX statements (idempotent, run on every cold start)
repos/*.js               own SQL queries and data mapping per domain (all async now)
```

This app runs on Postgres (`pg` package), not SQLite — see `.env.example`
for the required `POSTGRES_URL`. There is no migration history to replay:
`schema.js`'s `applySchema()` is the full, final schema and is safe to call
on every cold start (`IF NOT EXISTS` throughout).
