# Hero film (retired 2026-11-04)

The about page used to show a recorded silent video (`public/video/hero.*`), then paper sheets with words. The owner left
the design to Claude (2026-11-05): `app/features/landing/HeroMotion.jsx` now draws six glossy service cards straight on the
page, wordless, in pure CSS (`app/styles/features/landingMotion.css`): default two drifting columns, `?m=ring` and `?m=deck`
for the others. No video file and no recording step. To change the cards, edit `CARDS` in `HeroMotion.jsx`.
