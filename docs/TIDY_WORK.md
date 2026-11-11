# Tidy work: large files, the hidden side of the code, and the system review

The owner's request (2026-11-10, voice): split the large files, make everything the owner never sees (the server side
and the plumbing of the screens) clean, then review the systems from above (bookings, connections, how client, artist
and salon relate), report what is missing and propose improvements. The owner asked on 2026-11-11 that everything done
and everything in progress is written to GitHub, so that another account can pick the work up at any moment.

**This file is the hand-over.** Whoever continues: read it top to bottom, then go on from «Next». Update it in the same
commit as each step, and push after every step (the session may stop at any time).

Branch: `claude/salon-booking-system-nrll9n`. Nothing of this is on `main` or on the main server yet. Every step is
«no behaviour change»: no screen, text, API answer or stored value may differ.

## How to work here (cloud session)

- Tests run without Docker. Once per container:
  `service postgresql start`, then as the `postgres` user `ALTER USER postgres PASSWORD 'postgres'`.
  For every run a fresh database: `DROP DATABASE IF EXISTS frfro_test WITH (FORCE); CREATE DATABASE frfro_test;` and
  `TEST_DATABASE_URL="postgres://postgres:postgres@localhost:5432/frfro_test?sslmode=disable" npx vitest run tests/unit tests/integration`
  after `npm run build` (the suite drives the built app). About 12 minutes; `tests/e2e` about 8 more.
  The suite prints nothing until it ends. Do not edit files under `app/` while `next build` runs.
- The reference result on untouched main (884dd57e): 189 files, 1479 tests, all green (unit + integration).
- Tools made for this work, in `scripts/tidy/` (each explains itself in its first lines):
  `slice.mjs` moves code by exact line ranges and proves every line landed once; `graph.mjs names` checks that every
  named import still exists, `graph.mjs cycles` finds import loops, `graph.mjs orphans` finds unreachable files;
  `dead-exports.mjs` lists exports nobody uses.
- `npm run check` now also reads the React side for names that do not exist (`eslint.config.js`, second block): a
  split that forgets an import or a value fails the check instead of failing on a user's phone.
