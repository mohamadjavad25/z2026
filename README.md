# زیبابان (Zibaban)

A mobile-first beauty-services marketplace connecting clients with independent
artists and salons in Iran — profile discovery, direct booking, and working-hours
management. Persian (RTL) throughout.

The product intentionally scopes to three account types — **client**, **artist**,
**salon** — and direct booking. Chat, an in-app wallet, a "shop" account type,
and an AI image studio were all removed on 2026-09-23 to reduce pre-launch
regulatory/compliance surface (see `docs/DEVLOG.md`). Don't be surprised to
find references to them in older docs or commit history — that history is
kept for context, not as a description of the current app.

## Stack

- [Next.js](https://nextjs.org) (App Router) + React, plain CSS (no Tailwind)
- Postgres via the `pg` package, no ORM — see `app/lib/README.md`
- Session auth with hashed passwords (`node:crypto` scrypt), no third-party auth
- Web Push (VAPID) for real browser notifications

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in POSTGRES_URL, VAPID keys etc. — see comments in the file
npm run dev
```

You need a reachable Postgres database first — set `POSTGRES_URL` in
`.env.local` (a local Postgres, a Docker container, or a hosted one; on
Vercel, add the Vercel Postgres integration and it's set for you). The app
runs at `http://localhost:3000`. There's no separate seed/migrate step — the
schema is applied automatically and idempotently on first connection
(`app/lib/db/schema.js`).

```bash
npm run build   # production build
npm run start   # run the production build
```

## Project layout

- `app/api/**` — Next.js route handlers (thin: auth guard → repo call → JSON)
- `app/lib/**` — backend layer (db connection/migrations/schema, repos, auth, push) — see `app/lib/README.md`
- `app/features/**` — one folder per product area (artist, salons, settings, schedule, shell, …) — see `app/features/README.md`
- `app/components/**` — shared visual primitives
- `app/shared/**` — cross-feature API wrappers, constants, hooks, formatting helpers
- `app/styles.css` + `app/styles/features/*.css` — plain CSS, imported per feature
- `docs/DEVLOG.md` — running log of notable changes, newest entry on top
- `KNOWN_ISSUES.md` / `UX_ISSUES.md` — historical bug/UX tracking (see the notice at the top of each — several entries predate the wallet/shop/chat removal and no longer apply)

## Design constraints worth knowing before touching UI

- The app is a single-page-per-tab **mobile shell at every viewport width** —
  there's no separate desktop layout, and that's intentional, not a bug.
- Any new full-screen modal/sheet must render via `createPortal(…,
  document.body)` (see `app/features/profile/ProfileSheet.jsx` for the
  pattern). Rendering one inline inside a tab panel breaks its
  `position: fixed` positioning, because `.mobilePage.is-active`'s tab-enter
  animation leaves a `transform` on it that pins a new stacking context —
  see the `createPortal` note in `KNOWN_ISSUES.md`.
