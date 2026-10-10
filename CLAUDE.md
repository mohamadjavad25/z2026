# frfro: instructions for Claude

## Deployment status (for reference, no reminder needed)

- The `ZIBABAN_*` → `FRFRO_*` environment variable rename in Vercel (project `z2026`) is done and deployed on 2026-10-10. The secrets (`FRFRO_ADMIN_SECRET`, `FRFRO_ADMIN_SETUP_KEY`, `FRFRO_ADMIN_TOKEN`, `FRFRO_VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`) were regenerated, not copied, because Vercel does not expose sensitive values.
- Because `FRFRO_ADMIN_SECRET` changed, admins must re-enroll their authenticator once via "راه‌اندازی اولیه" on `/admin` (supported since PR #109), and push subscriptions must be re-enabled. Do not nag the user about this at session start; mention it only if they ask about admin login or push.
- The old `ZIBABAN_*` variables still exist in Vercel and are harmless; the user may delete them by hand.

## Project notes

- The product name is **frfro**, always lowercase in English. The Persian form is «فرفرو». Never use "Farfaroo", "Frfru", "Zibaban" or «زیبابان».
- Logo files live in `public/brand/`; app icons in `public/icons/`.
- Future plans (ideas reviewed but not started) live in `docs/ROADMAP.md`. Add new ones there; never start building a plan until the user says so.
