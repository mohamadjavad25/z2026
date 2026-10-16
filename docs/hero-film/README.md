# Hero film (public/video/hero.mp4, hero.webm, hero-poster.jpg)

The silent film at the top of the about page (`HeroFilm.jsx`). It is a CSS-animated page, recorded to video.
It shows no app screens and no mascot on purpose (user's decision 2026-10-15).

- `film.template.html` is the film: vertical 9:16, a 720x1280 stage. Replace `/*PHOTOS*/{}` with a JSON map
  `{phone, flat, salon, brow, bride, nails, skin, color, curls, lips}` to image URLs (the photos in `public/brand/photos/`:
  phone-glow, flatlay-glam, salon-neon, brow-lash, bride-veil, nails-chrome, skin-drops, hair-color, hair-curls, lips-gloss).
  The photos are cropped 5% at the bottom (the generator's watermark) and sized 720x1280. No words sit on the photos except the main lines.
- Record with Playwright `recordVideo` at a 720x1280 viewport, call `enter(0); setPlaying(true)` and wait about 56 s.
  The recording runs about 13% slower than the script, so cut about 49.6 s starting about 1.7 s in (where scene 0 restarts).
- Encode: `ffmpeg -ss 1.7 -t 49.6 -i rec.webm -an -r 30 -c:v libx264 -crf 24 -preset slow -pix_fmt yuv420p -movflags +faststart hero.mp4`
  and a VP9 copy with `-c:v libvpx-vp9 -crf 36 -b:v 0` (the test Chromium has no H.264).
- Change the words in the template, then record again. Keep the text in plain Persian.
