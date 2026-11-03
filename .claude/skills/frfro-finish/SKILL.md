---
name: frfro-finish
description: Finish any frfro change the same way every time - checks, tests, docs, commit, push, Vercel preview link, and the owner's short summary. Use before saying a change is done, before every commit that ends a piece of work, and whenever the owner says «تمومش کن», «بفرست», «پوش کن» or asks for a link to test.
---

# Finishing a change

"Done" means proven, not written. Do every step; say plainly which one could not run and why.

1. **Review your own diff** as if blocking a pull request (`git diff origin/main...`). Two people at once, the edge of working hours, a deleted account, a slow Iranian connection: does anything break? Is any file pushed past ~400 lines, any new style in `app/styles/legacy`, any debt from `docs/HEALTH.md` added?
2. **Fast checks:** `npm run check` (lint + the rules guard in `scripts/guard/`). Both must pass. The guard also runs on every `git commit` (hook) and in CI.
3. **Tests for what you touched:**
   - A pure rule: a unit test in `tests/unit/`.
   - Data, money, bookings, login: an integration test on real Postgres in `tests/integration/`.
   - A flow on screen: `tests/e2e/`.
   - Run them: `npm test` needs `npm run build` and Docker. In a cloud container start Docker first (`dockerd &`), then run only the files you touched: `npx vitest run tests/unit/x.test.js tests/integration/y.test.js` (the build must exist for integration and e2e).
   - A bug found in real use always gets a test that fails before the fix (see `frfro-bug`).
4. **Docs in the same change:** the area's section in `docs/PROJECT_NOTES.md` when behaviour changed; one dated line in `docs/DECISIONS.md` for each owner answer; a line in `docs/HEALTH.md` after meaningful work; a fresh screenshot when a screen changed (`frfro-screens`).
5. **Commit and push** to the session's branch (`git push -u origin <branch>`). Never put a model name in the commit.
6. **CI and preview:** after the push, check the run (`gh run list --branch <branch> --limit 1`) and the Vercel preview of the branch (Vercel tools: project `z2026`, `list_deployments` for the branch; or the Vercel status on the commit). Give the owner the preview link.
7. **Where it goes** (CLAUDE.md «Which server»): important or complex work waits on Vercel until the owner says it works, then merges into `main`; small safe work merges into `main` directly. Deploying to the main server is `frfro-deploy-main`, from the owner's PC only.
8. **Tell the owner** in their voice (CLAUDE.md «How to answer the owner»): what changed on their screen, the link, and the one thing they should try. If something could not be checked, say so in one plain sentence.
