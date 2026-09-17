"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import {
  buildPersianMonthGrid,
  formatPersianDayTitle,
  getPersianDateParts,
  getPersianMonthLabel,
  PERSIAN_WEEKDAY_HEADERS,
  shiftPersianMonth
} from "../../shared/lib/persianCalendar";
import { ProfileSheet } from "./ProfileSheet";

/**
 * Month-calendar history picker for a ProfileHeroWeekStrip whose selection
 * is an absolute dateKey (the salon hero, and the artist bookings tab) —
 * lets you jump to any real date, not just whatever's currently scrolled
 * into view on the strip. Opened from the strip's arrow button.
 *
 * This is the calendar half of what BookingWeekRail bundles together for
 * the narrower weekday-name-based rails (salon/artist dashboards); kept as
 * its own component instead of reusing BookingWeekRail directly because
 * that one only ever matches bookings within the current rolling week
 * (isWithinRollingWeek) — a real month browser needs to match by exact
 * date in any month, which is simpler to express fresh than to bolt onto
 * BookingWeekRail's dual-mode logic.
 */
export function BookingHistoryCalendarSheet({
  open,
  onOpenChange,
  selectedDay = "",
  onSelectDay,
  bookings = [],
  getDayCount,
  matchBookingDay,
  kicker = "رزرو",
  title = "همه تاریخ‌ها",
  emptyDayLabel = "رزروی ثبت نشده",
  renderBooking
}) {
  const todayParts = useMemo(() => getPersianDateParts(new Date()), []);
  const [viewYear, setViewYear] = useState(todayParts.year);
  const [viewMonth, setViewMonth] = useState(todayParts.month);

  const monthCells = useMemo(
    () => buildPersianMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const activeCell = useMemo(() => {
    if (selectedDay) {
      const matched = monthCells.find((cell) => cell?.key === selectedDay);
      if (matched) return matched;
    }
    return monthCells.find((cell) => cell?.isToday) || monthCells.find(Boolean) || null;
  }, [monthCells, selectedDay]);

  const activeTitle = useMemo(
    () => (activeCell ? formatPersianDayTitle(activeCell.date) : null),
    [activeCell]
  );

  function dayCount(cell) {
    if (!cell) return 0;
    if (typeof getDayCount === "function") return getDayCount(cell.key);
    return bookings.filter((booking) => matchBookingDay?.(booking, cell.key)).length;
  }

  const activeDayBookings = useMemo(() => {
    if (!activeCell) return [];
    return bookings.filter((booking) => matchBookingDay?.(booking, activeCell.key));
  }, [bookings, activeCell, matchBookingDay]);

  const monthTotal = monthCells.reduce((sum, cell) => sum + dayCount(cell), 0);
  const monthLabel = `${getPersianMonthLabel(viewYear, viewMonth)} ${toPersianDigits(viewYear)}`;

  function moveMonth(delta) {
    const next = shiftPersianMonth(viewYear, viewMonth, delta);
    setViewYear(next.year);
    setViewMonth(next.month);
  }

  function pickCell(cell) {
    if (!cell) return;
    onSelectDay?.(cell.key);
    onOpenChange?.(false);
  }

  return (
    <ProfileSheet
      open={open}
      kicker={kicker}
      title={title}
      label={title}
      panelClassName="bookingWeekHistorySheet"
      onClose={() => onOpenChange?.(false)}
    >
      <div className="bookingWeekHistoryBody">
        <section className="bookingWeekHistoryDateCard" aria-label="تقویم تاریخچه">
          <div className="bookingWeekHistoryDateHero">
            <div className="bookingWeekHistoryDateHeroCopy">
              <span>تاریخ انتخاب‌شده</span>
              <b>{activeTitle ? `${activeTitle.day} ${activeTitle.monthLabel} ${activeTitle.year}` : ""}</b>
              <em>{activeTitle?.weekday}</em>
            </div>
            <div className="bookingWeekHistoryDateHeroStat">
              <CalendarDays size={18} aria-hidden="true" />
              <strong>{toPersianDigits(activeDayBookings.length)}</strong>
              <small>نوبت</small>
            </div>
          </div>

          <div className="bookingWeekHistoryCalHead">
            <button type="button" onClick={() => moveMonth(1)} aria-label="ماه بعد">
              <ChevronLeft size={18} />
            </button>
            <b>{monthLabel}</b>
            <button type="button" onClick={() => moveMonth(-1)} aria-label="ماه قبل">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="bookingWeekHistoryCalWeekdays" aria-hidden="true">
            {PERSIAN_WEEKDAY_HEADERS.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <div className="bookingWeekHistoryCalGrid" role="grid" aria-label={`تقویم ${monthLabel}`}>
            {monthCells.map((cell, index) => {
              if (!cell) {
                return <span key={`empty-${index}`} className="bookingWeekHistoryCalEmpty" />;
              }
              const count = dayCount(cell);
              const active = cell.key === activeCell?.key;
              return (
                <button
                  type="button"
                  role="gridcell"
                  key={cell.key}
                  className={[
                    "bookingWeekHistoryCalDay",
                    active ? "is-active" : "",
                    cell.isToday ? "is-today" : "",
                    count > 0 ? "has-bookings" : ""
                  ].filter(Boolean).join(" ")}
                  aria-selected={active}
                  aria-label={`${cell.weekday} ${cell.dayLabel} · ${toPersianDigits(count)} نوبت`}
                  onClick={() => pickCell(cell)}
                >
                  <strong>{cell.dayLabel}</strong>
                  {count > 0 ? <em>{toPersianDigits(count)}</em> : <i aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          <div className="bookingWeekHistoryDateMeta">
            <span>نوبت‌های این ماه</span>
            <b>{toPersianDigits(monthTotal)} نوبت</b>
          </div>
        </section>

        <div className="bookingWeekHistoryHead">
          <div>
            <span>رزروهای این تاریخ</span>
            <b>{activeTitle?.full || ""}</b>
          </div>
          <em>{toPersianDigits(activeDayBookings.length)} نوبت</em>
        </div>

        <div className="bookingWeekHistoryList todayScheduleList" aria-label={`رزروهای ${activeTitle?.full || ""}`}>
          {activeDayBookings.length ? activeDayBookings.map((booking, index) => (
            <div className="bookingWeekHistoryItem" key={booking.id || `${booking.time}-${booking.client}-${index}`}>
              {renderBooking?.(booking, {
                closeHistory: () => onOpenChange?.(false)
              })}
            </div>
          )) : (
            <div className="bookingWeekHistoryEmpty">
              <CalendarDays size={28} aria-hidden="true" />
              <b>{emptyDayLabel}</b>
              <span>برای «{activeTitle?.full || ""}» هنوز رزروی نیست.</span>
            </div>
          )}
        </div>
      </div>
    </ProfileSheet>
  );
}
