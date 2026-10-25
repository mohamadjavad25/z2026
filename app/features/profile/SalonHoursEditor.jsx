"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, CopyCheck, Timer, X } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { SALON_HOUR_TIME_OPTIONS, timeLabelToMinutes } from "../../shared/lib/time";
import { isPersianDateKey, formatRelativeBookingDayLabel } from "../../shared/lib/persianCalendar";
import { bookingHoldsSlot, findSalonHourForDateKey } from "../../shared/lib/salonAvailability";
import { isSlotInPast } from "../../shared/lib/slots";
import { useBackHandler } from "../../shared/hooks/useBackHandler";

const DEFAULT_OPEN = "۱۰:۰۰";
const DEFAULT_CLOSE = "۲۰:۰۰";

const sameTime = (a, b) => timeLabelToMinutes(a) === timeLabelToMinutes(b);

/** "۱۰:۰۰" → "۱۰", "۰۹:۳۰" → "۹:۳۰": how a day's hours read in the week list. */
function shortTime(label) {
  const total = timeLabelToMinutes(label);
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return toPersianDigits(minutes ? `${hours}:${String(minutes).padStart(2, "0")}` : String(hours));
}

const rangeLabel = (row) => `${shortTime(row.open_time)} تا ${shortTime(row.close_time)}`;

function toDraft(hoursList) {
  return hoursList.map((row) => ({
    day: row.day,
    open_time: row.open_time || DEFAULT_OPEN,
    close_time: row.close_time || DEFAULT_CLOSE,
    active: Boolean(row.active)
  }));
}

function rowChanged(row, saved) {
  if (!saved) return true;
  if (Boolean(saved.active) !== row.active) return true;
  if (!row.active) return false;
  return !sameTime(row.open_time, saved.open_time || DEFAULT_OPEN) || !sameTime(row.close_time, saved.close_time || DEFAULT_CLOSE);
}

function fitsDay(row, start, end) {
  if (!row || !row.active) return false;
  return start >= timeLabelToMinutes(row.open_time) && end <= timeLabelToMinutes(row.close_time);
}

/**
 * Upcoming bookings that fit the saved hours but fall outside the new ones (their day closed, or its hours cut
 * short). They are kept as they are; the sheet only says so before saving. An artist's calendar copies of a
 * salon's bookings follow the salon's hours, not the artist's own, so they are left out.
 */
function bookingsLeftOutside(bookings, saved, draft) {
  return (bookings || []).filter((booking) => {
    if (!bookingHoldsSlot(booking) || booking.source_salon_user_id) return false;
    const dateKey = String(booking.booking_date || "").trim();
    if (!isPersianDateKey(dateKey) || !booking.time || isSlotInPast(dateKey, booking.time)) return false;
    const start = timeLabelToMinutes(booking.time);
    const end = start + (Number(booking.duration_minutes) || 60);
    return fitsDay(findSalonHourForDateKey(saved, dateKey), start, end)
      && !fitsDay(findSalonHourForDateKey(draft, dateKey), start, end);
  });
}

/**
 * Working hours sheet in the "تنظیمات" tab, for salons and artists: the week in one list, a day opens to pick
 * its hours, and everything is saved together with one «ذخیره». How many people fit at once is worked out by
 * the booking system from the team, so the sheet only asks which days are open and from when to when.
 */
