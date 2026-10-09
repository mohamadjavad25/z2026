# frfro: instructions for Claude

## ⚠️ PENDING USER ACTION: read this FIRST in every session

**At the very start of every session, before doing anything else, tell the user (in Persian) that the task below is still not done, and remind them what it is. Do this even if their first message is about something unrelated, then continue with their request.**

Keep reminding the user at the start of each new session until they explicitly say it is done. Once they confirm, delete this whole section (and commit the change). Never assume it was done; only the user's own confirmation counts, and the user said they were unable to do it yet.

### What the user still has to do: rename the secret env vars in Vercel

The product was renamed to **frfro**, so the code now reads `FRFRO_*` environment variables. The Vercel project `z2026` (production) still has the old `ZIBABAN_*` secret variables. Vercel "sensitive" variables cannot be renamed and their values cannot be read by Claude, so the user must create each one by hand in the Vercel dashboard (Settings → Environment Variables) with the **same value as the old variable**, then redeploy:

| Old name | New name |
|---|---|
| `ZIBABAN_ADMIN_PHONES` | `FRFRO_ADMIN_PHONES` |
| `ZIBABAN_ADMIN_SECRET` | `FRFRO_ADMIN_SECRET` |
| `ZIBABAN_ADMIN_SETUP_KEY` | `FRFRO_ADMIN_SETUP_KEY` |
| `ZIBABAN_ADMIN_TOKEN` | `FRFRO_ADMIN_TOKEN` |
| `ZIBABAN_VAPID_PRIVATE_KEY` | `FRFRO_VAPID_PRIVATE_KEY` |

Already done by Claude: `ZIBABAN_VAPID_CONTACT` → `FRFRO_VAPID_CONTACT`.

Warnings to repeat when reminding:
- Do NOT generate new values for `FRFRO_ADMIN_SECRET` (it would break admins' authenticator codes) or `FRFRO_VAPID_PRIVATE_KEY` (it must match `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, otherwise push stops). Reuse the old values.
- Until this is done, admin login and push notifications do not work on the deployed site.
- SMS (`FRFRO_SMS_PROVIDER`, `FRFRO_OTP_*`, provider keys) was never set up in Vercel; see `docs/OPERATIONS.md` if the user wants it.
- `ZIBABAN_ADMIN_SETUP` (without `_KEY`) is an unused leftover in Vercel; harmless.

## Project notes

- The product name is **frfro**, always lowercase in English. The Persian form is «فرفرو». Never use "Farfaroo", "Frfru", "Zibaban" or «زیبابان».
- Logo files live in `public/brand/`; app icons in `public/icons/`.
