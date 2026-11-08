# Handoff: architecture hardening (branch `claude/hardening-step1`)

Written 2026-11-08 because the owner's Claude account was near its limit. Continue from here; do not start over.

## The owner's request

Owner approved the architecture page (https://claude.ai/artifact/1yVUPmjS1ZEgbun6cK4pt2) on 2026-11-08:
«آره موافقم، همه رو درستشون بکن به صورت کاملا اصولی و درست و حسابی و با دقت خیلی بالا.»
They took every recommendation:
- a salon's or artist's login phone is seen only by clients with a booking or a connection (plus the account itself and the other side of a team);
- working hours can be set from 6:00 to 24:00;
- start with step 1.
Six steps, in this order, each on Vercel first, nothing to the main server without the owner:
1. Reliability and security (this branch).
2. Photos to Arvan storage (PRIORITIES item 3).
3. One place for booking rules ("booking room").
4. Split the big hooks (useHomeApp, bookings.js, artists.js).
5. Style cleanup (legacy CSS, `!important`, hard-coded colours).
6. Safety net: type checks, ledger and leave tests, a screen-diff tool.
Steps 3 to 5 should wait until `claude/request-artists-design` (new request screen, owner liked it) is tested on Vercel and merged.
Promise to the owner: nothing a user sees changes unless approved; proven by tests and before/after pictures.
The owner wants each new page as a NEW artifact (never update the old ones).

## Step 1: done so far (uncommitted work was saved in the WIP commit)

- `app/shared/lib/clock.js`: "now" corrected by the server's Date header, so a phone with a wrong date shows the real days (HEALTH debt 12). About 25 client files use `nowDate()` / `nowMs()` for calendar "now"; timers stay on Date.now().
- `app/shared/api/client.js`: request time limit (25 s reads, 120 s writes) with «جوابی نیومد؛ اینترنتت رو چک کن و دوباره بزن.», and learns the server time from fresh responses.
- `app/lib/db/connection.js`: statement and idle-in-transaction timeouts (skipped on the Supabase pooler, port 6543), connect retry (250/750/1500 ms) for a restarting database, pool.query retries the connect.
- `app/lib/serverErrorAlert.js` + `adminPush.js`: the admin alert works when the database is down (in-memory quiet time, cached admin push tokens, title «دیتابیس فرفرو جواب نمی‌ده»).
- Team invite: `respondArtistSalonInvite` runs in one transaction behind `lockTeamPair`, the answer is written only while the invite is still pending (HEALTH debt 10). Tests in `tests/integration/concurrency.test.js` (10 taps of «قبول», and accept + decline at once).
- Migration `077_salon_staff_one_seat.sql`: unique (salon, artist) index on salon_staff, created only when no duplicate pairs exist (tested both ways on a local Postgres). After deploying, check it exists: `SELECT indexname FROM pg_indexes WHERE indexname = 'salon_staff_one_seat';`
- Push subscribe: `app/lib/pushEndpoint.js`, only real browser push services are saved; old rows to raw IPs or local names are never posted to (HEALTH debt 13).
- Login phone on salon and artist pages: `app/lib/db/repos/contactVisibility.js` `canSeeLoginPhone`, used in `GET /api/salons/[id]` and `GET /api/artists/[id]`.

## Step 1: what is left, in order

1. Check the booking preview route `app/api/salon-bookings/preview/route.js`: it returns the whole `getSalon()` object (with `phone`) to anyone, guests too. Strip `phone` there (and look for other routes that return getSalon()/getPublicArtist() whole).
2. Integration tests: login phone visibility (stranger signed in: no phone; connected client, client with a booking, team artist, the account itself: phone), push subscribe refuses `https://127.0.0.1/...` and `http://...`, accepts `https://fcm.googleapis.com/fcm/send/x`.
3. Unit tests (tests/unit): clock.js (`learnServerTime` offset, ignores under 90 s and slow replies), apiFetch time limit, `isRetryableConnectError`, `isKnownPushEndpoint` / `isSafeToPost`.
4. Working hours 6:00 to 24:00: `SALON_HOUR_TIME_OPTIONS` in `app/shared/lib/time.js` (around line 157) and `app/lib/validation/hours.js` (line 33). First find how 24:00 is stored and how slots, opening-hours checks and the artist's hours treat an end of 24:00 (midnight); add tests.
5. Guard rule in `scripts/guard/`: new client code uses clock.js for calendar "now", or marks the line `// clock-ok`.
6. Docs: `docs/DECISIONS.md` (2026-11-08: phone visibility rule above; hours 6 to 24; all six steps approved, start with step 1), `docs/HEALTH.md` debts 10 to 14 and a lesson line, `docs/PROJECT_NOTES.md` sections touched.
7. `npm run check` and the touched tests. Do not run a local `next build`: the PC disk is full (about 600 MB free; Docker data is ~23 GB). Integration tests need a build, so let CI or the Vercel preview build prove them.
8. Push, give the owner the Vercel preview link and a short Persian summary (plain spoken Persian, no lists or technical words; anything complex as a NEW artifact).

## Local setup

- Worktree: `C:\Users\novin\z2026\.claude\worktrees\hardening` (node_modules installed).
- Throwaway Postgres for migration tests: `docker run -d --rm --name frfro-hard-db -e POSTGRES_PASSWORD=review -e POSTGRES_DB=frfro_hard -p 55435:5432 postgres:16-alpine`, then `POSTGRES_URL="postgres://postgres:review@localhost:55435/frfro_hard?sslmode=disable" node scripts/migrate.mjs up`.

## Other open work from the same conversation

- `claude/request-artists-design` (commits a9a95f30, 7b8d6e5d, pushed, not merged): new request screen and artist picker. Owner said «آره خوب شد، حالا موافقم». The change-time screen still has the old look. Page: https://claude.ai/artifact/3hHB8rajPZGHJjAY15yFmb
- `claude/self-review-2026-11-08` (pushed, not merged): self-review page https://claude.ai/artifact/9r551fs1LRBVVAsPGMMZUj
- Tell the owner the PC disk is nearly full.
