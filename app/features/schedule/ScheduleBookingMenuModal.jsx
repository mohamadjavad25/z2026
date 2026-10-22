"use client";

import { useEffect, useMemo, useState } from "react";
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
  Scissors,
  Sparkles,
  Timer,
  TimerOff,
  Trash2,
  UserRound,
  X,
  XCircle
} from "lucide-react";
import { getBookingDateOffsetDays, getBookingTimelinePhase } from "../artist/bookingUtils";
import { formatRelativeBookingDayLabel, isPersianDateKey } from "../../shared/lib/persianCalendar";
import { SegmentClock } from "../../components/SegmentClock";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { normalizeBookingTimeLabel } from "../../shared/lib/time";
import { bookingWaitMinutes, requestMinutesLeft } from "../../shared/lib/bookingWindow";
import { RequestExpiryBadge } from "./RequestExpiryBadge";
import { isMultiPartBooking, parseBookingParts, scheduleBookingParts } from "../../shared/lib/bookingParts";
import { ArtistOptionList, BookingPartsEditor } from "./BookingPartsEditor";
import { getSalonBookingMoveTimes, getSalonBookingStaffOptions } from "../../shared/api/salons";
import { useBackHandler } from "../../shared/hooks/useBackHandler";
import { AWAITING_CLIENT, bookingTimeOffer } from "../../shared/lib/bookingOffer";
import { CALL_FIRST_TEXT, CANCEL_WITH_NOTICE, CLIENT_CAN_CALL, PROPOSE_LABEL, shortClock, startsSoon } from "../../shared/lib/providerRules";

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
 * «تغییر ساعت»: only the times this booking really fits at, asked from the server with the same
 * rules the move itself is checked by -- its services with their artists, nothing else in the
 * way, ending by closing time. Times that run past closing come last, marked with how much
 * longer the salon would stay, and are sent only as a deliberate choice.
 */
function MoveTimeList({ booking, disabled, onPick }) {
  const [state, setState] = useState({ id: null, loading: true, times: [], close: "", closed: false, failed: false });
  useEffect(() => {
    let alive = true;
    setState({ id: booking.id, loading: true, times: [], close: "", closed: false, failed: false });
    getSalonBookingMoveTimes(booking.id).then(({ ok, data }) => {
      if (!alive) return;
      setState({ id: booking.id, loading: false, times: ok ? data.times || [] : [], close: data?.close || "", closed: Boolean(data?.closed), failed: !ok });
    }).catch(() => {
      if (alive) setState({ id: booking.id, loading: false, times: [], close: "", closed: false, failed: true });
    });
    return () => { alive = false; };
  }, [booking.id, booking.time, booking.parts]);

  const current = normalizeBookingTimeLabel(booking.time || "");
  const inHours = state.times.filter((option) => !option.overtimeMinutes);
  const late = state.times.filter((option) => option.overtimeMinutes > 0);
  const others = inHours.filter((option) => option.time !== current);

  if (state.loading) return <p className="sbmMoveNote">در حال پیدا کردن ساعت‌های آزاد…</p>;
  if (state.failed) return <p className="sbmMoveNote is-warn">ساعت‌های آزاد گرفته نشد؛ دوباره امتحان کن.</p>;
  if (state.closed) return <p className="sbmMoveNote is-warn">سالن در این روز تعطیل است.</p>;

  const row = (option, overtime) => {
    const active = option.time === current;
    return (
      <button
        type="button"
        key={option.time}
        className={`${active ? "is-selected" : ""}${overtime ? " is-overtime" : ""}`}
        disabled={disabled || active}
        onClick={() => {
          if (overtime && typeof window !== "undefined" && !window.confirm(
            `این نوبت تا ${toPersianDigits(option.end)} طول می‌کشد؛ یعنی ${toPersianDigits(option.overtimeMinutes)} دقیقه بیشتر از ساعت کاری بمانید. فرستاده شود؟`
          )) return;
          onPick(option.time, overtime);
        }}
      >
        <SegmentClock value={option.time} size="xs" as="span" />
        <span className="sbmMoveCopy">
          <b>تا {toPersianDigits(option.end)}</b>
          {active ? <small>ساعت فعلی</small> : overtime ? <small>{toPersianDigits(option.overtimeMinutes)} دقیقه بیشتر بمانید</small> : null}
        </span>
        {active ? <Check size={16} /> : null}
      </button>
    );
  };

  return (
    <div className="scheduleBookingPickList">
      {others.length === 0 ? (
        <p className="sbmMoveNote is-warn">
          {late.length
            ? `تا پایان ساعت کاری (${toPersianDigits(state.close)}) ساعت آزاد دیگری برای این نوبت نیست.`
            : "این روز ساعت آزاد دیگری برای این نوبت نیست."}
        </p>
      ) : null}
      {inHours.map((option) => row(option, false))}
      {late.length ? (
        <>
          <p className="sbmMoveHead">با ماندن بعد از ساعت کاری (سالن تا {toPersianDigits(state.close)} باز است)</p>
          {late.map((option) => row(option, true))}
        </>
      ) : null}
    </div>
  );
}

