# Tidy work: large files, the hidden side of the code, and the system review

The owner's request (2026-11-10, voice): split the large files, make everything the owner never sees (the server side
and the plumbing of the screens) clean, then review the systems from above (bookings, connections, how client, artist
and salon relate), report what is missing and propose improvements. The owner asked on 2026-11-11 that everything done
and everything in progress is written to GitHub, so that another account can pick the work up at any moment.

**This file is the hand-over.** Whoever continues: read it top to bottom, then go on from «Next». Update it in the same
commit as each step, and push after every step (the session may stop at any time).

Branch: `claude/find-claude-github-work-cbh2jo` (from 2026-11-11 midday; it starts at the head of the first branch,
`claude/salon-booking-system-nrll9n`, which stops at 20426182). Nothing of this is on `main` or on the main server yet. Every step is
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
4. **`useArtistWorkspace.js` 844 → 534 lines** (20426182): the break editor, the answers to booking requests, the
   collaboration offers and invites/teams are four hooks in the same folder.
5. **`tests/e2e` on 20426182: green** (14 files: 13 passed, 1 skipped; 91 tests passed, 10 skipped), and the unit +
   integration suite once more (result in the commit that follows this one).
6. **The other four large files of the React side** (this commit; each moved by line ranges, no line retyped):
   - `useSalonWorkspace.js` 711 → 553: writing, changing and answering a booking is `useSalonBookingActions.js`.
   - `useShellNavigation.js` 603 → 478: follows and saves are `useSavedProfilesSync.js`; whose page a post opens is
     plain functions in `postOwner.js`.
   - `ScheduleBookingMenuModal.jsx` 680 → 472: `MoveTimeList.jsx`, `StaffAutoAssign.jsx`, `ClientTrust.jsx`.
   - `InstagramStorySheet.jsx` 954 → 501: the canvas drawing is `storyDrawing.js`, the data it reads is `storyData.js`.
     The sheet still exports `loadFreeSlots`, `loadWorks`, `dayLine`, `WORKS_NEEDED` for the files that import them.
7. **Files and names nothing reaches are gone** (this commit): the 13 files of the old step 4, and from
   `dead-exports.mjs`: `getClientArtistBookings`, `disconnectFrom`, `joinSalonTeam`, `getSalonStaffCalendars` (API
   wrappers with no caller; the routes themselves stay), `salonRegistrationServices`, `artistSpecialties`,
   `salonArtistStatusOptions`, `peopleLabel`, `shortPersianWeekday`, `getRequestExpiryMinutesLeft`,
   `formatRequestExpiryDeadline`, `pickNextBooking`, `forgetSearch`, `SegmentClockRange`, eight empty names of
   `shell/mockData.js`. Their CSS stays for the style clean-up (priority 8). The hidden tutorials are kept.
   New tool: `scripts/tidy/prune-imports.mjs` removes the imports a new file does not use (it asks ESLint).

## Next (in this order)

1. Left whole on purpose: `repos/billing.js` (653 lines). It is the one place money SQL lives (a hard rule), it reads
   as 23 small functions, and the first real payment is days away. Split it only after the payment check, if at all.
   `useHomeApp.jsx` (770) is wiring only; `storyDrawing.js` (408) is one drawing.
2. The owner has the summary page (system map and review, link in the session). Waiting for the owner's answers on
   the proven faults below; each fix is its own piece of work with the `frfro-bug` routine.
3. Only when the owner says so: ask «اول روی ورسل تست کنیم یا مستقیم روی سرور اصلی؟», then merge to main. Before the
   main server: the two-accounts run (`scripts/verify/two-accounts.mjs`) on the booking flows, since the booking code
   moved.

## System review (2026-11-11): what is proven, what is read in the code, what is still open

Nothing here is fixed: each fix changes behaviour, so the owner decides first (routine `frfro-bug`). The two proven
faults are pinned in `tests/integration/reviewLeads.test.js` with `it.fails`: the suite stays green, and the day one is
fixed its test turns red until `it.fails` becomes `it`.

### Proven with a test

