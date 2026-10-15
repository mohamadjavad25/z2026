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
- The public website (the about/download page in `app/features/landing/`, styles in `app/styles/features/landing.css`) is Claude's to own and design end to end (user's decision 2026-10-14); the user works on the app itself. Its look is "ink & light" (user's request 2026-10-15: less pink, closer to the app): white and ink (`#0c0d12`) sections that alternate, with the mascot's pink (`#ff86b8`) and a violet (`#8b6cff`) blended together (`--l-blend`) for emphasis words, glows and cards, never one colour for a whole section. Type is Vazirmatn only, and the mascot images are in `public/brand/mascot/`. Keep the copy in plain Persian, and keep the download link and «ورود به فرفرو» working.
- App release is on hold (user's decision 2026-10-14): until the user says the product is complete and tested, do not build signed releases, replace `public/download/frfro.apk`, change `ANDROID_APP_VERSION`, bump the app version, or work on store publishing (Cafe Bazaar, Myket, Google Play). The version in `mobile/android/app/build.gradle` reads 1.1.0 but nothing past 1.0.0 was ever released.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