/**
 * Who on the team is free for each service of this booking (salon, editable bookings only),
 * fetched again whenever its day, time, split or status changes.
 * → { ready, availability: [Map(name → { free, skilled, away })] per service, suggested: [name] }
 */
function useStaffAvailability(booking, enabled) {
  const id = booking?.id;
  const key = enabled && id != null
    ? [id, booking.booking_date || "", booking.time || "", booking.parts || "", booking.staff || "", booking.status || ""].join("|")
    : "";
  const [state, setState] = useState({ key: "", parts: [], suggested: [] });
  useEffect(() => {
    if (!key) return undefined;
    let alive = true;
    const settle = (parts = [], suggested = []) => {
      if (alive) setState({ key, parts, suggested });
    };
    getSalonBookingStaffOptions(id)
      .then(({ ok, data }) => (ok ? settle(data?.parts || [], data?.suggested || []) : settle()))
      .catch(() => settle());
    return () => { alive = false; };
  }, [key, id]);
  return useMemo(() => {
    if (!key || state.key !== key) return { ready: false, availability: [], suggested: [] };
    return {
      ready: state.parts.length > 0,
      availability: state.parts.map((part) => new Map((part.options || []).map((option) => [option.name, option]))),
      suggested: state.suggested
    };
  }, [key, state]);
}

/**
 * «چیدن خودکار»: what the system would do with this booking's artists. Offered when its split
 * differs from the current one; when a service has nobody and nobody is free, says so instead.
 */
