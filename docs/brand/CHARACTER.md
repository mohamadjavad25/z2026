# The frfro character (شخصیت فرفرو)

The source of truth is the app icon, `public/brand/frfro-app-icon.png`: the user approved that drawing, with its style and details, as the brand character (2026-10-20). Every image of the character, on Instagram, the site, the app or anywhere else, must match it. This file describes it in words so that any image generator, given only text, draws the same character every time.

Rules:
- Never change the **locked traits** below. A pose, action, prop or background may change; the character never does.
- Every prompt is the **core prompt** (unchanged, word for word) followed by **one pose** from the pose library (or a new pose written the same way and added to the library).
- When a generated image breaks a locked trait (neat lollipop spirals, small eyes, a mouth, a gradient, 3D look), throw it away; never publish it.
- Do not use the old AI images (`public/brand/photos/`) for new brand work (user's decision 2026-10-20). `public/brand/mascot/` now holds only this character (replaced 2026-10-20, see «In the app» below).

## Locked traits (from the logo)

**Style**
- Flat 2D vector cartoon, sticker / comic look. Flat colour fills with simple cel shading (2–3 tones per shape). No gradients, no 3D, no realistic texture, no glow.
- Every shape has a thick, slightly uneven outline in dark maroon-black (`#3a0d18`, it reads as black at a glance), like hand-inked vector art.

**Hair (the most important part)**
- A huge, voluminous mane, bigger than the face: a dome on top that frames the face and hangs down both sides past the bottom of the face, like a big curly afro.
- The curls are **messy and organic**: open ring-shaped loops (you can see through the middle of many of them), C-shaped hooks and long hanging ringlets, all of different sizes and overlapping. They are **not** neat, identical spirals or lollipop swirls.
- Three flat pinks: light pink `#ff90c0` (most of the hair), hot pink `#fb65a1`, and deep magenta `#e93980` for the inner shadows of each curl.
- A few thin, loose, single pink strands (thin lines, no outline) fall from the hair over the black face.

**Face and body**
- Face: solid near-black `#1c1b1b`, flat, no shine. It has **only two eyes**: no mouth, no nose, no eyebrows, no blush, no pupils.
- Eyes: two big white (`#fefefe`) vertical capsules (stadium shape, rounded at both ends) with a thick dark outline. Each eye is about a quarter of the face's width and about 1.6× as tall as it is wide. They sit close together, a little below the middle of the face.
- Body (not shown in the logo; defined here, 2026-10-20): the same flat near-black as the face, one continuous soft rounded shape with no neck. Short stubby arms with round mitten hands (no fingers), short stubby legs with round feet. The hair is always the largest mass of the figure.

**Background**
- Default: flat off-white cream `#fdfbf9`. Brand alternatives: ink `#0c0d12`, pink `#ff86b8`, violet `#8b6cff` (flat, no gradient).

## Approved base image and how to make new ones (2026-10-20)

The user approved `docs/brand/character-base.png` («این عالی بود»): the character full body in a pink salon chair holding a nail polish bottle. It is the reference for every new image, together with the logo.

- Tool: AvalAI (avalai.ir, Iranian API, paid in toman), model **`gemini-3-pro-image-preview`** (Nano Banana Pro), 1K square. Script: `scripts/brand/avalai-image.mjs <out.png> <prompt.txt> gemini-3-pro-image-preview public/brand/frfro-app-icon.png docs/brand/character-base.png`. The key lives in `.env.avalai.local` (git-ignored); never put it in chat or a commit.
- Cost (2026-10-20, exchange rate 263,000 toman per USDT): about 36,000 toman per Pro image. Nano Banana 2 (`gemini-3.1-flash-image-preview`, ~17,700 toman) was tested and fails: it tiled the character three times, turned the hair into a repeating pattern and drew shapes inside the eyes. Do not use it for the character.
- Do not spend beyond the free credit without the user's yes.
- The prompt that made the approved image (attach the logo as the only reference):

```
The attached image is the head of our brand character. Draw this exact same character, full body, sitting in a pink salon chair and holding a small pink nail polish bottle. One character only, centered, square image.
Keep the hair identical to the attached image: same loose, messy, organic pink curls (open ring loops, C-shaped hooks and hanging ringlets of different sizes, overlapping), same three pinks, same dark maroon line art, same thin loose strands over the face. Keep the eyes identical: big plain white vertical capsules, nothing inside them. No mouth, no nose.
Body: the same flat black as the face, rounded, no neck, black mitten hands, stubby legs.
Same flat 2D cartoon line-art style as the attached image, off-white cream background, flat colors, no 3D, no text, no border.
```

For a new pose, keep that prompt, replace only the first sentence's action ("sitting in a pink salon chair …") with the pose from the library, and attach both the logo and `character-base.png`.

**Nothing fixed in the hands (user's rule, 2026-10-20).** The nail polish in the base image is only that pose's prop, not part of the character: «لاک توی دست کاراکتر مناسب نیست… چیز ثابتی نباید به کاراکتر اضافه بشه». Each pose holds whatever its post needs, or nothing. Because `character-base.png` shows the bottle, every new-pose prompt must say what the hands hold, or add "Hands empty, no nail polish bottle, no props." Never describe the polish as the character's trait in copy or persona either.

**Poses made so far** (cut out, in `docs/brand/poses/` with their prompts): `hello.png` (waving), `no-call.png` (refusing a ringing phone, curls bristling), `salon-boss.png` (proud, tablet with a calendar), `phone-ok.png` (shows a phone with a check, thumbs up), `curious.png` (magnifying glass), `typing.png` (cross-legged on a pink laptop), `sleepy-night.png` (on a pillow at night, eyes repainted half-closed), `shock.png` (jumping, curls exploding). The Instagram profile photo is `docs/brand/instagram-avatar.png` (the hello pose on violet). For emotional poses Pro tends to add pupils and eyebrows even when told not to (twice for `no-call`). Do not pay for retries: paint the eyes back to plain white shapes afterwards. Narrowed, flat-topped white eyes are allowed to show a mood; pupils, brows and mouths never.

**In the app** (2026-10-20, user's request: the old mascots go; each figure is rethought for what its screen must say, not copied): `app/components/Mascot.jsx` names each pose by its message. `connect` (phone with a QR, beckoning: not connected yet), `no-bookings` (calm shrug against an empty calendar), `free-day` (tea in the salon chair: a day with no bookings), `no-services` (holds up a blank card with a plus), `no-portfolio` (camera ready), `saved-empty` (hugs an empty bookmark), `lost` (upside-down map, 404), `done` (thumbs up with sparkles), `team` (badge on a lanyard: joined a salon's team). The landing page also uses `find` (= `curious`) and `booked` (= `phone-ok`). Prompts are `docs/brand/poses/p-app-*.txt`, raw images in `poses/raw/`, cut-outs in `poses/clean/`; the webp in `public/brand/mascot/` is the cut-out at 640px high. A new screen that needs the character gets a new pose named for its message, made the same way.

**Cutting a pose out (current):** `python scripts/brand/cutout/matte.py in.png out.png`. It removes the cream everywhere it is background (also inside curl loops), keeps white parts of the drawing (eyes, cards, screens), drops beige floor shadows under the feet and un-mixes the soft edge, so no light fringe shows on dark backgrounds. In layouts never let the slide edge crop the feet. The older node scripts below are kept for reference.

**Cutting a pose out (old way)** (scripts in `scripts/brand/cutout/`, run with node from the repo): `cut.mjs in out 40` (flood-fills the cream background from the edges; use 18 when the pose holds something white or cream, like the tablet), then `specks.mjs` (clears cream pockets trapped between curls or between arm and body, never the pure-white eyes), then `defringe.mjs` (turns the light edge pixels into the dark outline, so no white line shows on dark posts). On dark posts also give the character a soft rim (`drop-shadow` 2px light plus ~28px pink or violet glow) so the dark outline does not read as a cut against the ink background.

## Core prompt for the free text-only tool (fallback only)

Use this only when the reference-image tool above is not available. The free Gemini image tool takes at most 1000 characters, so the core is kept under 650 and the pose under 350.

```
Flat 2D vector cartoon mascot, thick dark outlines, no sticker border. Huge dense mane of thick ribbon-like pink curls packed with no gaps: fat open ring loops and ringlets of mixed sizes, framing the face and hanging down both sides; flat light pink, hot pink, deep magenta shading; two thin pink strands fall on the forehead, never over the eyes. Under the hair a wide, clearly visible pure black face and rounded body, no neck. Face: only two very big plain solid white capsule eyes, each a third of the face width, empty inside, thick dark outline, no pupils, no mouth. Stubby black arms with round mitten hands, no fingers, stubby legs. Flat colors, no gradient, no 3D, no text.
```

Why each phrase is there (found by testing, 2026-10-20; keep them):
- "thick ribbon-like … packed with no gaps": without it the curls come out as thin line rings with gaps.
- "pure black": without it the face and body turn dark brown/maroon (the outline colour bleeds in).
- "plain solid white … empty inside, no pupils": without it the eyes get pupils or a dark inner shape.
- "never over the eyes": without it the loose strands cover the eyes.
- "mitten hands, no fingers": without it the hands get fingers.
- "no sticker border": without it a white die-cut border is added.

## Limits of the free text-only tool (tested 2026-10-20)

Asked to redraw the logo itself from the measured description (eyes 16% × 27% of the image, gap ⅔ of an eye, tops at 70% height; hair dome from 18% below the top), Gemini (Nano Banana 2 Lite) got the eyes and the black face roughly right but never the hair. Each fix to the hair broke something else:
- "ribbon / corkscrew ringlets" gave the right twisted-ribbon look, but too big and chunky.
- "small ringlets, about sixty" turned them into a neat grid of identical lollipop spirals (wrong).
- "app icon" added a frame or a circle around the picture: do not use that phrase.
Conclusion: text alone gets close to the character but not to the exact logo. An exact match needs a tool that takes the logo as a reference image (all of them are paid), or an illustrator working from the logo.

## Checking an image before use

A text-only generator still drifts. Make two or three images per pose and keep only one that passes every check:

1. Curls are thick, dense, overlapping loops, not dreadlocks, straight strands or neat lollipop spirals.
2. Three pinks, outlined; the face and body are pure black.
3. Exactly two eyes: plain white capsules, big, no pupils, no eyebrows, nothing drawn on them.
4. No mouth, nose, blush or fingers.
5. Flat 2D, no gradient, no 3D shine, no sticker border, no text.

## Pose library

Each pose is one or two sentences added after the core prompt. Keep the background sentence at the end.

| id | pose |
|---|---|
| `front` | Standing straight, facing the viewer, arms relaxed at the sides, full body centred. Plain cream white background. |
| `wave` | Standing, facing the viewer, one mitten hand raised in a friendly wave. Plain cream white background. |
| `peek` | Only the top of the head and the two eyes peek up from the bottom edge of the frame, hair filling the width. Plain cream white background. |
| `phone` | Holding a big pink smartphone with both hands; a small white calendar card with a pink check mark pops out of the screen. Plain cream white background. |
| `salon-chair` | Sitting in a simple pink salon chair, holding a small pink nail polish bottle. Plain cream white background. |

Add new poses here (id, one or two sentences) whenever a new action is used, so it can be redrawn the same way later.
