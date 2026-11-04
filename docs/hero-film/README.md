# Hero film (retired 2026-11-04)

The about page used to show a recorded silent video (`public/video/hero.*`). The owner found it unsuitable (frame, unrelated
pictures), so it was replaced by `app/features/landing/HeroMotion.jsx`: pure CSS motion graphics (soft light and paper sheets
sliding in, one short line each), styled in `app/styles/features/landingMotion.css`. No video file, no recording step.
To change the words, edit `SCENES` in `HeroMotion.jsx`; the loop is 14 s (3.5 s per scene).