function AutoAssignCard({ current, suggested, services, disabled, onAutoAssign }) {
  const missing = current.filter((name) => !name).length;
  const differs = suggested.some((name, index) => name !== (current[index] || ""));
  const offers = suggested.some(Boolean) && differs;
  if (!offers && !missing) return null;
  if (!offers) {
    return (
      <p className="sbmAuto is-stuck">
        <UserRound size={15} aria-hidden="true" />
        <span>
          <b>{services > 1 ? `${toPersianDigits(missing)} خدمت بدون آرتیست` : "این رزرو آرتیست ندارد"}</b>
          <small>در این ساعت آرتیست آزادی نیست؛ ساعت را عوض کن یا خودت یکی را انتخاب کن.</small>
        </span>
      </p>
    );
  }
  const names = [...new Set(suggested.filter(Boolean))];
  return (
    <div className={`sbmAuto ${missing ? "is-missing" : ""}`}>
      <Sparkles size={16} aria-hidden="true" />
      <span>
        <b>{missing ? (services > 1 ? `${toPersianDigits(missing)} خدمت بدون آرتیست` : "این رزرو آرتیست ندارد") : "پیشنهاد سیستم"}</b>
        <small>{`آزادترین آرتیست‌ها: ${names.join("، ")}`}</small>
      </span>
      <button type="button" disabled={disabled} onClick={onAutoAssign}>چیدن خودکار</button>
    </div>
  );
}

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
  onApprove,
  onDecline,
  busy = false
}) {
  // The artist picker opens inline; reset per booking because this screen
  // instance is reused rather than remounted per booking.
  const [artistPickerOpen, setArtistPickerOpen] = useState(false);
  const [cancelAsk, setCancelAsk] = useState(false);
  useEffect(() => {
    setArtistPickerOpen(false);
    setCancelAsk(false);
  }, [booking?.id]);

  const visible = Boolean(open && booking);
  const isSalonOwner = booking?.ownerType === "salon";
  const isPast = visible ? isBookingInPast(booking) : false;
  const isCancelled = booking?.status === "لغو" || booking?.status === "منقضی شده";
  // Past or settled bookings can be reviewed, never edited.
  const readOnly = isPast || isCancelled;
  const canManage = visible && isSalonOwner && !readOnly;
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
  const title = booking.client || booking.salonName || sourceSalon.name || "رزرو";
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
  const statusTone = getBookingStatusTone(booking.status || "درخواست", isSalonOwner ? "salon" : "artist");
  const StatusIcon = BOOKING_STATUS_ICONS[statusTone];
  const currentStaff = multiPart ? parsedParts.map((part) => part.staff) : [String(booking.staff || "").trim()];
  const createdAt = booking.createdAt || booking.created_at || "";
  const waitMinutes = bookingWaitMinutes(booking);
  const minutesLeft = requestMinutesLeft(createdAt, dateValue, booking.time, { windowMinutes: waitMinutes });
  const showReview = isPendingReview && !readOnly;
  const timeView = view === "time";
  // A CONFIRMED booking is a promise to the client (owner's rules of 2026-10-22): moving it is a proposal the client
  // accepts, and cancelling it tells the client (the call comes first when it starts within 24 hours).
  const confirmed = isSalonOwner && ["تایید شده", "تازه"].includes(booking.status);
  const hasAccount = Boolean(booking.client_user_id || booking.clientUserId);
  const soon = confirmed && startsSoon(booking.booking_date || booking.date || "", booking.time);
  const proposal = confirmed ? booking.proposal || null : null;
  const timeLabel = confirmed && hasAccount ? PROPOSE_LABEL : "تغییر ساعت";

  return (
    <div className="sbmScreen" role="dialog" aria-modal="true" aria-label={`رزرو ${title}`}>
      <div className="clientBookingSettings scheduleBookingSettings sbmBody">
        <div className="clientBookingSettingsHead">
          <span className="clientBookingSettingsAvatar hasImage" aria-hidden="true">
            <img src={avatar} alt="" />
          </span>
          <div className="sbmWho">
            <small>
              {timeView ? timeLabel : readOnly ? "جزئیات رزرو • فقط مشاهده" : showReview ? "درخواست رزرو تازه" : "جزئیات رزرو"}
            </small>
            <b>{title}</b>
            <strong className={`clientBookingSettingsStatus is-${statusTone}${showReview ? " is-live" : ""}`}>
              <StatusIcon size={11} />
              {!isSalonOwner && sourceSalon.name && statusTone === "pending" ? "منتظر سالن" : (booking.status || "درخواست")}
            </strong>
          </div>
          {team.length ? (
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
              <small>{isSalonOwner ? "بدون آرتیست" : "رزرو شخصی"}</small>
            </div>
          )}
        </div>

        <div className="clientBookingSettingsTime">
          <SegmentClock value={booking.time || "زمان"} size="sm" as="span" backgroundColor="transparent" />
        </div>

        {!timeView ? (
          <>
            <div className="scheduleBookingDetails">
              <div className="scheduleBookingDetail">
                <CalendarCheck size={15} aria-hidden="true" />
                <span>تاریخ</span>
                <b>{dateLabel}</b>
              </div>
              {multiPart ? (
                <div className="scheduleBookingDetail">
                  <Clock3 size={15} aria-hidden="true" />
                  <span>زمان</span>
                  <b>
                    {toPersianDigits(services[0].startLabel)} تا {toPersianDigits(services[services.length - 1].endLabel)}
                    <small className="sbmCount"> · {toPersianDigits(services.length)} خدمت</small>
                  </b>
                </div>
              ) : (
                <div className="scheduleBookingDetail">
                  <Scissors size={15} aria-hidden="true" />
                  <span>خدمت</span>
                  <b className="svcInline"><ServiceIcon emoji={booking.service_emoji} name={booking.service} size="xs" />{booking.service || "خدمت زیبایی"}</b>
                </div>
              )}
              {phone ? (
                <div className="scheduleBookingDetail">
                  <Phone size={15} aria-hidden="true" />
                  <span>تلفن</span>
                  <b dir="ltr" className="sbmPhone">{toPersianDigits(phone)}</b>
                </div>
              ) : null}
            </div>

            {canManage && staffState.ready ? (
              <AutoAssignCard
                current={currentStaff}
                suggested={staffState.suggested}
                services={multiPart ? parsedParts.length : 1}
                disabled={actionDisabled}
                onAutoAssign={onAutoAssign}
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
                    <b>{booking.staff ? currentArtist?.artist_name || booking.staff : canManage ? "انتخاب آرتیست" : "آرتیست ثبت نشده"}</b>
                  </span>
                  {canManage ? <ChevronDown size={16} className="scheduleBookingArtistChevron" aria-hidden="true" /> : null}
                </button>
                {canManage && artistPickerOpen ? (
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
                ) : null}
              </div>
            ) : null}

            {isSalonOwner && !readOnly && bookingTimeOffer(booking) ? (
              <p className="scheduleBookingReadOnlyNote is-offer">
                <Timer size={14} aria-hidden="true" />
                ساعت تازه برای مشتری فرستاده شد (قبلاً {toPersianDigits(bookingTimeOffer(booking).fromTime)})؛ تا قبول یا رد کند، «{AWAITING_CLIENT}» می‌ماند.
              </p>
            ) : null}

            {proposal && !readOnly ? (
              <div className="pxNote" role="status">
                <p>
                  {proposal.time
                    ? `پیشنهاد ساعت ${shortClock(proposal.time)} برای مشتری فرستاده شد.`
                    : `پیشنهاد آرتیست «${proposal.staff}» برای مشتری فرستاده شد.`}
                  {" "}هنوز جواب نداده؛ تا قبول نکند نوبت همان‌طور که بود می‌ماند.
                </p>
                {onWithdrawProposal ? (
                  <button type="button" className="pxBtn" disabled={actionDisabled} onClick={onWithdrawProposal}>پس گرفتن پیشنهاد</button>
                ) : null}
              </div>
            ) : null}

            {readOnly ? (
              <p className="scheduleBookingReadOnlyNote">
                <Eye size={14} aria-hidden="true" />
                {isCancelled ? "این رزرو بسته شده و فقط قابل مشاهده است." : "این رزرو گذشته است و فقط قابل مشاهده است."}
              </p>
            ) : null}

            {canManage && !isPendingReview && cancelAsk && confirmed ? (
              <div className="pxCancelPanel" role="alertdialog" aria-label="لغو نوبت تأییدشده">
                <p>{soon ? CALL_FIRST_TEXT : "این نوبت تأیید شده بود و مشتری روی آن حساب کرده است."}</p>
                {phone && (soon || !hasAccount) ? (
                  <a className="pxBtn" href={`tel:${toLatinDigits(phone)}`}><Phone size={15} aria-hidden="true" />{CLIENT_CAN_CALL}<span dir="ltr">{toPersianDigits(phone)}</span></a>
                ) : null}
                <p>
                  {hasAccount
                    ? "با لغو، مشتری با اعلان و پیامک باخبر می‌شود: «بابت این اتفاق متأسفیم؛ می‌توانی نوبت دیگری بگیری.»"
                    : "این مشتری حساب فرفرو ندارد و پیامکی نمی‌گیرد؛ خودت با او تماس بگیر."}
                </p>
                <div>
                  <button type="button" className="pxBtn is-danger" disabled={actionDisabled} onClick={() => onCancel?.()}>{busy ? "در حال لغو…" : CANCEL_WITH_NOTICE}</button>
                  <button type="button" className="pxBtn" disabled={actionDisabled} onClick={() => setCancelAsk(false)}>نه، نگه دار</button>
                </div>
              </div>
            ) : canManage && !isPendingReview ? (
              <button
                type="button"
                className="sbmCancel"
                disabled={actionDisabled}
                onClick={() => {
                  if (confirmed) {
                    setCancelAsk(true);
                    return;
                  }
                  if (typeof window !== "undefined" && !window.confirm("این رزرو لغو شود؟")) return;
                  onCancel?.();
                }}
              >
                <Trash2 size={15} aria-hidden="true" />
                لغو این رزرو
              </button>
            ) : null}
          </>
        ) : (
          <>
            <button type="button" className="scheduleBookingBack sbmBack" disabled={actionDisabled} onClick={() => onViewChange?.("menu")}>
              <ArrowRight size={15} aria-hidden="true" />
              بازگشت به جزئیات
            </button>
            {isSalonOwner && hasAccount ? (
              <p className="scheduleBookingReadOnlyNote is-offer">
                {confirmed
                  ? "ساعت پیشنهادی برای مشتری فرستاده می‌شود. تا قبول نکند، نوبت همان ساعت قبلی می‌ماند."
                  : "ساعت تازه برای مشتری فرستاده می‌شود تا قبول یا رد کند."}
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

      <footer className="sbmFoot">
        {showReview && !timeView ? (
          <div className="scheduleBookingReviewActions">
            <RequestExpiryBadge createdAt={createdAt} day={dateValue} time={booking.time} waitMinutes={waitMinutes} />
            <button type="button" className="is-approve" disabled={actionDisabled || (minutesLeft !== null && minutesLeft <= 0)} onClick={onApprove}>
              <Check size={17} />
              {busy ? "در حال…" : "تایید نوبت"}
            </button>
            <button type="button" className="is-decline" disabled={actionDisabled} onClick={onDecline}>
              <X size={17} />
              رد کردن
            </button>
          </div>
        ) : null}
        <nav className="sbmBar" aria-label="کارهای رزرو">
          {canManage ? (
            <button
              type="button"
              className={timeView ? "is-active" : ""}
              aria-pressed={timeView}
              disabled={actionDisabled}
              onClick={() => onViewChange?.(timeView ? "menu" : "time")}
            >
              <Timer size={19} aria-hidden="true" />
              <span>{timeLabel}</span>
            </button>
          ) : null}
          <button
            type="button"
            disabled={!phone}
            aria-label={phone ? `تماس با ${title}` : "شماره‌ای ثبت نشده"}
            onClick={() => {
              if (phone) window.location.href = `tel:${toLatinDigits(phone)}`;
            }}
          >
            <Phone size={19} aria-hidden="true" />
            <span>تماس</span>
          </button>
          <button type="button" className="is-close" onClick={onClose}>
            <X size={19} aria-hidden="true" />
            <span>بستن</span>
          </button>
        </nav>
      </footer>
    </div>
  );
}
