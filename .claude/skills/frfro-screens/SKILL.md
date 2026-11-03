---
name: frfro-screens
description: Look at or retake the pictures of frfro's screens (docs/screens/) - before judging how a screen looks or reads, and after changing one. Use for any question or change about how something looks, any copy review, and whenever a screen's layout or words changed.
---

# Screens

1. **Before** judging or changing a screen: find it in `docs/screens/index.json` (by Persian title or id), look at the picture, then read the code. If the picture no longer matches the code, retake it in the same change.
2. **Retake** with `scripts/screens/capture.mjs` on an empty, throwaway database, never on real data. The exact commands, sample people and special cases are in `docs/screens/README.md`; follow them as written. In a cloud container:
   - start Docker or a local Postgres for the throwaway database,
   - add `SCREENS_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome` if Playwright's own browser is missing (check the folder name with `ls /opt/pw-browsers`),
   - pass only the ids you changed to keep it short: `node scripts/screens/capture.mjs salon-home`.
3. **Check** the new picture yourself (open the jpg) before committing it: right screen, nothing cut off, no tutorial covering it, Persian text readable, night mode too when colours changed (`SCREENS_DARK=1 SCREENS_OUT=<scratch folder>`).
4. Commit the pictures and `index.json` with the change that moved the screen.
