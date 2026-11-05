-- Daily counters for the Instagram reel link (/go): how many opened it, tapped «ورود به فرفرو» or the Android download.
-- One row per day, source (the ?s= tag, e.g. reel) and kind; no personal data.
CREATE TABLE IF NOT EXISTS landing_visits (
  day DATE NOT NULL,
  source TEXT NOT NULL,
  kind TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, source, kind)
);
