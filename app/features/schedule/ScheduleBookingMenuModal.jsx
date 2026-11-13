"use client";

import { useEffect, useState } from "react";
import { ServiceIcon } from "../../components/ServiceIcon";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  Phone,
  Timer,
  TimerOff,
  Trash2,
  UserRound,
  UserX,
  X,
  XCircle
} from "lucide-react";
import { getBookingDateOffsetDays, getBookingTimelinePhase } from "../artist/bookingUtils";
import { formatRelativeBookingDayLabel, isPersianDateKey } from "../../shared/lib/persianCalendar";
import { SegmentClock } from "../../components/SegmentClock";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { bookingWaitMinutes, requestMinutesLeft } from "../../shared/lib/bookingWindow";
import { RequestExpiryBadge } from "./RequestExpiryBadge";
import { isMultiPartBooking, parseBookingParts, scheduleBookingParts } from "../../shared/lib/bookingParts";
import { ArtistOptionList, ArtistPickSheet, BookingPartsEditor } from "./BookingPartsEditor";
import { ArtistBookingPlace } from "./ArtistBookingPlace";
import { useBackHandler } from "../../shared/hooks/useBackHandler";
import { AWAITING_CLIENT, bookingTimeOffer } from "../../shared/lib/bookingOffer";
import { bookingStatusLabel, hasBookingEnded } from "../client/bookingStatus";
import { CALL_FIRST_TEXT, CANCEL_WITH_NOTICE, CLIENT_CAN_CALL, NO_SHOW_HOURS, NO_SHOW_LABEL, NO_SHOW_UNDO_LABEL, PROPOSE_LABEL, noShowPhase, shortClock, startsSoon } from "../../shared/lib/providerRules";
import { MoveTimeList } from "./MoveTimeList";
import { AutoAssignCard, useStaffAvailability } from "./StaffAutoAssign";
import { ClientTrust } from "./ClientTrust";

// Shown when a customer / staff member / source has no uploaded photo.
const DEFAULT_AVATAR = "/profile-icon.svg";

// ownerType-aware status-tone mapping — same convention as
// ScheduleRow.jsx's getBookingStatusTone (duplicated on purpose per this
// codebase's convention for small component-local helpers; see that file
// for why "تازه" needs to resolve differently for salon vs artist
// bookings). This modal is shared by the salon AND artist owner schedule
// views, and used to always render booking.status in one fixed green pill
// no matter what the real status was (so a cancelled or expired booking
// looked identical to a confirmed one).
function getBookingStatusTone(status = "", ownerType = "salon") {
  if (status === "تایید" || status === "تایید شده") return "done";
  if (status === "لغو") return "bad";
  if (status === "منقضی شده") return "expired";
  if (status === "درخواست") return "pending";
  if (status === "تازه") return ownerType === "artist" ? "pending" : "done";
  return "pending";
}

// A booking is "past" once its day is behind us, or it is today and its
// time slot has already ended. Past bookings are review-only.
function isBookingInPast(booking) {
  const date = String(booking?.source?.booking_date || booking?.booking_date || booking?.date || "").trim();
  if (booking?.phase === "done") return true;
  if (isPersianDateKey(date)) {
    const offset = getBookingDateOffsetDays(date);
    if (offset < 0) return true;
    if (offset > 0) return false;
  }
  return getBookingTimelinePhase(
    { date: isPersianDateKey(date) ? "امروز" : date, time: booking?.time },
    { durationMinutes: booking?.durationMinutes }
  ) === "done";
}

const BOOKING_STATUS_ICONS = {
  pending: Clock3,
  done: CheckCircle2,
  bad: XCircle,
  expired: TimerOff
};

/**
 * The salon/artist booking screen: opened from a schedule row, and opened on its own the moment
 * a client's request arrives (ScheduleMenuHost). It fills the whole app: details and artists
 * scroll, the answer (approve / decline) and the bar (change time / call / close) stay at the
 * bottom. Presentational: booking/view + callbacks from the shell; the phone's back button goes
 * back from «تغییر ساعت», then closes.
 */
