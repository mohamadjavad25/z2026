# Hero film (public/video/hero.mp4, hero.webm, hero-poster.jpg)

The silent film at the top of the about page (`HeroFilm.jsx`). It is a CSS-animated page, recorded to video.
It shows no app screens and no mascot on purpose (user's decision 2026-10-15).

- `film.template.html` is the film. Replace `/*PHOTOS*/{}` with a JSON map `{nails, candy, hair, lips, eye, salon}`
  to image URLs (the photos in `public/brand/photos/`: nails-chrome, flatlay-candy, hair-curls, lips-gloss, eye-chrome, salon-modern).
- Open it with `#rec` added to the URL for a bare 1280x720 stage. Record with Playwright `recordVideo` (1280x720),
  call `enter(0); setPlaying(true)` and wait about 52 s. The recording runs about 13% slower than the script,
  so cut about 49.6 s starting where scene 0 restarts (about 2 s in).
- Encode: `ffmpeg -ss 2 -t 49.6 -i rec.webm -an -r 30 -c:v libx264 -crf 25 -preset slow -pix_fmt yuv420p -movflags +faststart hero.mp4`
  and a VP9 copy with `-c:v libvpx-vp9 -crf 36 -b:v 0` (the test Chromium has no H.264).
- Change the words in the template, then record again. Keep the text in plain Persian.