- The method for a split, the same every time: copy the original to a scratch folder, describe the new files as line
  ranges for `slice.mjs`, write each new file's imports, run `npm run check` and `graph.mjs names` and `graph.mjs
  cycles`, leave the old path as a small «door» file that re-exports the same names, build, run the suite, compare
  with the reference, commit, push.

## Done

1. **Server side, committed 3e1ecd86, suite green (189 files, 1479 tests, same as the reference).**
   - `repos/salons/bookings.js` (1693 lines) is only the door; code in `repos/salons/bookings/` (13 files, largest 329).
   - `repos/artists.js` (1326) is only the door; code in `repos/artists/` (8 files, largest 411).
   - `repos/salons/invites.js` (737) became `invites.js`, `joinLink.js`, `membership.js`, `artistTeams.js`.
   - Import loops gone on the server side (`salons/services` and `salons/staff`; `admin` and `adminAuth`).
   - Dead code removed (listed in the commit message). One copy of the visit dots and of the artist clock helpers.
2. **`npm run check` covers the React side** for undefined names (this commit).
3. **`useHomeApp.jsx` 952 → 770 lines** (this commit): the arrival hand-over (`useArrival.js`), the client's «seen»
   mark (`useClientBookingsSeen.js`) and the push start (`homeAppHelpers.startPushOrAsk`) moved out, line for line.
   What is left in it is wiring: the long lists that take values from the sub-hooks and hand them to the screens.
   **Not yet run through `tests/e2e`** (see «Next», step 1).

## Next (in this order)

1. Build, then run `tests/e2e` (and the unit + integration suite once more) on the current branch head. If anything
   is red, compare with main first: the e2e tests depend on the clock (two are skipped on some hours or days).
2. `features/artist/useArtistWorkspace.js` (844 lines). Planned parts, each a hook in the same folder taking what it
   needs as arguments: the break editor (open, close, save, clear, «الان استراحت می‌کنم», with its four states), the
   answers to booking requests (confirm, decline, «نیومد», propose a time, withdraw, cancel: they share
   `runArtistBookingCall` and the busy id), the collaboration offers (draft, add, delete), invites and teams (answer
   an invite, leave a team). Keep the object the hook returns exactly as it is: `useHomeApp` reads it by name.
3. `features/salons/useSalonWorkspace.js` (711), `features/shell/useShellNavigation.js` (603),
   `features/schedule/ScheduleBookingMenuModal.jsx` (680), `features/profile/InstagramStorySheet.jsx` (954): read
   first, split only along parts that stand on their own. Do not touch `features/salons/useSalonDirectory.js`
   without care: a unit test imports it.
4. React-side files that nothing reaches (`node scripts/tidy/graph.mjs orphans`): `components/BookingSelect.jsx`,
   `BreakTimeWheel.jsx`, `CollabIllustration.jsx`, `DateTimeWheelPicker.jsx`, `features/profile/ProfileAuthModeSwitch.jsx`,
   `ProfileHeroWeekStrip.jsx`, `ProfilePanel.jsx`, `ProfileSignupSteps.jsx`, `features/salons/StaffPerformanceChart.jsx`,
   `features/shell/useAppNavigation.js`, `shared/constants/categories.js`, `shared/lib/busyGate.js`,
   `shared/lib/counts.js`, and the dead names `dead-exports.mjs` lists for `app/shared` and `app/features`. Delete
   them (their CSS stays for the style clean-up, priority 8). **Keep** `features/landing/LearnSection.jsx`,
   `TutorialScreen.jsx`, `tutorials.js`, `index.js`: the hidden tutorials are kept on purpose (CLAUDE.md).
   `features/README.md` names some of these files: correct it in the same commit.
5. Left whole on purpose: `repos/billing.js` (653 lines). It is the one place money SQL lives (a hard rule), it reads
   as 23 small functions, and the first real payment is days away. Split it only after the payment check, if at all.
6. Docs at the end of each part: `docs/HEALTH.md` (debt 4, the scorecard, one history line), `app/lib/README.md`
   (done for the server side), `docs/ARCHITECTURE.md`, `docs/PRIORITIES.md` item 6.
7. The system review (below), then one page for the owner (an Artifact, Persian, with pictures) and a short summary
   in chat in the owner's voice (CLAUDE.md «How to answer the owner»).
8. Only when the owner has seen the summary: ask «اول روی ورسل تست کنیم یا مستقیم روی سرور اصلی؟», then merge to
   main. Before the main server: the two-accounts run (`scripts/verify/two-accounts.mjs`) on the booking flows, since
   the booking code moved.

## System review: what was noticed so far (leads, NOT yet proven)

Each of these was seen while reading the code for the split. None has a test yet. Prove each with a failing test
before telling the owner it is a bug, and before fixing (routine `frfro-bug`).

1. **A hand-typed team member can be tied to a stranger's artist account by name alone.**
   `repos/salons/staff.js` `resolveArtistUserForStaff`: when a team row has no `artist_user_id` and no phone match, it
   takes the artist account with the same NAME (`type = 'artist' AND name = $1`). `salons/bookingStaff.js`
   `findSalonStaffForBooking` then writes that id onto the team row. If true in practice: a salon types «سارا» as a
   team member, an unrelated artist account is called «سارا», and that artist gets the calendar copies of the salon's
   bookings (client name and phone) and her own calendar is blocked. Check every caller, then test it.
2. **A single-service salon booking finds its artist calendar copy by a fingerprint, not by id**
   (`artists/bookings.js` `findLinkedSalonArtistBooking`, and the way back in `salons/bookings/artistSync.js`): same
   client name, phone, service, day and time. Multi-service visits use `salon_booking_id`. Cases to test: two
   bookings of the same client and service on one day; the salon corrects the client's name or phone, then cancels.
3. **`GET /api/artist/me` runs `syncSalonBookingsForArtist` every time**: it walks every salon booking whose staff
   NAME matches a team row of this artist (all time, only `لغو` left out, so expired ones count), one query per
   booking, and may insert copies. Is it still needed now that copies are made with the booking? Cost and wrong copies.
4. **Tables and columns are also made at run time**: about 68 `ALTER TABLE` / `CREATE TABLE` / `CREATE INDEX`
   statements in 9 files (`ensureBookingPartsColumns`, `ensureOwnerColumn`, `ensureBillingTables`, …) run on first
   use in every process although migrations exist. On a busy database each needs a short exclusive lock on a hot
   table at every start (one process per core, and every Vercel cold start). Check each column is in a migration,
   then propose making the schema come from migrations only.
5. **Leaving a team is three statements with no transaction** (`salons/artistTeams.js` `leaveSalonTeam`): the team
   row, the collaborations, the invite. And what happens to that artist's coming bookings in the salon?
6. **The advertising SMS page counts its visits, but nothing shows the counts**: `repos/landingVisits.js`
   `landingVisitTotals` has no caller (no admin screen, no report). The first advertising SMS went out on
   2026-11-11 and its result is due on 22 Aban (`docs/FOLLOWUPS.md`): the owner needs a place to see it.
7. **Lists without an upper bound**: the salon's list reads its newest 1500 bookings and builds each client's ten
   dots only from those; a client's own list has no limit.
8. Two reviewers were started for this (a booking-system review and a connections-and-privacy review) and were cut
   off by the usage limit before reporting. Their questions, for whoever restarts them: races between a read before
   a transaction and the write inside it (`salons/bookings/patch.js` reads the old artist copy before the
   transaction); statuses compared as raw text where the two tables mean opposite things by «تازه»
   (`shared/lib/bookingStates.js`); who is told on every cancel, move and decline; who can see whose phone number
   (`contactVisibility.js`); every route under connect, follow, invite, join, team, staff, customers taking the
   acting account from the session; a reused phone number or a re-created account inheriting old bookings; what stays
   behind when a salon, artist or client deletes the account; suspended accounts still listed or bookable.

## Rules for this work

- A step that changes behaviour is not part of this work. Write it under «System review» and ask the owner first
  (CLAUDE.md «Ask before building», «Which server»).
- Never add to `CLAUDE.md`. This file, `docs/HEALTH.md` and `docs/PROJECT_NOTES.md` carry the detail.
