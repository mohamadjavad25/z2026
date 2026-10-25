"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CalendarCheck, CheckCircle2, Clock3, MapPin, Phone, RotateCcw, Store, TimerOff, UserPlus, XCircle } from "lucide-react";
import { connectTo, listConnections } from "../../shared/api/connections";
import { SheetClose } from "../../components/SheetClose";
import { bookingStatusLabel, bookingStatusTone, canClientCancel, hasBookingStarted, isPlaceGone, movedToName, openProposalOf, requestWaitNote } from "./bookingStatus";
import { ServiceIcon } from "../../components/ServiceIcon";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { minutesToPersianTime, timeLabelToMinutes } from "../../shared/lib/time";
import { bookingTimeOffer } from "../../shared/lib/bookingOffer";
import { parseBookingParts } from "../../shared/lib/bookingParts";
import { getSalonVisitTimes } from "../../shared/api/salons";
import { formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { shortServiceLabel } from "../../shared/lib/serviceBundle";
import { ACCEPT_LABEL, CALL_PLACE_LABEL, CLIENT_CANCEL_LABEL, ARTIST_GONE_TEXT, NO_SHOW_WRONG_LABEL, SALON_GONE_TEXT, cancelledByProviderText, handoverProposalText, noShowClientText, proposalLapsedLine, shortClock, timeProposalText } from "../../shared/lib/providerRules";
import { openSupport } from "../support/supportEvents";

const BOOKING_STATUS_ICONS = {
  pending: Clock3,
  done: CheckCircle2,
  bad: XCircle,
  expired: TimerOff
};

// "رزرو دوباره" only makes sense once this specific booking is settled —
// cancelled/expired outright, or confirmed and its start time has already
// passed (the service actually happened). While it's still pending or confirmed
// for a future date, the client already has an active booking; offering
// "book again" there reads as if nothing was booked at all.
function isBookingSettled(booking) {
  const status = booking?.status || "";
  if (status === "لغو" || status === "منقضی شده") return true;
  return status === "تایید شده" && hasBookingStarted(booking);
}

function clockRange(time, minutes) {
  const start = timeLabelToMinutes(time);
  return minutes ? `${minutesToPersianTime(start)} تا ${minutesToPersianTime(start + minutes)}` : minutesToPersianTime(start);
}

/**
 * The salon moved this booking to another time and is waiting for the client's answer:
 * the old and new times side by side, and accept / decline.
 */
/**
 * Other times that day the client could still book these same services (the salon's own rules,
 * GET /api/salon-bookings/availability), so declining is described honestly: when there are none,
 * declining means losing the visit that day, not "just pick another time".
 */
function useOtherFreeTimes(booking, offer) {
  const [state, setState] = useState({ key: "", times: null });
  const salonUserId = booking.salon_user_id || booking.salonUserId || booking.source_salon_user_id;
  const parts = parseBookingParts(booking.parts);
  const services = parts.length >= 2
    ? parts.map((part) => ({ name: part.service, minutes: part.minutes }))
    : [{ name: booking.service, minutes: Number(booking.duration_minutes) || 0 }];
  const key = `${salonUserId}|${offer.toDate}|${offer.toTime}|${services.map((item) => item.name).join("+")}`;
  useEffect(() => {
    if (!salonUserId || !offer.toDate) return undefined;
    let alive = true;
    getSalonVisitTimes(salonUserId, offer.toDate, services).then(({ ok, data }) => {
      if (alive) setState({ key, times: ok ? (data.times || []).filter((time) => timeLabelToMinutes(time) !== timeLabelToMinutes(offer.toTime)) : null });
    }).catch(() => {
      if (alive) setState({ key, times: null });
    });
    return () => { alive = false; };
    // `key` covers everything the request depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state.key === key ? state.times : null;
}

function TimeOfferBlock({ booking, offer, onAnswer }) {
  const [answering, setAnswering] = useState("");
  const otherTimes = useOtherFreeTimes(booking, offer);
  const minutes = Number(booking.duration_minutes) || 0;
  const otherDay = offer.fromDate && offer.fromDate !== offer.toDate;
  const send = async (accept) => {
    setAnswering(accept ? "yes" : "no");
    await onAnswer(booking, accept);
    setAnswering("");
  };
  return (
    <div className="cbOffer" role="group" aria-label="ساعت پیشنهادی تازه">
      <b>سالن یه ساعت تازه پیشنهاد داده</b>
      <div className="cbOfferTimes">
        <s aria-label="ساعت قبلی">
          {otherDay ? `${formatRelativeBookingDayLabel(offer.fromDate)} ` : ""}{clockRange(offer.fromTime, minutes)}
        </s>
        <ArrowLeft size={16} aria-hidden="true" />
        <strong aria-label="ساعت تازه">
          {otherDay ? `${formatRelativeBookingDayLabel(offer.toDate)} ` : ""}{clockRange(offer.toTime, minutes)}
        </strong>
      </div>
      <p>
        {otherTimes === null
          ? "اگه رد کنی، این نوبت لغو می‌شه."
          : otherTimes.length
            ? `اگه رد کنی، این نوبت لغو می‌شه. ساعت‌های خالی دیگهٔ این روز: ${otherTimes.slice(0, 4).map((time) => toPersianDigits(time)).join("، ")}${otherTimes.length > 4 ? " و …" : ""}`
            : "این روز ساعت خالی دیگه‌ای برای این کارها نداره؛ اگه رد کنی، نوبت لغو می‌شه و باید یه روز دیگه بگیری."}
      </p>
      <div className="cbOfferActions">
        <button type="button" className="is-accept" disabled={Boolean(answering)} onClick={() => send(true)}>
          {answering === "yes" ? "یه لحظه…" : "قبول، ساعت تازه"}
        </button>
        <button type="button" disabled={Boolean(answering)} onClick={() => send(false)}>
          {answering === "no" ? "یه لحظه…" : "رد"}
        </button>
      </div>
    </div>
  );
}

/**
 * The salon or artist asked to move this CONFIRMED booking to another time (or give it to another artist). The booking
 * stays as it was until the client says yes (owner's rules of 2026-10-22): accept, cancel without any problem, or call.
 */
function ProposalBlock({ booking, proposal, onAnswer, onCall }) {
  const [answering, setAnswering] = useState("");
  const isArtist = booking.bookingSource === "artist";
  const name = booking.salonName || booking.salon_name || "";
  const type = isArtist ? "artist" : "salon";
  const fromDate = booking.booking_date || booking.date || "";
  const toDate = proposal.date || fromDate;
  const otherDay = toDate !== fromDate;
  const fromLabel = `${otherDay ? `${formatRelativeBookingDayLabel(fromDate)} ` : ""}${shortClock(booking.time)}`;
  const toLabel = `${otherDay ? `${formatRelativeBookingDayLabel(toDate)} ` : ""}${shortClock(proposal.time || booking.time)}`;
  const sentence = proposal.staff && !proposal.time
    ? handoverProposalText(type, name, booking.staff || "", proposal.staff)
    : timeProposalText(type, name, fromLabel, toLabel);
  const until = proposal.expiresAt
    ? new Date(proposal.expiresAt).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tehran" })
    : "";
  const send = async (action) => {
    setAnswering(action);
    const ok = await onAnswer(booking, action);
    setAnswering("");
    return ok;
  };
  return (
    <div className="cbProposal" role="group" aria-label="پیشنهاد ساعت دیگه">
      <b>{sentence}</b>
      {proposal.time ? (
        <div className="cbProposalTimes">
          <s aria-label="ساعت فعلی">{fromLabel}</s>
          <ArrowLeft size={16} aria-hidden="true" />
          <strong aria-label="ساعت پیشنهادی">{toLabel}</strong>
        </div>
      ) : null}
      <p>تا قبول نکنی، نوبتت همون‌طور که بود می‌مونه.{until ? ` تا ساعت ${until} وقت داری جواب بدی.` : ""}</p>
      <div className="cbProposalActions">
        <button type="button" className="is-accept" disabled={Boolean(answering)} onClick={() => send("accept")}>
          {answering === "accept" ? "یه لحظه…" : ACCEPT_LABEL}
        </button>
        <button type="button" disabled={Boolean(answering)} onClick={() => send("cancel")}>
          {answering === "cancel" ? "دارم لغو می‌کنم…" : CLIENT_CANCEL_LABEL}
        </button>
        <button type="button" onClick={onCall}>{CALL_PLACE_LABEL[type]}</button>
      </div>
    </div>
  );
}

/** The salon or artist a booking belongs to, as a connection id. */
function placeIdOf(booking) {
  return String(booking?.bookingSource === "artist"
    ? booking.artistUserId || booking.sourceArtistUserId || ""
    : booking?.salon_user_id || booking?.sourceSalonUserId || booking?.salonUserId || "");
}

/**
 * Whether the client follows (is connected to) this place: null while unknown, then true/false.
 * A booking can outlive the follow (history re-booking never follows), so the sheet offers it here.
 */
function useFollowing(placeId, onNotice) {
  const [state, setState] = useState({ id: "", following: null });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!placeId) return undefined;
    let alive = true;
    listConnections().then(({ ok, data }) => {
      if (!alive || !ok) return;
      const list = Array.isArray(data?.connections) ? data.connections : [];
      setState({ id: placeId, following: list.some((item) => String(item.id) === placeId) });
    }).catch(() => {});
    return () => { alive = false; };
  }, [placeId]);

  const follow = async () => {
    setBusy(true);
    try {
      const { ok, payload } = await connectTo(placeId);
      if (ok) {
        setState({ id: placeId, following: true });
        const name = payload?.data?.profile?.name;
        onNotice?.(name ? `${name} اضافه شد به سالن و آرتیست‌هات.` : "اضافه شد.");
      } else {
        onNotice?.(payload?.error || "وصل نشد؛ دوباره بزن.");
      }
    } catch {
      onNotice?.("وصل نشد؛ دوباره بزن.");
    } finally {
      setBusy(false);
    }
  };
  return { following: state.id === placeId ? state.following : null, busy, follow };
}

