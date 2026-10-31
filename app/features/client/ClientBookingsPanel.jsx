"use client";

import { useMemo, useState } from "react";
import { Ban, CalendarClock, CheckCircle2, Clock3, History, TimerOff } from "lucide-react";
import { Mascot } from "../../components/Mascot";
import { SegmentClock } from "../../components/SegmentClock";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatRelativeBookingDayLabel, resolveRollingPersianDate } from "../../shared/lib/persianCalendar";
import { ClientBookingHistorySheet } from "./ClientBookingHistorySheet";
import { ExpiredRequestActions } from "./ExpiredRequestActions";
import { AWAITING_CLIENT } from "../../shared/lib/bookingOffer";
import {
  bookingEndLabel,
  bookingStatusLabel,
  bookingStatusTone,
  clientBookingKey,
  isBookingAhead,
  isBookingInPast,
  isPlaceGone,
  openProposalOf,
  requestWaitNote
} from "./bookingStatus";
import { ARTIST_GONE_TEXT, SALON_GONE_TEXT, cancelledByProviderText, noShowClientText, proposalLapsedLine } from "../../shared/lib/providerRules";
import { shortServiceLabel } from "../../shared/lib/serviceBundle";

function dayOf(booking) {
  return booking.booking_date || booking.date || "";
}

/** Earliest first: by date, then by clock time. */
function compareUpcoming(a, b) {
  const da = dayOf(a) ? resolveRollingPersianDate(dayOf(a)).getTime() : 0;
  const db = dayOf(b) ? resolveRollingPersianDate(dayOf(b)).getTime() : 0;
  if (da !== db) return da - db;
  return String(a.time || "").localeCompare(String(b.time || ""));
}

const NOTES_SHOWN = 3;

/** One line for a booking that is over, cancelled or expired: what happened, and when it was. */
function noteOf(booking) {
  const tone = bookingStatusTone(booking.status || "تازه");
  const place = booking.salonName || booking.salon_name || (booking.bookingSource === "artist" ? "آرتیست" : "سالن");
  const service = shortServiceLabel(booking.service) || "خدمت زیبایی";
  const day = dayOf(booking) ? formatRelativeBookingDayLabel(dayOf(booking)) : "امروز";
  const when = booking.time ? `${day}، ${toPersianDigits(booking.time)}` : day;
  if (tone === "bad" && isPlaceGone(booking)) return { Icon: Ban, tone, text: `${booking.bookingSource === "artist" ? ARTIST_GONE_TEXT : SALON_GONE_TEXT}؛ نوبت ${service} لغو شد`, when };
  if (tone === "bad" && booking.cancelled_by === "provider") return { Icon: Ban, tone, text: cancelledByProviderText(booking.bookingSource === "artist" ? "artist" : "salon", booking.salonName || booking.salon_name || ""), when };
  if (tone === "bad") return { Icon: Ban, tone, text: `نوبت ${service} در ${place} لغو شد`, when };
  if (tone === "expired") return { Icon: TimerOff, tone, text: `${place} به درخواست ${service} جواب نداد؛ تموم شد`, when };
  if (booking.no_show_at) return { Icon: Ban, tone: "bad", text: noShowClientText(booking.bookingSource === "artist" ? "artist" : "salon", booking.salonName || booking.salon_name || ""), when };
  return { Icon: CheckCircle2, tone: "done", text: `نوبت ${service} در ${place} انجام شد`, when };
}

function metaOf(booking) {
  const rawDate = dayOf(booking);
  return {
    salonName: booking.salonName || booking.salon_name || "سالن منتخب",
    avatar: booking.salonAvatar || booking.salon_avatar || "",
    service: booking.service || "خدمت زیبایی",
    serviceEmoji: booking.service_emoji || "",
    date: rawDate ? formatRelativeBookingDayLabel(rawDate) : "امروز",
    time: booking.time || "زمان",
    end: bookingEndLabel(booking),
    status: bookingStatusLabel(booking.status),
    tone: bookingStatusTone(booking.status || "تازه")
  };
}

