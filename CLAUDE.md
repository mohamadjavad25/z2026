# frfro: instructions for Claude

## Deployment status (for reference, no reminder needed)

- The `ZIBABAN_*` → `FRFRO_*` environment variable rename in Vercel (project `z2026`) is done and deployed on 2026-10-10. The secrets (`FRFRO_ADMIN_SECRET`, `FRFRO_ADMIN_SETUP_KEY`, `FRFRO_ADMIN_TOKEN`, `FRFRO_VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`) were regenerated, not copied, because Vercel does not expose sensitive values.
- Because `FRFRO_ADMIN_SECRET` changed, each admin had to re-enroll their authenticator once via "راه‌اندازی اولیه" on `/admin` (supported since PR #109). The user confirmed on 2026-10-10 that they re-enrolled and can log in to the admin panel. Push subscriptions must be re-enabled by users; push was not verified. Do not nag the user about this at session start.
- The old `ZIBABAN_*` variables still exist in Vercel and are harmless; the user may delete them by hand.

## Project notes

- The product name is **frfro**, always lowercase in English. The Persian form is «فرفرو». Never use "Farfaroo", "Frfru", "Zibaban" or «زیبابان».
- Logo files live in `public/brand/`; app icons in `public/icons/`.
- Future plans (ideas reviewed but not started) live in `docs/ROADMAP.md`. Add new ones there; never start building a plan until the user says so.
- The Android/iOS app shell lives in `mobile/` (Capacitor, opens https://frfro.ir); see `mobile/README.md`. The Android release signing key (`frfro-release.keystore`) is held by the user and is never committed. The APK served by the site is `public/download/frfro.apk`; `/download` is the about/download page, and on tablets and desktops every page except `/admin`, `/terms` and `/privacy` shows that page instead (`LargeScreenGate`, user's decision 2026-10-14). On phones the home page `/` also shows that page first, until the visitor taps «ورود به فرفرو» there (remembered in localStorage `frfro-entered`); inside the app and when opened from the home-screen icon `/` opens the app directly. Deep links (salon, artist, `/p/...`) still open directly on phones (user's request 2026-10-14).
- App release is on hold (user's decision 2026-10-14): until the user says the product is complete and tested, do not build signed releases, replace `public/download/frfro.apk`, change `ANDROID_APP_VERSION`, bump the app version, or work on store publishing (Cafe Bazaar, Myket, Google Play). The version in `mobile/android/app/build.gradle` reads 1.1.0 but nothing past 1.0.0 was ever released.
