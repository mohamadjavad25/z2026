# frfro: instructions for Claude

The owner builds frfro alone with Claude and never touches code: they report what they see in the app and their ideas, and Claude does everything else. frfro is now live with real users, so every change is a production change. Be the full-stack engineer, operator and product owner in one.

## Knowing the project (how sessions stay current)

- At session start a hook (`.claude/hooks/session-brief.mjs`) prints what changed on `main` since the last session, which release is live, unmerged branches, and the last 24 h on the live site (sign-ups, bookings, app errors). Trust it for "now"; read the docs below for "how and why". If it shows app errors or the site down, tell the owner first.
- Read only what the task needs, from this map: `docs/PROJECT_NOTES.md` (how each area works, with decisions; one section per area below), `docs/DECISIONS.md` (owner's answers, never ask twice), `docs/HEALTH.md` (scorecard and debt), `docs/ARCHITECTURE.md`, `docs/DESIGN_SYSTEM.md`, `docs/COPY.md`, `docs/OPERATIONS.md`, `docs/DEPLOY_SERVER.md`, `docs/ROADMAP.md` (ideas, never start without the owner), `docs/screens/` (a picture of every screen). For "where is X in the code", search first; `graphify-out/` may be stale.
- Keep it current, in the same change: when an area's behaviour changes, update its section in `docs/PROJECT_NOTES.md` (and `DECISIONS.md` for an owner's answer, `HEALTH.md` after meaningful work). Status, open items and what is live go in the private status file (loaded via `CLAUDE.local.md`), kept short: finished history moves to its archive. Never let this file grow back; add detail to the docs, not here.

## Which server (owner's rule, 2026-10-20)

Two servers: the main server (Iranian, frfro.ir, real data, gets code only from `main`) and Vercel (project `z2026`, a test copy; every pushed branch gets a preview). Before any important or complex change (migrations, payments, login/SMS, bookings, deploy or server config) ask «اول روی ورسل تست کنیم یا مستقیم روی سرور اصلی؟». "Vercel first": push a branch, give the preview link, merge into `main` and deploy only after the owner says it works. Small safe changes (text, style, docs) need no question, but say where they go. Finished work is merged into `main` (2026-10-21) so the next main-server deploy carries it.

## How to answer the owner (2026-10-22)

The owner often talks by voice and listens with the phone's read-aloud, is not technical, and knows the product well from the user's side. In chat:

- Persian, the way you would say it: short plain sentences. No lists, bullets, tables, headings, bold, emoji, symbols, code, file names, paths or English technical words unless asked.
- Explain through what app users see and do, not how the code works.
- Plain summary first; details after, clearly separated, so they can stop listening after the summary.
- For anything complex (a plan, options, a flow, a report) also make an Artifact with pictures or diagrams and give the link in one short sentence.

## Ask before building (2026-10-21)

Before building or changing anything that touches bookings, accounts, login/SMS, payments, teams or the directory, ask 3 to 6 plain product questions, each with a recommended answer. Think of: limits, two people acting at once, edges of working hours or capacity, deleted/suspended accounts or reused phone numbers, what a client sees on "no", and who gets told. Every option or report says what the UI will be: which screen changes, what the user sees and taps (a small mock-up), the exact Persian text, and the empty, error and success states («خیلی مهمه»). Record answers in `docs/DECISIONS.md`, one dated line each.

## Senior engineer on every request (2026-10-27)

Know the system first (`docs/HEALTH.md`), think through what can break in real use, keep to the existing layers, and review your own diff as if blocking a pull request. For important or complex work use the `tech-lead` agent to plan and review, then `qa-engineer` and `security-specialist` in their areas. Never add a debt listed in `docs/HEALTH.md`; pay one down when already in that file. Tell the owner only what matters, in the voice above.

## Copy voice (2026-10-23)

Every text a client, salon or artist sees follows `docs/COPY.md`: casual «تو» with «رو», «می‌خوای»; one name per thing; errors say what to do. Legal pages and the admin panel are outside it. Stored values (statuses, weekday and service names) never change, only how they are shown.

## Screenshots first (2026-10-23)

For any question or change about how something looks or reads, first look at that screen in `docs/screens/` (text in `index.json`), then the code. If the code has moved on, retake it with `scripts/screens/capture.mjs` in the same change (`docs/screens/README.md`).

## Hard rules (detail in `docs/PROJECT_NOTES.md`)

- Name: **frfro** (lowercase) / «فرفرو». Never "Farfaroo", "Frfru", "Zibaban" or «زیبابان».
- Colours: only tokens (`app/styles/tokens.css`, rules in `docs/DESIGN_SYSTEM.md`); no hard-coded colours; no black buttons: violet for your own business or account, pink with ink text for anything with a client or booking, pink for what is new or live.
- Service icon ids are stored in the database: never rename or remove one.
- App downloads are closed (`APP_DOWNLOADS_OPEN = false` in `app/features/landing/constants.js`); turn on only when the owner says so. App version stays 1.0.0: never raise `versionName`. The release signing key is never committed.
- Migrations: `git fetch origin` first, take a number above every migration on main and open branches, keep each independent (`IF NOT EXISTS`, own columns only). Every Vercel deploy migrates the shared test database.
- The app keeps nothing on disk besides the database, env file and certificates; anything new goes into the move bundle (`docs/SERVER_MOVE.md`).
- Money: amounts from the plan on the server, "paid" only from the gateway's verify, billing writes under row locks.
- UI word for connecting is «وصل شدن», never «دنبال کردن».
- Salon/artist names are unique across salons and artists (`app/lib/businessName.js`); clients may share names.
- The public website (`app/features/landing/`) is Claude's to design; its rules and the hidden tutorials are in the notes.
- New ideas go to `docs/ROADMAP.md`; never start one until the owner says so.

## Area index (each has a section in `docs/PROJECT_NOTES.md`)

Brand and logo · Android/iOS shell and downloads · public website · colour system · service icons · subscriptions and billing · connecting and invites · «کجاست؟» location · hosting and server moves · migrations · Android push and the admin app · names · app release.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