export function SalonHoursEditor({
  kicker = "تنظیمات سالن",
  open,
  onToggleOpen,
  hoursList = [],
  openDaysCount = 0,
  bookings = [],
  onSave
}) {
  const [draft, setDraft] = useState(() => toDraft(hoursList));
  const [expandedDay, setExpandedDay] = useState("");
  const [copyFrom, setCopyFrom] = useState(null);
  const [copyTargets, setCopyTargets] = useState([]);
  const [dialog, setDialog] = useState(null);
  const [saving, setSaving] = useState(false);

  const changedDays = useMemo(
    () => draft.filter((row) => rowChanged(row, hoursList.find((saved) => saved.day === row.day))),
    [draft, hoursList]
  );
  const dirty = changedDays.length > 0;

  // Opening the sheet starts from what is saved; while nothing is edited it follows fresh data from the server.
  useEffect(() => {
    if (!open) return;
    if (!dirty) setDraft(toDraft(hoursList));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hoursList]);

  const resetAndClose = () => {
    setDraft(toDraft(hoursList));
    setExpandedDay("");
    setCopyFrom(null);
    setDialog(null);
    onToggleOpen?.();
  };

  const requestClose = () => {
    if (saving) return false;
    if (dialog) {
      setDialog(null);
      return false;
    }
    if (copyFrom) {
      setCopyFrom(null);
      return false;
    }
    if (dirty) {
      setDialog({ kind: "leave" });
      return false;
    }
    resetAndClose();
    return true;
  };

  useBackHandler(Boolean(open), requestClose);

  const updateRow = (day, patch) => {
    setDraft((rows) => rows.map((row) => (row.day === day ? { ...row, ...patch } : row)));
  };

  const toggleDay = (row) => {
    if (row.active) {
      updateRow(row.day, { active: false });
      if (expandedDay === row.day) setExpandedDay("");
      return;
    }
    updateRow(row.day, { active: true });
    setExpandedDay(row.day);
  };

  const pickStart = (row, slot) => {
    const start = timeLabelToMinutes(slot);
    const close = timeLabelToMinutes(row.close_time) > start
      ? row.close_time
      : SALON_HOUR_TIME_OPTIONS.find((item) => timeLabelToMinutes(item) > start) || row.close_time;
    updateRow(row.day, { open_time: slot, close_time: close });
  };

  const openCopy = (row) => {
    setCopyFrom(row);
    setCopyTargets(draft.filter((item) => item.day !== row.day && item.active).map((item) => item.day));
  };

  const applyCopy = () => {
    const targets = new Set(copyTargets);
    setDraft((rows) => rows.map((row) => (targets.has(row.day)
      ? { ...row, active: true, open_time: copyFrom.open_time, close_time: copyFrom.close_time }
      : row)));
    setCopyFrom(null);
  };

  const save = async () => {
    setDialog(null);
    setSaving(true);
    const ok = await onSave?.(changedDays.map(({ day, open_time, close_time, active }) => ({ day, open_time, close_time, active })));
    setSaving(false);
    if (ok) {
      setExpandedDay("");
      onToggleOpen?.();
    }
  };

  const requestSave = () => {
    if (!dirty || saving) return;
    const outside = bookingsLeftOutside(bookings, hoursList, draft);
    if (outside.length) {
      setDialog({ kind: "booked", bookings: outside });
      return;
    }
    save();
  };

  const draftOpenCount = draft.filter((row) => row.active).length;

  const renderTimes = (row) => {
    const options = [...SALON_HOUR_TIME_OPTIONS];
    [row.open_time, row.close_time].forEach((value) => {
      if (value && !options.some((item) => sameTime(item, value))) options.push(value);
    });
    options.sort((a, b) => timeLabelToMinutes(a) - timeLabelToMinutes(b));
    const start = timeLabelToMinutes(row.open_time);
    return (
      <div className="hrsEdit">
        <span className="hrsLabel" id={`hrs-open-${row.day}`}>از ساعت</span>
        <div className="hrsGrid" role="radiogroup" aria-labelledby={`hrs-open-${row.day}`}>
          {options.slice(0, -1).map((slot) => (
            <button
              key={slot}
              type="button"
              role="radio"
              aria-checked={sameTime(slot, row.open_time)}
              className={`hrsTime${sameTime(slot, row.open_time) ? " is-on" : ""}`}
              onClick={() => pickStart(row, slot)}
            >
              {shortTime(slot)}
            </button>
          ))}
        </div>
        <span className="hrsLabel" id={`hrs-close-${row.day}`}>تا ساعت</span>
        <div className="hrsGrid" role="radiogroup" aria-labelledby={`hrs-close-${row.day}`}>
          {options.slice(1).map((slot) => (
            <button
              key={slot}
              type="button"
              role="radio"
              aria-checked={sameTime(slot, row.close_time)}
              disabled={timeLabelToMinutes(slot) <= start}
              className={`hrsTime${sameTime(slot, row.close_time) ? " is-on" : ""}`}
              onClick={() => updateRow(row.day, { close_time: slot })}
            >
              {shortTime(slot)}
            </button>
          ))}
        </div>
        {draft.length > 1 ? (
          <button type="button" className="hrsCopyBtn" onClick={() => openCopy(row)}>
            <CopyCheck size={15} aria-hidden="true" />
            همین ساعت برای روزهای دیگه
          </button>
        ) : null}
      </div>
    );
  };

  const renderWeek = () => (
    <ul className="hrsWeek">
      {draft.map((row) => {
        const expanded = expandedDay === row.day && row.active;
        return (
          <li key={row.day} className={`hrsDay${row.active ? "" : " is-off"}${expanded ? " is-open" : ""}`}>
            <div className="hrsDayRow">
              <button
                type="button"
                className="hrsDayMain"
                aria-expanded={expanded}
                disabled={!row.active}
                onClick={() => setExpandedDay(expanded ? "" : row.day)}
              >
                <b>{row.day}</b>
                <span>{row.active ? rangeLabel(row) : "تعطیل"}</span>
              </button>
              <button
                type="button"
                role="switch"
                aria-checked={row.active}
                aria-label={`${row.day} ${row.active ? "بازه" : "تعطیله"}`}
                className="hrsSwitch"
                onClick={() => toggleDay(row)}
              >
                <span />
              </button>
            </div>
            {expanded ? renderTimes(row) : null}
          </li>
        );
      })}
    </ul>
  );

  const renderCopy = () => (
    <div className="hrsCopy">
      <strong className="hrsCopyTitle">{rangeLabel(copyFrom)} برای کدوم روزها؟</strong>
      <ul className="hrsCopyList">
        {draft.filter((row) => row.day !== copyFrom.day).map((row) => {
          const checked = copyTargets.includes(row.day);
          return (
            <li key={row.day}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                className={`hrsCheck${checked ? " is-on" : ""}`}
                onClick={() => setCopyTargets((list) => (checked ? list.filter((day) => day !== row.day) : [...list, row.day]))}
              >
                <span className="hrsBox">{checked ? <Check size={13} aria-hidden="true" /> : null}</span>
                <b>{row.day}</b>
                <small>{row.active ? rangeLabel(row) : "تعطیل"}</small>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="hrsBtns">
        <button type="button" className="hrsBtn is-main" disabled={!copyTargets.length} onClick={applyCopy}>
          {copyTargets.length ? `روی ${toPersianDigits(copyTargets.length)} روز بزن` : "یه روز انتخاب کن"}
        </button>
        <button type="button" className="hrsBtn" onClick={() => setCopyFrom(null)}>بی‌خیال</button>
      </div>
    </div>
  );

  const renderDialog = () => {
    if (!dialog) return null;
    if (dialog.kind === "leave") {
      return (
        <div className="hrsDialog" role="alertdialog" aria-labelledby="hrs-leave-title">
          <strong id="hrs-leave-title">تغییرها ذخیره نشده. ذخیره کنم؟</strong>
          <div className="hrsBtns">
            <button type="button" className="hrsBtn is-main" onClick={requestSave} disabled={saving}>ذخیره کن</button>
            <button type="button" className="hrsBtn" onClick={resetAndClose} disabled={saving}>بی‌خیال</button>
          </div>
        </div>
      );
    }
    return (
      <div className="hrsDialog" role="alertdialog" aria-labelledby="hrs-booked-title">
        <strong id="hrs-booked-title">
          {toPersianDigits(dialog.bookings.length)} نوبت سر جاش می‌مونه
        </strong>
        <ul className="hrsBooked">
          {dialog.bookings.slice(0, 5).map((booking) => (
            <li key={booking.id}>
              <span>{booking.client || booking.client_name || "مشتری"}{booking.service ? ` · ${booking.service}` : ""}</span>
              <span>{formatRelativeBookingDayLabel(booking.booking_date)} · {toPersianDigits(booking.time)}</span>
            </li>
          ))}
        </ul>
        {dialog.bookings.length > 5 ? (
          <p className="hrsNote">و {toPersianDigits(dialog.bookings.length - 5)} نوبت دیگه.</p>
        ) : null}
        <p className="hrsNote">این نوبت‌ها بیرون از ساعت تازه‌ان. اگه می‌خوای لغوشون کنی، از تقویم با اطلاع مشتری لغو کن.</p>
        <div className="hrsBtns">
          <button type="button" className="hrsBtn is-main" onClick={save} disabled={saving}>باشه، ذخیره کن</button>
          <button type="button" className="hrsBtn" onClick={() => setDialog(null)} disabled={saving}>برگرد</button>
        </div>
      </div>
    );
  };

  return (
    <div className="settingsSalonHours">
      <button
        type="button"
        className="settingsSalonHoursHead settingsSalonHoursToggle"
        aria-expanded={open}
        onClick={onToggleOpen}
      >
        <Timer size={16} aria-hidden="true" />
        <div>
          <strong>ساعت کاری</strong>
          <span>کدوم روزها بازی و از چه ساعتی تا چه ساعتی</span>
        </div>
        <em className="settingsSalonHoursSummary">
          {toPersianDigits(openDaysCount)} روز باز
        </em>
        <ChevronDown size={15} className={`settingsSalonHoursChev ${open ? "is-open" : ""}`} aria-hidden="true" />
      </button>
      {open && typeof document !== "undefined" ? createPortal(
        <div
          className="settingsHoursModal"
          role="dialog"
          aria-modal="true"
          aria-label="ساعت کاری"
          onClick={requestClose}
        >
          <article className="settingsHoursSheet hrsSheet" onClick={(event) => event.stopPropagation()}>
            <header className="hrsHead">
              <div>
                <span>{kicker}</span>
                <strong>ساعت کاری</strong>
              </div>
              <em>{draftOpenCount ? `${toPersianDigits(draftOpenCount)} روز باز` : "همه روزها تعطیل"}</em>
            </header>

            {copyFrom ? renderCopy() : renderWeek()}

            {dirty && !copyFrom ? (
              <div className="hrsSaveBar">
                <span>{toPersianDigits(changedDays.length)} روز عوض شد</span>
                <button type="button" onClick={requestSave} disabled={saving}>
                  {saving ? "در حال ذخیره…" : "ذخیره"}
                </button>
              </div>
            ) : null}

            {dialog ? <div className="hrsDialogLayer">{renderDialog()}</div> : null}
          </article>
          <button
            type="button"
            className="settingsHoursClose"
            onClick={(event) => {
              event.stopPropagation();
              requestClose();
            }}
            aria-label="بستن"
          >
            <X size={18} />
          </button>
        </div>,
        document.body
      ) : null}
    </div>
  );
}
