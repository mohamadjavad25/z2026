"use client";

import { CalendarCheck2, Clock3, TimerOff, User2, X } from "lucide-react";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { toPersianDigits } from "../../shared/lib/digits";

// Only the terminal outcomes get a strong tone — "تازه"/"درخواست" (just
// booked, awaiting confirmation) reads as a calm "in progress" state, same
// policy as OrderCardBubble's STATUS_TONE. "تایید شده" and "منقضی شده" are
// the real salon_bookings statuses (see bookingExpirySweep.js); "تایید" is
// kept for artist-only direct bookings, which use a separate status set.
// "منقضی شده" deliberately gets its OWN tone, not "bad" — it means "the
// salon never answered in time", not "the salon said no" (that's "لغو"),
// and blurring the two into one red pill would defeat the point of having
// a distinct status for it.
const STATUS_TONE = {
  "تایید": "done",
  "تایید شده": "done",
  "لغو": "bad",
  "منقضی شده": "expired"
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
  const expired = booking.status === "منقضی شده";
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

      {expired ? (
        <div className="bookingCardExpired">
          <TimerOff size={13} />
          {kind === "artist"
            ? "آرتیست به‌موقع پاسخ نداد و نوبت به‌طور خودکار لغو شد"
            : "سالن به‌موقع پاسخ نداد و نوبت به‌طور خودکار لغو شد"}
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
