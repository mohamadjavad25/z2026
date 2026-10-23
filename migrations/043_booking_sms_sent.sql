-- Up Migration
-- One row per booking answer already texted ("تأیید شد" / "لغو شد"), so the same answer is never sent twice,
-- however many times the salon or artist taps it or two taps arrive at the same moment. The primary key is the
-- guard: the sender inserts first and only texts when its insert won. See claimBookingAnswerSms in app/lib/bookingSms.js.
CREATE TABLE IF NOT EXISTS booking_sms_sent (
  booking_kind TEXT NOT NULL,       -- 'salon' | 'artist'
  booking_id INTEGER NOT NULL,
  status TEXT NOT NULL,             -- the status the answer announced
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (booking_kind, booking_id, status)
);

-- Down Migration
DROP TABLE IF EXISTS booking_sms_sent;
