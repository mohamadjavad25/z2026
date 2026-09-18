"use client";

import { CalendarCheck2, Clock3, User2, X } from "lucide-react";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { toPersianDigits } from "../../shared/lib/digits";

// Only the two terminal outcomes get a strong tone — "تازه" (just booked,
// awaiting confirmation) reads as a calm "in progress" state, same policy
// as OrderCardBubble's STATUS_TONE.
const STATUS_TONE = {
  "تایید": "done",
  "لغو": "bad"
};

/**
 * Appointment card — deliberately NOT a copy of OrderCardBubble with
 * different labels: a booking is "a confirmed appointment", not "a paid
 * receipt", so there's no item list / total / multi-step tracker here, just
 * what actually matters for a booking (service, when, who's doing it for a
 * salon, and its status). Always rendered as a centered system message
 * (never a normal left/right "is-me"/"is-them" chat bubble) — see
 * ChatPage.jsx, OwnerChatSheet.jsx and ShopStoreDock.jsx — exactly so it
 * can't be mistaken for something either side typed. Content here is always
 * a live snapshot from enrichBookingCards(), never cached locally.
 */
function BookingCardBubble({ booking, kind, missingLabel }) {
  if (!booking) {
    return (
      <div className="bookingCard is-missing">
        <CalendarCheck2 size={16} />
        <p>{missingLabel}</p>
      </div>
    );
  }

  const cancelled = booking.status === "لغو";
  const tone = STATUS_TONE[booking.status] || "pending";
  const dateLabel = formatRelativeBookingDayLabel(booking.bookingDate);
  const staffLabel = kind === "salon" ? String(booking.staff || "").trim() : "";

  return (
    <div className="bookingCard">
      <div className="bookingCardHead">
        <span className="bookingCardIcon">
          <CalendarCheck2 size={15} />
        </span>
        <b>{booking.service || "نوبت"}</b>
        <span className={`bookingCardStatus is-${tone}`}>{booking.status || "تازه"}</span>
      </div>

      <div className="bookingCardMetaRow">
        <Clock3 size={13} />
        <span>{dateLabel} · {toPersianDigits(booking.time || "")}</span>
      </div>

      {staffLabel ? (
        <div className="bookingCardMetaRow">
          <User2 size={13} />
          <span>با {staffLabel}</span>
        </div>
      ) : null}

      {cancelled ? (
        <div className="bookingCardCancelled">
          <X size={13} />
          نوبت لغو شد
        </div>
      ) : null}
    </div>
  );
}

export function SalonBookingCardBubble({ booking }) {
  return <BookingCardBubble booking={booking} kind="salon" missingLabel="این نوبت دیگر در دسترس نیست." />;
}

export function ArtistBookingCardBubble({ booking }) {
  return <BookingCardBubble booking={booking} kind="artist" missingLabel="این نوبت دیگر در دسترس نیست." />;
}