/**
 * Client role — booking details / quick actions sheet.
 * Presentational: selected booking + call/close callbacks.
 */
export function ClientBookingSettingsModal({
  booking,
  onClose,
  onCallSalon,
  onRebookSalon,
  onOpenPlace,
  onNotice,
  onCancelBooking,
  onAnswerOffer,
  onAnswerProposal
}) {
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const placeId = placeIdOf(booking);
  const { following, busy: followBusy, follow } = useFollowing(placeId, onNotice);
  if (!booking) return null;

  const avatar = booking.salonAvatar || booking.salon_avatar || "";
  const salonName = booking.salonName || booking.salon_name || "سالن منتخب";
  const phone = booking.salonPhone || booking.salon_phone || booking.phone || "";
  const rawDate = booking.booking_date || booking.date || "";
  const formattedDate = rawDate ? formatRelativeBookingDayLabel(rawDate) : "امروز";
  const statusTone = bookingStatusTone(booking.status || "تازه");
  const StatusIcon = BOOKING_STATUS_ICONS[statusTone];
  const area = booking.salonArea || booking.salon_area || "";
  const duration = Number(booking.duration_minutes) || 0;
  const offer = booking.bookingSource === "artist" ? null : bookingTimeOffer(booking);
  const waitNote = statusTone === "pending" && !offer ? requestWaitNote(booking) : "";
  const movedTo = movedToName(booking);
  const proposal = openProposalOf(booking);
  const gone = isPlaceGone(booking);
  const callPlace = () => {
    if (typeof onCallSalon === "function") {
      onCallSalon(booking);
      return;
    }
    if (phone) window.location.href = `tel:${toLatinDigits(phone)}`;
  };

  return (
    <div
      className="clientBookingSettingsBackdrop"
      role="dialog"
      aria-modal="true"
      aria-label="جزئیات نوبت"
      onClick={onClose}
    >
      <div className="clientBookingSettingsWrap" onClick={(event) => event.stopPropagation()}>
        <div className="clientBookingSettings">
          <div className="clientBookingSettingsHead">
            <span className={`clientBookingSettingsAvatar ${avatar ? "hasImage" : ""}`} aria-hidden="true">
              {avatar ? <img src={avatar} alt="" /> : String(salonName || "س").slice(0, 1)}
            </span>
            <div>
              <small>جزئیات نوبت</small>
              <b className="svcInline"><ServiceIcon emoji={booking.service_emoji} name={booking.service} size="xs" />{shortServiceLabel(booking.service) || "خدمت زیبایی"}</b>
              <em>{salonName}</em>
            </div>
            <strong className={`clientBookingSettingsStatus is-${statusTone}`}>
              <StatusIcon size={13} />
              {booking.status === "تایید شده" && hasBookingStarted(booking) ? "گذشته" : bookingStatusLabel(booking.status)}
            </strong>
          </div>
          <div className="clientBookingSettingsGrid">
            <span>
              <CalendarCheck size={14} /> <b>تاریخ</b>
              <em>{formattedDate}</em>
            </span>
            {booking.time ? (
              <span>
                <Clock3 size={14} /> <b>ساعت</b>
                <em>{toPersianDigits(toLatinDigits(booking.time))}</em>
              </span>
            ) : null}
            {duration ? (
              <span>
                <Clock3 size={14} /> <b>مدت</b>
                <em>{toPersianDigits(duration)} دقیقه</em>
              </span>
            ) : null}
            {area ? (
              <span>
                <MapPin size={14} /> <b>کجا</b>
                <em>{area}</em>
              </span>
            ) : null}
          </div>
          {offer && onAnswerOffer ? (
            <TimeOfferBlock
              booking={booking}
              offer={offer}
              onAnswer={async (target, accept) => {
                if (await onAnswerOffer(target, accept)) onClose?.();
              }}
            />
          ) : null}
          {proposal && onAnswerProposal ? (
            <ProposalBlock
              booking={booking}
              proposal={proposal}
              onCall={callPlace}
              onAnswer={async (target, action) => {
                const ok = await onAnswerProposal(target, action);
                if (ok) onClose?.();
                return ok;
              }}
            />
          ) : null}
          {booking.status === "لغو" && booking.cancelled_by === "provider" && !gone ? (
            <p className="cbGone"><XCircle size={15} aria-hidden="true" />{cancelledByProviderText(booking.bookingSource === "artist" ? "artist" : "salon", booking.salonName || booking.salon_name || "")}</p>
          ) : null}
          {!proposal && booking.proposal_lapsed_at && !booking.no_show_at && !hasBookingStarted(booking) && booking.status !== "لغو" ? (
            <p className="clientBookingPendingNote"><Clock3 size={14} aria-hidden="true" />{proposalLapsedLine(booking)}</p>
          ) : null}
          {booking.no_show_at && booking.status !== "لغو" ? (
            <div className="cbNoShow" role="status">
              <p><XCircle size={15} aria-hidden="true" />{noShowClientText(booking.bookingSource === "artist" ? "artist" : "salon", booking.salonName || booking.salon_name || "")}</p>
              <button
                type="button"
                onClick={() => openSupport({
                  view: "new",
                  category: "complaint",
                  subject: `«نیومد» اشتباهه: ${shortServiceLabel(booking.service) || "نوبت"} در ${booking.salonName || booking.salon_name || "سالن"}، ${formatRelativeBookingDayLabel(booking.booking_date || booking.date || "")} ${toPersianDigits(booking.time || "")}`
                })}
              >
                {NO_SHOW_WRONG_LABEL}
              </button>
            </div>
          ) : null}
          {gone ? (
            <p className="cbGone"><Store size={15} aria-hidden="true" />{booking.bookingSource === "artist" ? ARTIST_GONE_TEXT : SALON_GONE_TEXT}</p>
          ) : null}
          {waitNote ? (
            <p className="clientBookingPendingNote">
              <Clock3 size={14} />
              {waitNote}
            </p>
          ) : null}
          {movedTo ? (
            <p className="clientBookingPendingNote">
              <Clock3 size={14} />
              {booking.bookingSource === "artist" ? "این آرتیست" : "این سالن"} به‌موقع جواب نداد؛ همین درخواست رو برای {movedTo} فرستادیم.
            </p>
          ) : null}
          <div className="clientBookingSettingsActions">
            {gone ? null : (
            <button
              type="button"
              className="primary"
              onClick={callPlace}
            >
              <Phone size={16} />
              تماس
            </button>
            )}
            {isBookingSettled(booking) ? (
              <button type="button" onClick={() => onRebookSalon?.(booking)}>
                <RotateCcw size={16} />
                دوباره نوبت بگیر
              </button>
            ) : null}
          </div>
          {placeId && onOpenPlace ? (
            <div className="cbPlace">
              <button type="button" className="cbPlaceOpen" onClick={() => onOpenPlace(booking)}>
                <Store size={16} aria-hidden="true" />
                {booking.bookingSource === "artist" ? "صفحهٔ آرتیست" : "صفحهٔ سالن"}
              </button>
              {following === false ? (
                <button type="button" className="cbPlaceFollow" disabled={followBusy} onClick={follow}>
                  <UserPlus size={16} aria-hidden="true" />
                  {followBusy ? "دارم وصل می‌کنم…" : "وصل شو"}
                </button>
              ) : null}
            </div>
          ) : null}
          {canClientCancel(booking) && onCancelBooking && !offer ? (
            confirming ? (
              <div className="cbCancelConfirm" role="alertdialog" aria-label="لغو نوبت">
                <p>این نوبت لغو بشه؟ سالن همون لحظه خبردار می‌شه.</p>
                <div>
                  <button
                    type="button"
                    className="is-danger"
                    disabled={cancelling}
                    onClick={async () => {
                      setCancelling(true);
                      const ok = await onCancelBooking(booking);
                      setCancelling(false);
                      if (ok) {
                        setConfirming(false);
                        onClose?.();
                      }
                    }}
                  >
                    {cancelling ? "دارم لغو می‌کنم…" : "آره، لغو کن"}
                  </button>
                  <button type="button" disabled={cancelling} onClick={() => setConfirming(false)}>نه، بمونه</button>
                </div>
              </div>
            ) : (
              <button type="button" className="cbCancelBtn" onClick={() => setConfirming(true)}>
                <XCircle size={16} /> لغو نوبت
              </button>
            )
          ) : null}
        </div>
        <SheetClose onClick={onClose} />
      </div>
    </div>
  );
}
