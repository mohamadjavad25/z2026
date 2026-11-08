# Store pictures (Cafe Bazaar, Myket)

Seven 1080×1920 pictures for the store page: a headline over a phone showing one real screen, all in day mode,
and the seventh with day and night side by side (owner's choice of 2026-10-19, `docs/STORE_LISTING.md`).
The sample salons («رز سپید», «آتلیه گیسو»), artist «سارا» and clients «مریم», «رها» are made up; the pictures
of «رز سپید» and «سارا» are `docs/brand/demo-profiles/`.

1. A throwaway database and the app on it (never real data):
   `docker run -d --name frfro-store-db -e POSTGRES_PASSWORD=store -e POSTGRES_DB=frfro_store -p 55433:5432 postgres:16-alpine`,
   then `node scripts/migrate.mjs up` and `next dev -p 3300` with
   `POSTGRES_URL=postgres://postgres:store@localhost:55433/frfro_store?sslmode=disable FRFRO_SMS_PROVIDER=test FRFRO_OTP_REQUIRED=0 FRFRO_PAYMENT_GATEWAY=sandbox`.
2. `STORE_BASE_URL=http://localhost:3300 STORE_OUT=<folder> node scripts/store/shots.mjs` makes the sample world on
   the first run and takes each screen in day and night (`<id>-light.png`, `<id>-dark.png`, 1080×2280). Only the
   map screen may reach the internet (its tiles).
3. `STORE_OUT=<folder> node scripts/store/compose.mjs` writes `<folder>/final/1.png … 7.png`. Headlines and their
   order are `PAGES` in that file, in the voice of `docs/COPY.md`.

Dates in the pictures move with the day they are taken. Look at every picture before handing them over.
