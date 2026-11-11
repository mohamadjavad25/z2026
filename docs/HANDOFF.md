# Handoff for cloud sessions (2026-11-02)

**Waiting for the owner (2026-11-11): the tidy work** (large files split, hidden-side clean-up, system review) is
finished on branch `claude/find-claude-github-work-cbh2jo` (it continues `claude/salon-booking-system-nrll9n`), not on
main. Its hand-over is `docs/TIDY_WORK.md`: what was done, the two proven faults that wait for the owner's decision,
and how to run the tests in a cloud session. Merge only after the owner has seen the summary page and said so.

The owner is away from the PC and works from a laptop through cloud sessions. This PC holds the private status file, the
deploy script and the server's SSH key, so a cloud session can NOT deploy to the main server (frfro.ir). It can do
everything else: branch, push, and give the owner the Vercel preview link (every pushed branch gets one; project `z2026`).
Deploying to the main server waits until the owner is back at this PC, OR uses the GitHub button «Deploy main to the main server» (`.github/workflows/deploy-main.yml`, 2026-11-04): it needs the repo secrets `DEPLOY_HOST` and `DEPLOY_SSH_KEY` (the owner adds them once at this PC). First run it with mode `check` (proves GitHub can reach the Iranian server, changes nothing), then mode `deploy`. A run's name says which one it was («انتشار روی سرور اصلی» or «فقط بررسی اتصال»): a green check run has sent nothing. The upload tries up to four times and checks the size on the server. If `check` cannot connect, the server blocks foreign addresses: deploy from this PC as before.

## What is live (main ecb32932, deployed 2026-11-02)

- The client's step-by-step booking form (services → day with free-time counts → time → ticket), for app clients and
  Instagram visitors; booking from public pages without signing in first; «میای؟» the day before a visit.
- Artist break: weekdays switched on/off, «الان استراحت می‌کنم» (15/30/60 min, today), half-hour buttons (migration 066).
- Artists can paste a salon's join link in «همکاری».
- Picking a phone contact survives Android restarting the app; sheets never cut off their bottom (Settings map).

## Open, in the owner's order

1. The first Instagram ad (owner's next request).
2. The full e2e suite has not run on this work (CI runs it on a pull request or on main; check the Actions tab).
3. «خبرم کن» SMS: the WAITLIST_OPEN pattern must be created at Faraz SMS; until then the SMS is skipped (push still goes).
4. Not tried on a real phone yet: the contact pick after a restart, the new break screen as an artist, the paste box.
5. Salons get the same break screen later (owner's decision 2026-11-02).

Business items (payment gateway, tax file, loan) are in the owner's private status file, not here.
