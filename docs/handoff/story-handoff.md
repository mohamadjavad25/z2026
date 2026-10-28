# Handoff: ready-made Instagram stories («استوری آماده»)

Continue this work. Owner: non-technical, speaks Persian by voice; follow CLAUDE.md voice rules in chat.

## Goal
Owner's words: stories are the biggest door to fill the app. Give salons and artists several ready, striking 9:16 story pictures they can post on their own profile to bring in customers. Best quality possible.

## Where things stand
- Today «استوری آماده» (`app/features/profile/InstagramStorySheet.jsx`, canvas 1080x1920, opened from `ProfileInstagramSettings.jsx`) makes ONE dark card: name, QR, «نوبتت رو از فرفرو بگیر», link.
- Another session made a mockup of six designs: `docs/handoff/story-ideas-mockup.html` (open in a browser). Designs: dark card, portrait (profile photo full screen, QR in glass), portfolio collage (3 works), transparent sticker, big pink type, today's free slots.
- My review: build first **portrait, portfolio collage, free slots today** (free slots sells bookings directly and gives a daily reason to post). Sticker and big type later.
- **Remove the fake line «★ ۴٫۹ · از ۱۲۸ نظر»**: the app has NO reviews or ratings. Use the real list of the account's services instead. Never claim numbers, ratings, deposits or user counts.
- Free slots: only today and tomorrow (owner agreed with the mockup's recommendation, owner has not said otherwise). Real slots come from the calendar (`app/api/salon-bookings/availability`, artist hours). Picture is made fresh each time; if a slot fills, the client sees «این ساعت پر شد» when booking.
- States (from the mockup): no profile photo → coloured background with the name's first letter and «عکس بذار تا قشنگ‌تر بشه»; fewer than 3 works → collage tab off with «حداقل ۳ عکس تو نمونه‌کار بذار»; no free slot → «امروز نوبت خالی نداری»; after save «عکس ذخیره شد، برو اینستاگرام» and the page link is copied.
- Salons and artists both get all of them; for a salon the main photo is the salon's photo.
- Tabs row above «ذخیره عکس»: پرتره، کارت تیره، نمونه‌کار، استیکر، نوبت خالی.

## Rules to follow
- CLAUDE.md «Ask before building» and «Which server»: owner's recommendation is **Vercel first** (it touches the booking calendar): push a branch, give the preview link, merge to main only after the owner says it works. Record answers in `docs/DECISIONS.md`.
- Copy follows `docs/COPY.md`. No hard-coded colours outside the brand (ink #0c0d12, pink #ff86b8, violet #8b6cff, Vazirmatn). Screens in `docs/screens` are from 2026-10-27 and many are stale: retake with `scripts/screens/capture.mjs` (README there) after changes.

## Brand character (mascot) on stories and AI images
- Rules: `docs/brand/CHARACTER.md`. Tool: `scripts/brand/avalai-image.mjs` with model `gemini-3-pro-image-preview` (~36,000 toman per image; the cheaper model breaks the character). Key in `.env.avalai.local` on the owner's computer (git-ignored, never print it or commit it).
- Idea: the mascot beside the QR (pointing at it) in a couple of designs; the user's real photos for portrait and works. About 6 to 7 images, about 250,000 toman. The owner said the account only needs charging: if the key is out of credit, say so and open the AvalAI panel in the browser for them to pay. Ask before spending beyond the credit.
- Each mascot prompt must say what the hands hold (or "hands empty, no props").

## Open questions for the owner (still unanswered)
1. Free slots only today and tomorrow? (my recommendation: yes)
2. Which designs first? (recommendation: portrait, portfolio, free slots)

## Earlier work in the previous session (context, not the task)
Sales pitch pages and an Instagram Reels plan were made as Artifacts (not in the repo). Owner was unhappy with the Instagram plan output: it was text only, no real pictures or video. Quality needs real assets: real screenshots/screen recordings of the app (Playwright can record), brand art, big readable text, 8 to 15 second reels, hook in the first 2 seconds. Importing old bookings is impossible; a salon can invite its customers by QR, a ready message and scanning a client's code. Automatic SMS from frfro to a list of numbers is not built.

## Progress (session 3, 2026-10-28)
- Built the portrait («پرتره») and portfolio («نمونه‌کار») designs in `InstagramStorySheet.jsx`, with the tab row. Portrait uses the profile photo (or the first letter on a pink-violet ground, with «عکس بذار تا قشنگ‌تر بشه»). Portfolio uses the three newest public works with pictures and is off until there are three («حداقل ۳ عکس تو نمونه‌کار بذار»).
- The sheet gets `avatar` from `SettingsPage.jsx` (not from the default avatar). Works load with `getPosts()` when the sheet opens.
- Free slots (salons only): the owner answered «آره، همین» (today and tomorrow). Built from the salon services list and the salon availability endpoint, so the times follow the booking rules. Artists do not have a public availability read yet, so artists do not get this design.
- Not built yet: stickers and big type. The mascot images are not generated yet (credit to confirm).
- Not verified in a browser yet: the canvas drawing needs the running app and database. Check the three tabs on the Vercel preview before merging.