export function ScheduleBookingMenuModal({
  open,
  booking,
  view = "menu",
  onViewChange,
  staffOptions = [],
  onClose,
  onChangeTime,
  onChangeStaff,
  onChangeParts,
  onAutoAssign,
  onCancel,
  onWithdrawProposal,
  onNoShow,
  onApprove,
  onDecline,
  missingService = false,
  busy = false
}) {
  // The artist picker opens inline; reset per booking because this screen
  // instance is reused rather than remounted per booking.
  const [artistPickerOpen, setArtistPickerOpen] = useState(false);
  const [cancelAsk, setCancelAsk] = useState(false);
  const [noShowAsk, setNoShowAsk] = useState(false);
  useEffect(() => {
    setArtistPickerOpen(false);
    setCancelAsk(false);
    setNoShowAsk(false);
  }, [booking?.id]);

  const visible = Boolean(open && booking);
  const isSalonOwner = booking?.ownerType === "salon";
  const isPast = visible ? isBookingInPast(booking) : false;
  const isCancelled = booking?.status === "لغو" || booking?.status === "منقضی شده";
  // Past or settled bookings can be reviewed, never edited.
  const readOnly = isPast || isCancelled;
  // «نیومد» (owner's decision of 2026-10-25): a confirmed booking of the salon's own, or an independent artist's direct
  // one, that has started can't be cancelled or moved any more; until 24 hours after the start it can be marked «نیومد».
  const ownConfirmed = visible && (isSalonOwner
    ? ["تایید شده", "تازه"].includes(booking?.status)
    : !booking?.sourceSalon?.name && ["تایید", "تایید شده"].includes(booking?.status));
  const noShowAt = ownConfirmed ? noShowPhase(booking?.booking_date || booking?.dateKey || booking?.date || "", booking?.time) : null;
  const started = noShowAt === "open" || noShowAt === "closed";
  const markedNoShow = Boolean(booking?.no_show_at || booking?.noShowAt);
  const canManage = visible && isSalonOwner && !readOnly && !started;
  // An independent artist's own confirmed booking ahead: the salon's «پیشنهاد ساعت دیگه» and call-first cancel
  // (owner's decision of 2026-10-25), nothing else (no artists to pick).
  const canArtistManage = visible && !isSalonOwner && ownConfirmed && !readOnly && !started;
  const staffState = useStaffAvailability(booking, canManage);

  useBackHandler(visible, () => {
    if (view !== "menu") {
      onViewChange?.("menu");
      return;
    }
    onClose?.();
  });

  if (!visible) return null;

  // Same "not yet reviewed" definition ScheduleRow.jsx/getBookingStatusTone
  // above use — "درخواست" for either role, "تازه" only counts as pending for
  // an artist (a salon's own "تازه" walk-in entry is already settled).
  const sourceSalon = booking.sourceSalon || {};
  // An artist answers only their own (direct) bookings; one from a salon is the salon's to accept.
  const isPendingReview = isSalonOwner
    ? booking.status === "درخواست"
    : !sourceSalon.name && (booking.status === "درخواست" || booking.status === "تازه");
  // Always show a logo: the uploaded photo when there is one, else the app's default profile icon.
  const avatar = booking.clientAvatar || booking.client_avatar || sourceSalon.avatar || DEFAULT_AVATAR;
  const title = booking.client || booking.salonName || sourceSalon.name || "نوبت";
  const multiPart = isSalonOwner && isMultiPartBooking(booking);
  const parsedParts = multiPart ? parseBookingParts(booking.parts) : [];
  const partStaff = [...new Set(parsedParts.map((part) => part.staff).filter(Boolean))];
  const phone = booking.phone || booking.clientPhone || booking.client_phone || "";
  // Who is doing it, shown as faces on the header's far side: the salon's artists (one per
  // service on a multi-service visit), or for an artist the salon the booking came from.
  const team = isSalonOwner
    ? (multiPart ? partStaff : [booking.staff].filter(Boolean)).map((name) => {
      const person = staffOptions.find((item) => item.name === name);
      return {
        name,
        avatar: (name === booking.staff && booking.staffAvatar) || person?.avatar || person?.staff_avatar || DEFAULT_AVATAR
      };
    })
    : sourceSalon.name ? [{ name: sourceSalon.name, avatar: sourceSalon.avatar || DEFAULT_AVATAR }] : [];
  const services = multiPart ? scheduleBookingParts(booking.time, booking.parts) : [];
  const dateValue = booking.booking_date || booking.date || "امروز";
  const dateLabel = isPersianDateKey(dateValue) ? toPersianDigits(formatRelativeBookingDayLabel(dateValue)) : dateValue;
  const currentArtist = staffOptions.find((person) => person.name === booking.staff);
  const currentArtistAvatar = booking.staffAvatar || currentArtist?.avatar || DEFAULT_AVATAR;
  const actionDisabled = Boolean(busy);
  const statusTone = markedNoShow ? "bad" : getBookingStatusTone(booking.status || "درخواست", isSalonOwner ? "salon" : "artist");
  const StatusIcon = BOOKING_STATUS_ICONS[statusTone];
  const currentStaff = multiPart ? parsedParts.map((part) => part.staff) : [String(booking.staff || "").trim()];
  const createdAt = booking.createdAt || booking.created_at || "";
  const waitMinutes = bookingWaitMinutes(booking);
  const minutesLeft = requestMinutesLeft(createdAt, dateValue, booking.time, { windowMinutes: waitMinutes });
  const showReview = isPendingReview && !readOnly;
  const timeView = view === "time";
  // A CONFIRMED booking is a promise to the client (owner's rules of 2026-10-22): moving it is a proposal the client
  // accepts, and cancelling it tells the client (the call comes first when it starts within 24 hours).
  const confirmed = (isSalonOwner && ["تایید شده", "تازه"].includes(booking.status)) || canArtistManage;
  const hasAccount = Boolean(booking.client_user_id || booking.clientUserId);
  const soon = confirmed && startsSoon(booking.booking_date || booking.date || "", booking.time);
  const proposal = confirmed ? booking.proposal || null : null;
  const timeLabel = confirmed && hasAccount ? PROPOSE_LABEL : "تغییر ساعت";
  const canMove = canManage || (canArtistManage && hasAccount);
  const canCancel = canManage || canArtistManage;

  return (
    <div className="sbmScreen" role="dialog" aria-modal="true" aria-label={`نوبت ${title}`}>
      <div className="clientBookingSettings scheduleBookingSettings sbmBody">
        <div className="clientBookingSettingsHead">
          <span className="clientBookingSettingsAvatar hasImage" aria-hidden="true">
            <img src={avatar} alt="" />
          </span>
          <div className="sbmWho">
            {timeView || readOnly ? <small>{timeView ? timeLabel : "جزئیات نوبت، فقط دیدنی"}</small> : null}
            <b>{title}</b>
            <strong className={`clientBookingSettingsStatus is-${statusTone}${showReview ? " is-live" : ""}`}>
              <StatusIcon size={11} />
              {markedNoShow ? NO_SHOW_LABEL : booking.status === AWAITING_CLIENT ? AWAITING_CLIENT : bookingStatusLabel(booking.status || "درخواست", { ended: hasBookingEnded(booking), waitsOnSalon: Boolean(!isSalonOwner && sourceSalon.name && statusTone === "pending") })}
            </strong>
            {/* The number is the call button (owner's review, 2026-11-08): one place for the phone, not a row plus a button. */}
            {phone ? (
              <button
                type="button"
                className="sbmCall"
                aria-label={`تماس با ${title}`}
                onClick={() => { window.location.href = `tel:${toLatinDigits(phone)}`; }}
              >
                <Phone size={13} aria-hidden="true" />
                <span dir="ltr">{toPersianDigits(phone)}</span>
              </button>
            ) : null}
          </div>
          {isSalonOwner ? null : team.length ? (
            <div className="sbmTeam" aria-label={`${isSalonOwner ? "آرتیست‌ها" : "سالن"}: ${team.map((person) => person.name).join("، ")}`}>
              <span className="sbmTeamFaces" aria-hidden="true">
                {team.slice(0, 3).map((person) => (
                  <img key={person.name} src={person.avatar} alt="" />
                ))}
                {team.length > 3 ? <i>+{toPersianDigits(team.length - 3)}</i> : null}
              </span>
              <small aria-hidden="true">{team.map((person) => person.name).join(" · ")}</small>
            </div>
          ) : (
            <div className="sbmTeam is-empty">
              <span className="sbmTeamFaces" aria-hidden="true"><UserRound size={16} /></span>
              <small>نوبت خودت</small>
            </div>
          )}
          <button type="button" className="sbmX" aria-label="بستن" onClick={onClose}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {timeView ? (
          <div className="clientBookingSettingsTime">
            <SegmentClock value={booking.time || "زمان"} size="sm" as="span" backgroundColor="transparent" />
          </div>
        ) : null}

        {!timeView ? (
          <>
            {/* One line for when (owner's review, 2026-11-08): the big clock and the date/time rows said it twice. */}
            {/* «تغییر ساعت» lives on the line it changes (owner's review, 2026-11-08): no bar at the bottom. */}
            <div className="sbmWhen">
              <CalendarCheck size={16} aria-hidden="true" />
              <b>{dateLabel}</b>
              <span>
                {multiPart
                  ? `${toPersianDigits(services[0].startLabel)} تا ${toPersianDigits(services[services.length - 1].endLabel)}`
                  : toPersianDigits(booking.time || "")}
              </span>
              {canMove ? (
                <button type="button" className="sbmWhenEdit" disabled={actionDisabled} onClick={() => onViewChange?.("time")}>
                  <Timer size={14} aria-hidden="true" />
                  {timeLabel}
                </button>
              ) : null}
            </div>
            {multiPart ? null : (
              <p className="sbmService">
                <ServiceIcon emoji={booking.service_emoji} name={booking.service} size="sm" />
                <b>{booking.service || "خدمت زیبایی"}</b>
              </p>
            )}
            {/* A client asked for something not on the menu (owner, 2026-11-12): accepting puts it on the menu. */}
            {showReview && missingService ? <p className="sbmMissing">توی خدماتت نیست</p> : null}

            <ClientTrust booking={booking} />

            {!isSalonOwner && !readOnly && !started && !sourceSalon.name && booking.id != null ? <ArtistBookingPlace booking={booking} /> : null}

            {canManage && staffState.ready ? (
              <AutoAssignCard
                current={currentStaff}
                suggested={staffState.suggested}
                services={multiPart ? parsedParts.length : 1}
                disabled={actionDisabled}
                onAutoAssign={onAutoAssign}
                fresh={showReview}
              />
            ) : null}

            {multiPart ? (
              <BookingPartsEditor
                booking={booking}
                staffOptions={staffOptions}
                availability={staffState.availability}
                disabled={!canManage || actionDisabled}
                onChange={onChangeParts}
              />
            ) : isSalonOwner ? (
              <div className={`scheduleBookingArtist ${artistPickerOpen ? "is-open" : ""}${booking.staff ? "" : " is-empty"}`}>
                <button
                  type="button"
                  className="scheduleBookingArtistCurrent"
                  disabled={!canManage || actionDisabled}
                  aria-expanded={canManage ? artistPickerOpen : undefined}
                  aria-haspopup={canManage ? "listbox" : undefined}
                  onClick={() => canManage && setArtistPickerOpen((value) => !value)}
                >
                  <span className="scheduleStaffAvatar hasImage" aria-hidden="true">
                    {booking.staff ? <img src={currentArtistAvatar} alt="" /> : <UserRound size={16} />}
                  </span>
                  <span className="scheduleBookingArtistCopy">
                    <small>آرتیست</small>
                    <b>{booking.staff ? currentArtist?.artist_name || booking.staff : canManage ? "یه آرتیست انتخاب کن" : "هنوز آرتیست نداره"}</b>
                  </span>
                  {canManage ? <ChevronDown size={16} className="scheduleBookingArtistChevron" aria-hidden="true" /> : null}
                </button>
                <ArtistPickSheet
                  open={canManage && artistPickerOpen}
                  title={`آرتیست ${booking.service || "این نوبت"}`}
                  subtitle={`${dateLabel}، ${toPersianDigits(booking.time || "")}`}
                  onClose={() => setArtistPickerOpen(false)}
                >
                  <ArtistOptionList
                    staffOptions={staffOptions}
                    current={booking.staff || ""}
                    availability={staffState.availability[0] || null}
                    label="انتخاب آرتیست"
                    disabled={actionDisabled}
                    onPick={async (name, active) => {
                      if (active) {
                        setArtistPickerOpen(false);
                        return;
                      }
                      const ok = await onChangeStaff?.(name);
                      if (ok !== false) setArtistPickerOpen(false);
                    }}
                  />
                </ArtistPickSheet>
              </div>
            ) : null}

            {isSalonOwner && !readOnly && bookingTimeOffer(booking) ? (
              <p className="scheduleBookingReadOnlyNote is-offer">
                <Timer size={14} aria-hidden="true" />
                ساعت تازه رفت برای مشتری (قبلاً {toPersianDigits(bookingTimeOffer(booking).fromTime)} بود)؛ تا جواب نده، «منتظر مشتری» می‌مونه.
              </p>
            ) : null}

            {proposal && !readOnly ? (
              <div className="pxNote" role="status">
                <p>
                  {proposal.time
                    ? `ساعت ${shortClock(proposal.time)} رو به مشتری پیشنهاد دادی.`
                    : `آرتیست «${proposal.staff}» رو به مشتری پیشنهاد دادی.`}
                  {" "}تا قبول نکنه، نوبت همون‌طور که بود می‌مونه.
                </p>
                {onWithdrawProposal ? (
                  <button type="button" className="pxBtn" disabled={actionDisabled} onClick={onWithdrawProposal}>پیشنهاد رو پس بگیر</button>
                ) : null}
              </div>
            ) : null}

            {noShowAt === "open" && onNoShow ? (
              markedNoShow ? (
                <div className="pxNote is-noshow" role="status">
                  <p>زدی که {booking.client || "مشتری"} نیومد. روی نوبتش همین رو می‌بینه.</p>
                  <button type="button" className="pxBtn" disabled={actionDisabled} onClick={() => onNoShow(false)}>{NO_SHOW_UNDO_LABEL}</button>
                </div>
              ) : noShowAsk ? (
                <div className="pxCancelPanel" role="alertdialog" aria-label="مشتری نیومد">
                  <p>مطمئنی {booking.client || "مشتری"} نیومد؟ روی نوبتش می‌بینه که زدی نیومده. پیامکی نمی‌ره.</p>
                  <div>
                    <button type="button" className="pxBtn is-danger" disabled={actionDisabled} onClick={async () => { if (await onNoShow(true)) setNoShowAsk(false); }}>{busy ? "یه لحظه…" : "آره، نیومد"}</button>
                    <button type="button" className="pxBtn" disabled={actionDisabled} onClick={() => setNoShowAsk(false)}>نه</button>
                  </div>
                </div>
              ) : (
                <div className="pxNote is-started" role="group" aria-label="بعد از ساعت نوبت">
                  <p>ساعت نوبت رسیده و دیگه لغو نمی‌شه. اگه مشتری نیومد، تا {toPersianDigits(NO_SHOW_HOURS)} ساعت بعدش می‌تونی «نیومد» رو بزنی.</p>
                  <button type="button" className="pxBtn is-dangerSoft" disabled={actionDisabled} onClick={() => setNoShowAsk(true)}><UserX size={15} aria-hidden="true" />{NO_SHOW_LABEL}</button>
                </div>
              )
            ) : null}

            {readOnly && !(noShowAt === "open" && onNoShow) ? (
              <p className="scheduleBookingReadOnlyNote">
                <Eye size={14} aria-hidden="true" />
                {isCancelled && booking.client_account_deleted_at
                  ? `${booking.client || "مشتری"} حسابش رو از فرفرو پاک کرد و این نوبت لغو شد.`
                  : isCancelled ? "این نوبت بسته شده؛ فقط می‌شه دیدش." : markedNoShow ? "مشتری نیومد؛ این نوبت بسته شده." : "این نوبت گذشته؛ فقط می‌شه دیدش."}
              </p>
            ) : null}

            {canCancel && !isPendingReview && cancelAsk && confirmed ? (
              <div className="pxCancelPanel" role="alertdialog" aria-label="لغو نوبت تأییدشده">
                <p>{soon ? CALL_FIRST_TEXT : "این نوبت تأیید شده بود و مشتری روش حساب کرده."}</p>
                {phone && (soon || !hasAccount) ? (
                  <a className="pxBtn" href={`tel:${toLatinDigits(phone)}`}><Phone size={15} aria-hidden="true" />{CLIENT_CAN_CALL}<span dir="ltr">{toPersianDigits(phone)}</span></a>
                ) : null}
                <p>
                  {hasAccount
                    ? "لغوش کنی، مشتری با اعلان و پیامک خبردار می‌شه: «ببخشید؛ یه نوبت دیگه بگیر.»"
                    : (phone ? "لغوش کنی، مشتری پیامک می‌گیره: «ببخشید؛ یه نوبت دیگه بگیر.»" : "شماره‌ای ازش نداریم؛ خودت خبرش کن.")}
                </p>
                <div>
                  <button type="button" className="pxBtn is-danger" disabled={actionDisabled} onClick={() => onCancel?.()}>{busy ? "دارم لغو می‌کنم…" : CANCEL_WITH_NOTICE}</button>
                  <button type="button" className="pxBtn" disabled={actionDisabled} onClick={() => setCancelAsk(false)}>نه، بمونه</button>
                </div>
              </div>
            ) : canCancel && !isPendingReview ? (
              <button
                type="button"
                className="sbmCancel"
                disabled={actionDisabled}
                onClick={() => {
                  if (confirmed) {
                    setCancelAsk(true);
                    return;
                  }
                  if (typeof window !== "undefined" && !window.confirm("این نوبت لغو بشه؟")) return;
                  onCancel?.();
                }}
              >
                <Trash2 size={15} aria-hidden="true" />
                لغو این نوبت
              </button>
            ) : null}
          </>
        ) : (
          <>
            <button type="button" className="scheduleBookingBack sbmBack" disabled={actionDisabled} onClick={() => onViewChange?.("menu")}>
              <ArrowRight size={15} aria-hidden="true" />
              برگرد به جزئیات
            </button>
            {(isSalonOwner || canArtistManage) && hasAccount ? (
              <p className="scheduleBookingReadOnlyNote is-offer">
                {confirmed
                  ? "ساعت پیشنهادی می‌ره برای مشتری. تا قبول نکنه، نوبت همون ساعت قبلی می‌مونه."
                  : "ساعت تازه می‌ره برای مشتری تا قبول یا رد کنه."}
              </p>
            ) : null}
            <MoveTimeList
              booking={booking}
              disabled={actionDisabled}
              onPick={(time, overtime) => onChangeTime?.(time, { overtime })}
            />
          </>
        )}
      </div>

      {/* Only the answer stays at the bottom (owner's review, 2026-11-08): close is the × above, call is the number, the time is changed on its line. */}
      {showReview && !timeView ? (
        <footer className="sbmFoot">
          <div className="scheduleBookingReviewActions">
            <RequestExpiryBadge createdAt={createdAt} day={dateValue} time={booking.time} waitMinutes={waitMinutes} />
            <button type="button" className="is-approve" disabled={actionDisabled || (minutesLeft !== null && minutesLeft <= 0)} onClick={onApprove}>
              <Check size={17} />
              {busy ? "یه لحظه…" : missingService ? "اضافه کن و قبول کن" : "تأیید"}
            </button>
            <button type="button" className="is-decline" disabled={actionDisabled} onClick={onDecline}>
              <X size={17} />
              {missingService ? "انجام نمی‌دم" : "رد"}
            </button>
          </div>
        </footer>
      ) : null}
    </div>
  );
}
