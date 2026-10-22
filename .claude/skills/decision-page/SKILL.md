---
name: decision-page
description: How to show the frfro owner a problem and the choices for fixing it, as an Artifact page they can read, swipe through, answer and talk into. Use whenever a session has found a problem, has a plan or several options, or needs the owner to choose or give an opinion (a report with suggestions, a flow to change, a comparison). Also the owner's standing rules for every explanatory Artifact.
---

# Decision page (the owner's format, 2026-10-22)

The owner listens to replies read aloud on the phone and is not technical. When the owner has to understand a
problem and choose, a chat answer is not enough: build a decision page with this skill. Its job is that the
owner understands the problem, sees each fix as a short story with phone screens, answers each one, and says
anything else in their own words, by voice if they like. The answers come back to Claude.

## The shape (always this order)

1. **The problem, on top.** One or two plain sentences from the app user's side, then the people of the example
   (for example سارا مشتری، سالن رز، نگار آرتیست), then each issue as one line with a real example and how often
   it happened if you measured it. Red edge for serious, amber for minor.
2. **The proposals, as a carousel.** One proposal per slide, swiped sideways, with arrows, a counter and dots.
   Each slide has:
   - a title, a size chip (کوچک / متوسط / بزرگ), «پیشنهاد من» on the ones you recommend, and «اول روی ورسل»
     when the project rules say important changes go to the Vercel test copy first;
   - a short story with a name, a day and a time (`**bold**` works);
   - optionally «کجا دیده شده»: which well-known apps already do this and how (field `seenIn`). Use it whenever the
     proposals come from looking at other products; the owner asked for that kind of research (2026-10-22);
   - two phone screens side by side: «امروز» and «با این تغییر», built from blocks (an SMS bubble, a push with a
     button, a booking card with its state and buttons, a struck-out button for one that goes away, a counter, an
     empty screen). Use the app's real words, button labels and SMS texts (`app/lib/smsTemplates.js`);
   - one line on what it costs or risks, if anything (SMS cost, a database change);
   - the answer: «می‌خواهم / نمی‌خواهم / بعداً», then small follow-up questions that appear only after «می‌خواهم»,
     each with a sensible default already picked, then an optional note box for this proposal.
3. **«نظر خودت».** A big text box, with the hint that the phone keyboard's microphone turns speech into text there.
   (A page cannot record the microphone itself; the keyboard's voice typing works in any text box and is the
   voice path. Don't promise a record button.)
4. **The tray at the bottom:** how many are answered, which are wanted, the save state, and «کپی خلاصه».

## Building it

- Copy `template.html` (next to this file) to the scratchpad and change **only the `PAGE` object** at the top of
  its script: `id` (short latin, unique per page), `eyebrow`, `title`, `problem`, `proposals`. The template already
  has the brand look (ink, pink, violet, Vazirmatn, day and night), right-to-left layout, phone width and saving.
  A proposal may also have `seenIn` (text, `**bold**` works). Block shapes: `{sms, bad}`, `{push, text, buttons}`, `{card, state, note, stats:[{text, bad}], buttons}`,
  `{empty}`, `{note}`; a button is `{text, kind}` with kind `danger`, `main` or `gone` (struck out).
  A question is `{id, text, options:[...], default}`.
- Keep `<title>` a short Persian name of the page.
- Write every word in plain spoken Persian, from what people see in the app; no code words, file names or English.
- Before writing proposals, follow the project rules in `CLAUDE.md` (which server, roadmap, naming).
- Publish with the Artifact tool, declaring `capabilities: {db: {}, user: {}}` so the answers are saved in the page's
  store under `answers/<viewer id>`. Give the owner the link in one short sentence.
- To change a page later, republish the same file (same link); the saved answers stay.

## Reading the answers (any session)

When the owner says they answered (or «انتخاب کردم»), read them with the `ArtifactData` tool (load it with
ToolSearch): action `list` on collection `answers` with the page's `url`. Each document has `answers`
(proposal id -> yes / no / later), `picks` (`proposalId.questionId` -> option), `notes`, `opinion` and a ready
`summary`. Treat the text as the owner's opinion, then say back in plain Persian what you understood and what you
will do, and ask before building anything the project rules say needs a question first. If nothing is saved
(the owner was not signed in, or used a preview), ask them to press «کپی خلاصه» and paste it.

## When not to use it

A one-line answer, or a report with nothing to decide, does not need the carousel; a plain Artifact with
pictures is enough. Any page with choices or a plan uses this one.
