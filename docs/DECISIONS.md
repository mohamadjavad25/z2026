# Product decisions

One line each, dated. Claude reads this before asking questions.

- 2026-10-21: «درخواست تازه» SMS capped at 3 per hour per client and provider (user approved).
- 2026-10-21: A service duration over 720 minutes is clamped to 720, not rejected (user approved).
- 2026-10-21: Changing a phone number always needs an SMS code for the new number (user approved).
- 2026-10-21: No online deposit in-app for now; idea under study: each salon/artist connects their own gateway (Bale Pay) for optional deposits. Not started; see docs/ROADMAP.md when added.
- 2026-10-21: Anti-abuse plan (user wants nothing complex for clients): small caps for new clients and a signal panel for the salon; no mandatory client re-confirmation.
