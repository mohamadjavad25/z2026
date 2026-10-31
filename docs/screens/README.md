# Screenshots of the app (docs/screens)

One picture per screen people see, for every role (guest, client, salon, artist), taken on a phone-sized
screen (390 × 844) with sample people: **سارا احمدی** and **مریم رضایی** (clients), **سالن رز** (salon),
**نگار کاشی** (artist on سالن رز's team) and **مینا میکاپ** (independent artist). سارا has one confirmed
booking tomorrow and one request waiting; مریم has one request and one cancelled booking.

- `guest/`, `client/`, `salon/`, `artist/`: the pictures, `<id>.jpg`.
- `index.json`: for each id its role, a Persian title, the day it was taken, the visible text of the screen
  (for copy reviews) and any step that did not work when it was taken.

## How Claude uses them (owner's rule, 2026-10-23)

Before changing or judging how a screen looks or reads:

1. Find the screen here (by title in `index.json`) and look at the picture first.
2. Then read the code of that same screen.
3. If the picture still matches the code, work from it: mark what to change on it and propose.
4. If the screen has changed since the picture (new layout, new words), take a fresh picture of it with the
   script below and replace the old one in the same change, so the set stays current.

## Taking the pictures again

They are taken by `scripts/screens/capture.mjs` against a local app on an **empty, throwaway database**
(it creates the sample people through the real sign-up; never point it at real data):

```sh
createdb frfro_screens
POSTGRES_URL="postgres://…/frfro_screens?sslmode=disable" node scripts/migrate.mjs up
npm run build
POSTGRES_URL="postgres://…/frfro_screens?sslmode=disable" NODE_ENV=production FRFRO_SMS_PROVIDER=test FRFRO_OTP_REQUIRED=0 \
  FRFRO_PAYMENT_GATEWAY=sandbox npx next start -p 3200 &
SCREENS_BASE_URL=http://localhost:3200 node scripts/screens/capture.mjs               # all screens
SCREENS_BASE_URL=http://localhost:3200 node scripts/screens/capture.mjs salon-home    # only some ids
```

For a night review of any set, add `SCREENS_DARK=1` (every screen at night) and `SCREENS_OUT=<folder>` (so the
day pictures here stay as they are).

In the cloud container Playwright's own browser is missing: add
`SCREENS_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`. Logins are rate-limited per phone; when
re-running often on the same database, empty `rate_limit_hits` there first. Dates in the pictures move with the
day they were taken (the bookings are always "tomorrow" and "two open days ahead").

To add a screen, add one line to `SCREENS` in the script (id, role, Persian title, the taps to get there).

The «حساب» and «مرخصی» screens (`salon-team-ledger*`, `artist-team-ledger*`, `artist-leave-plan`) need FINISHED bookings, which the API cannot make: before taking them, add confirmed `artist_bookings` rows with SQL, dated today with an earlier hour (a salon one with `source_salon_user_id` + `salon_booking_id`, an own one with `place_salon_user_id`), and one confirmed row for tomorrow. The comment above `dealScreens()` in the script says the same.
