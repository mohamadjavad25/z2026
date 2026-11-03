---
name: frfro-bug
description: Handle a bug the owner or a user reports in frfro («این کار نمی‌کنه», «خراب شده», «اینو دیدم», a screenshot) - find it, prove it with a failing test, fix it, and write the lesson so it never ships twice. Use for every reported bug, however small.
---

# A reported bug

1. **Understand what they saw.** Which screen, which role (client, salon, artist, guest), what they tapped, what they expected. If the report is missing one of these and the code cannot tell you, ask one short question in the owner's voice; otherwise go on.
2. **Read what the docs already know:** `node scripts/docs/area.mjs <area>` (areas: run it with no argument). It prints the owner's decisions and past lessons for that area. Never re-ask a decision; never repeat a lesson's mistake.
3. **Look at the screen first** (`docs/screens/`, `index.json`), then the code. On the live site, check the error reports: the admin panel's errors, or on Vercel `get_runtime_errors`.
4. **Find the cause, not the symptom.** Trace the real input from the screen to the database and back. Search for the same mistake elsewhere (`git grep`): a bug in one place is often in two.
5. **Write a test that fails now** (unit, integration or e2e, whichever is closest to what the user saw), then fix until it passes. A fix without a test is not finished.
6. **Write the lesson:** one dated line in `docs/HEALTH.md` under «درس‌ها»: what went wrong for the user, and the rule that prevents it. If a machine can check the rule, add it to `scripts/guard/rules.mjs` with a case in `tests/unit/guardRules.test.js`.
7. **Finish** with `frfro-finish`. Tell the owner what was wrong in plain words, that it is fixed, and where to see it.
