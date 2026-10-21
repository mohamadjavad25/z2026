# Product decisions

One line each, dated. Claude reads this before asking questions.

- 2026-10-21: «درخواست تازه» SMS capped at 3 per hour per client and provider (user approved).
- 2026-10-21: A service duration over 720 minutes is clamped to 720, not rejected (user approved).
- 2026-10-21: Changing a phone number always needs an SMS code for the new number (user approved).
- 2026-10-21: No online deposit in-app for now; idea under study: each salon/artist connects their own gateway (Bale Pay) for optional deposits. Not started; see docs/ROADMAP.md when added.
- 2026-10-21: Anti-abuse plan (user wants nothing complex for clients): small caps for new clients and a signal panel for the salon; no mandatory client re-confirmation.
- 2026-10-21: Capacity (Package 1): places come from the working artists on the team; one lock per salon and day picks the artist, so n simultaneous requests fill n free artists. A walk-in typed without an artist's name takes one seat. A request is refused when the salon has a team but nobody is working (all on leave or off). The «ظرفیت روز» number in the hours settings is no longer used (kept stored and shown, ignored by bookings).
- 2026-10-21: Deadlines (Package 1): whether a request is still alive is worked out at the moment of asking, not by the 5-minute sweep; approving after its deadline, after the appointment started, or after the day was closed / the hours shrunk / the service deleted is refused. A new time the salon offers is held 6 hours, then the slot is freed, the booking closes and both sides get a push (no new SMS template). The 2026-10-18 rule on overnight requests is unchanged (the hour is not counted in working hours only).
- 2026-10-21: Request caps (Package 1): at most 3 open requests per client per salon/artist and 5 in total; the refusal says «اول یکی از درخواست‌های قبلی را لغو کن یا منتظر جواب بمان». The default wait is 1 hour; «تا هر وقت» lasts until the appointment but at most 24 hours.
- 2026-10-21: Identical requests (Package 1): the same client asking the same provider for the same service, day and time again (double tap, slow network, parallel) gets the existing request back (nothing new, nobody notified twice). No «ادامه؟» prompt, and overlapping requests at different providers (or different times) stay allowed.
- 2026-10-21: Limits (Package 1): at most 100 services per salon or artist; a client can only book a service on the provider's own menu and the length is the provider's; the client's name in the provider's SMS is cut to 30 characters; the free-times list for a client reads only the live bookings of the next 60 days and is cached for 5 seconds.