/**
 * Client role — "فعالیت من". Shows what is still ahead, soonest first, one card each (the same
 * time-column card as the salon's schedule; tapping it opens the details); everything that is over, cancelled or expired lives behind the history
 * button. No day strip: a client has a handful of bookings, not a schedule to page through.
 */
/**
 * `compactEmpty`: the client home already invites a booking above, so "nothing ahead" is one line here.
 * `emptyLine`: off when the card under it already says what to do (the heading alone says nothing is ahead).
 * `emptyMascot`: with that one line, the mascot fills the empty page below it (off when another card already has one).
 * `highlightKey`: the booking just made glows for a moment, so the client sees where it went.
 */
export function ClientBookingsPanel({ bookings = [], onOpenSettings, onRebook, compactEmpty = false, emptyLine = true, emptyMascot = false, highlightKey = "", clientName = "", onNotify, onFindPlaces, onOpenPlace }) {
  const [historyOpen, setHistoryOpen] = useState(false);

  const { upcoming, past, notes } = useMemo(() => {
    const ahead = [];
    const behind = [];
    bookings.forEach((booking) => {
      if (isBookingAhead(booking)) ahead.push(booking);
      else behind.push(booking);
    });
    // Over, cancelled or expired, but still today or later: a one-line note, not a card. Older ones are history only.
    const recent = behind.filter((booking) => !isBookingInPast(booking)).sort((a, b) => compareUpcoming(b, a));
    return { upcoming: ahead.sort(compareUpcoming), past: behind, notes: recent };
  }, [bookings]);

  return (
    <>
      <section className="clientBookingsBoard" aria-label="نوبت‌هام">
        <div className="boardHead cbpHead">
          <div>
            <span>نوبت‌هام</span>
            <strong>{upcoming.length ? "چه خبر از نوبت‌هات" : "فعلاً نوبتی نداری"}</strong>
          </div>
          <button
            type="button"
            className="cbpHistoryBtn"
            onClick={() => setHistoryOpen(true)}
            aria-label={`نوبت‌های قبلی، ${toPersianDigits(past.length)} تا`}
          >
            <History size={18} />
            <span>قبلی‌ها</span>
            {past.length ? <b>{toPersianDigits(past.length)}</b> : null}
          </button>
        </div>

        {upcoming.length ? (
          <div className="cvList">
            {upcoming.map((booking, index) => {
              const meta = metaOf(booking);
              const awaitingClient = booking.status === AWAITING_CLIENT;
              const waitNote = requestWaitNote(booking);
              const proposal = openProposalOf(booking);
              const open = () => onOpenSettings?.({ ...booking, clientBookingSheetMode: "details" });
              return (
                <article
                  className={`cvCard is-${awaitingClient || proposal ? "offer" : meta.tone} ${highlightKey && highlightKey === clientBookingKey(booking) ? "is-fresh" : ""}`}
                  key={`${booking.bookingSource || "salon"}-${booking.id || index}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${meta.salonName}، ${shortServiceLabel(meta.service)}، ${meta.date}، ${meta.time}`}
                  onClick={open}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      open();
                    }
                  }}
                >
                  <div className="cvMain">
                    <div className="cvWho">
                      <span className={`cvLogo ${meta.avatar ? "hasImage" : ""}`} aria-hidden="true">
                        {meta.avatar ? <img src={meta.avatar} alt="" /> : String(meta.salonName).slice(0, 1)}
                      </span>
                      <b>{meta.salonName}</b>
                    </div>
                    <span className="cvService">{shortServiceLabel(meta.service)}</span>
                    <span className={`cvState is-${awaitingClient ? "offer" : meta.tone}`}>{meta.status}</span>
                    {awaitingClient ? (
                      <p className="cvNote">
                        <CalendarClock size={14} aria-hidden="true" />
                        سالن یه ساعت تازه پیشنهاد داده؛ کارت رو باز کن و جواب بده.
                      </p>
                    ) : null}
                    {proposal ? (
                      <p className="cvNote">
                        <CalendarClock size={14} aria-hidden="true" />
                        {booking.bookingSource === "artist" ? "آرتیست" : "سالن"} می‌خواد نوبتت رو جابه‌جا کنه؛ کارت رو باز کن و جواب بده.
                      </p>
                    ) : null}
                    {!proposal && booking.proposal_lapsed_at ? (
                      <p className="cvNote">
                        <CalendarClock size={14} aria-hidden="true" />
                        {proposalLapsedLine(booking)}
                      </p>
                    ) : null}
                    {waitNote ? (
                      <p className="cvNote">
                        <Clock3 size={14} aria-hidden="true" />
                        {waitNote}
                      </p>
                    ) : null}
                  </div>
                  <div className="cvTime">
                    <small>{meta.date}</small>
                    <SegmentClock value={meta.time} size="xs" className="cvStart" backgroundColor="transparent" />
                    {meta.end ? (
                      <>
                        <span className="cvRail" aria-hidden="true" />
                        <SegmentClock value={meta.end} size="xxs" className="cvEnd" color="var(--n-600)" backgroundColor="transparent" />
                      </>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {notes.length ? (
          <ul className="cvNotes" aria-label="تازه‌ترین تغییرها">
            {notes.slice(0, NOTES_SHOWN).map((booking, index) => {
              const { Icon, tone, text, when } = noteOf(booking);
              return (
                <li key={`${booking.bookingSource || "salon"}-${booking.id || index}`}>
                  <button type="button" className={`cvMsg is-${tone}`} onClick={() => onOpenSettings?.({ ...booking, clientBookingSheetMode: "details" })}>
                    <Icon size={15} aria-hidden="true" />
                    <span>{text}</span>
                    <time>{when}</time>
                  </button>
                  <ExpiredRequestActions booking={booking} clientName={clientName} onNotify={onNotify} onFindPlaces={onFindPlaces} onOpenPlace={onOpenPlace} />
                </li>
              );
            })}
            {notes.length > NOTES_SHOWN ? (
              <li><button type="button" className="cvNotesMore" onClick={() => setHistoryOpen(true)}>{toPersianDigits(notes.length - NOTES_SHOWN)} تای دیگه توی قبلی‌ها</button></li>
            ) : null}
          </ul>
        ) : null}

        {upcoming.length ? null : compactEmpty ? (
          <>
            {emptyLine ? (
              <p className="cbpEmptyLine">
                {past.length ? "فعلاً نوبتی نداری؛ قبلی‌ها توی «قبلی‌ها» هستن." : "هنوز نوبتی نگرفتی؛ نوبت بعدیت اینجا میاد."}
              </p>
            ) : null}
            {emptyMascot ? <Mascot pose="no-bookings" size={190} className="cbpEmptyMascot" /> : null}
          </>
        ) : (
          <div className="clientBookingsEmpty">
            <Mascot pose="no-bookings" size={168} className="mascotEmpty" />
            <b>{bookings.length ? "فعلاً نوبتی نداری" : "هنوز نوبتی نگرفتی"}</b>
            <span>
              {bookings.length
                ? "قبلی‌ها توی «قبلی‌ها» هستن. از «نوبت» یه نوبت تازه بگیر."
                : "اولین نوبتت رو که بگیری، اینجا میاد."}
            </span>
          </div>
        )}
      </section>

      <ClientBookingHistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        bookings={past}
        onOpenBooking={(booking) => {
          setHistoryOpen(false);
          onOpenSettings?.({ ...booking, clientBookingSheetMode: "details" });
        }}
        onRebook={(booking) => {
          setHistoryOpen(false);
          onRebook?.(booking);
        }}
        clientName={clientName}
        onNotify={onNotify}
        onFindPlaces={onFindPlaces}
        onOpenPlace={onOpenPlace}
        onClosePanel={() => setHistoryOpen(false)}
      />
    </>
  );
}