1. **A stranger artist lands in a deleted artist's old team, and the salon gets the stranger's phone number.**
   When an artist deletes her account, her `salon_staff` row stays (`artist_user_id` becomes NULL by the foreign key,
   the name stays; `providerExit.js` only un-assigns her bookings). `resolveArtistUserForStaff` (`salons/staff.js`)
   then ties an unlinked row to the artist account with the same phone, else the same NAME, and `listSalonStaff`
   writes that id back. Names are unique across salons and artists, so a freed name fits exactly one new account.
   Test: salon + artist joins + artist deletes account + another person signs up as an artist under that name → the
   salon's team shows the seat linked to the stranger with `artist_phone`, and the stranger's «teams» lists the salon.
   Likely further effect, not proven: `syncSalonBookingsForArtist` (item 3) would then copy that salon's old bookings
   under this name (client names and phones) into the stranger's calendar. The same door is open for the phone match
   (a reused SIM) if the row keeps a phone.
   Fix to propose: delete the artist's team rows when the account goes (the salon is already told), and drop the name
   match (keep nothing but `artist_user_id`); one migration to clear old unlinked rows only after the owner sees them.
2. **An artist declining her calendar copy can cancel another artist's booking.** The way back
   (`salons/bookings/artistSync.js`) finds the salon's row by client name, phone, service, day and time, newest first,
   without the artist. Test: the salon writes two bookings under one name and number (a mother for herself and her
   daughter), same service and time, one per artist; the first artist declines hers → the second artist's booking is
   cancelled and the first stays live with nobody doing it. Fix to propose: store `salon_booking_id` on every copy
   (multi-service visits already do) and match by it; a migration fills it for old rows by the same fingerprint.

### Read in the code (no test yet; each is a fact about the code, the effect in real use is an estimate)

3. **`GET /api/artist/me` runs `syncSalonBookingsForArtist` on every call**, and the artist's app calls it every 20
   seconds. It reads every salon booking ever made whose staff NAME equals a team row of this artist (only `لغو` left
   out) and runs one more query per booking. A team artist with 1000 old bookings costs about 1000 queries per poll.
   Copies are made together with the booking since the split of 2026-10; this sweep is a leftover safety net.
   Propose: run it only when the artist joins a team, or bound it to today and later.
4. **67 schema statements still run at run time** (`ALTER TABLE` / `CREATE TABLE` / `CREATE INDEX` in 11 files:
   `salons/bookings/columns.js` 15, `billing.js` 20, `support.js` 15, `adminControl.js` 7, …). Checked by script: every
   one of the 67 tables, columns and indexes is also in a migration, so they can go without a new migration. Each
   takes a short exclusive lock on a busy table at every process start. (HEALTH debt 11.)
5. **Leaving a team is three statements with no transaction** (`salons/artistTeams.js` `leaveSalonTeam`): a crash
   between them leaves an accepted invite without a team row. The bookings are handled before it by
   `leaveOrRemoveFromTeam`. Small and safe to wrap.
6. **Nothing shows the visits of the advertising SMS page.** `landingVisitTotals` has no caller: no admin screen, no
   report. The first SMS went out on 2026-11-11 and its result is due on 22 Aban (`docs/FOLLOWUPS.md`); today the
   numbers can only be read from the database by hand at the owner's PC.
7. **Big reads on a timer.** The salon's app asks for its newest 1500 bookings (`SELECT *`) every 20 seconds; the
   artist's list has the same limit; a client's own list has none. Fine for today's sizes; the first thing to bound
   when a salon passes a few hundred bookings.
8. **Routes the app never calls** (their wrappers were removed in the tidy): `DELETE /api/connections`,
   `GET /api/artist-bookings` (replaced by `/api/client-bookings`), `GET /api/salon-staff/calendars`. `POST
   /api/artist/join-salon` is called by the join page directly. Decide whether a client should be able to disconnect.

### Still open (questions, not findings)

- Two patches of one salon booking at the same instant: `salons/bookings/patch.js` reads the booking and its artist
  copy before the transaction (the rule of the lesson of 2026-11-10, `expectStatus`, is not applied there).
- Statuses compared as raw text where the two tables mean opposite things by «تازه» (`shared/lib/bookingStates.js`).
- Who is told on every cancel, move and decline (a table of event → push / SMS / card would settle it).
- Already well covered by tests, so not re-done: a client's privacy and identity (`privacy`, `authz`, `angle2Identity`,
  `angle3b_authz`, `clientExit`, `loginPhoneVisibility`). The gap found is the same idea on the artist and team side
  (item 1).

## Rules for this work

- A step that changes behaviour is not part of this work. Write it under «System review» and ask the owner first
  (CLAUDE.md «Ask before building», «Which server»).
- Never add to `CLAUDE.md`. This file, `docs/HEALTH.md` and `docs/PROJECT_NOTES.md` carry the detail.
