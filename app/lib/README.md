# Backend Tree

Backend code is split into three layers:

```text
app/api/                 Next.js route handlers
app/lib/http.js          shared API response/auth guards
app/lib/auth.js          sessions, cookies, password helpers
app/lib/db/
  connection.js          SQLite connection and runtime readiness
  migrations.js          schema version checks and incremental migrations
  schema.js              canonical table/index definitions
  repos/                 domain-specific database operations
    salons.js            public facade for salon data operations
    salons/
      bookings.js        salon booking queries and visit history mapping
      common.js          shared salon repo helpers
      hours.js           salon hours and default schedule setup
      portfolio.js       salon portfolio/posts persistence
      services.js        salon service persistence
      staff.js           salon staff and artist-link helpers
```

Route handlers should stay thin:

```text
request -> auth/role guard -> repo call -> JSON response
```

Database rules:

```text
connection.js            owns opening SQLite and enabling pragmas
migrations.js            owns schema version changes
schema.js                owns CREATE TABLE/INDEX statements
repos/*.js               own SQL queries and data mapping per domain
```
