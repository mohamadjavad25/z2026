# Design lab

A separate place to try a screen again, with the real tokens and fonts of frfro, and put the result beside the screen as it is today. Nothing here is part of the app (it is not under `app/` or `public/`, so it is never built or served).

- `home/index.html` is the owner's home («نوبت‌ها» tab of a salon or an artist), proposed. Open it in a browser; `?role=salon|artist`, `?theme=light|dark`, `?state=empty|busy` change what it shows.
- `home/lab.css` is the proposal's own style. It uses only tokens from `app/styles/tokens.css` (no colour, radius or size written by hand), so what is liked can be moved into the app as it is.
- Pictures for the owner: `node scripts/screens/capture.mjs` takes the screen as it is (into `SCREENS_OUT`), Playwright takes this page, and both go side by side on an Artifact page.

When a proposal is accepted, the real screen is rebuilt from it in the app, the old page-by-page CSS it replaces is deleted in the same change, and `docs/screens/` is retaken (CLAUDE.md «Calm screens», «Screenshots first»).
