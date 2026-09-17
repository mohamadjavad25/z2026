"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import {
  buildPersianMonthGrid,
  formatPersianDayTitle,
  getPersianDateParts,
  getPersianMonthLabel,
  isWithinRollingWeek,
  PERSIAN_WEEKDAY_HEADERS,
  shiftPersianMonth
} from "../../shared/lib/persianCalendar";
import { ProfileSheet } from "./ProfileSheet";

export function BookingWeekRail({
  tabs = [],
  selectedDay = "",
  onSelectDay,
  historyOpen: controlledHistoryOpen,
  onHistoryOpenChange,
  getDayCount,
  bookings = [],
  matchBookingDay,
  renderBooking,
  tabLabel = "تاریخچه",
  modalKicker = "رزرو",
  modalTitle = "همه تاریخ‌ها",
  emptyDayLabel = "رزروی ثبت نشده",
  ariaLabel = "انتخاب روز برنامه"
}) {
  const todayParts = useMemo(() => getPersianDateParts(new Date()), []);
  const [internalHistoryOpen, setInternalHistoryOpen] = useState(false);
  const [modalDay, setModalDay] = useState("");
  const [modalDateKey, setModalDateKey] = useState("");
  const [viewYear, setViewYear] = useState(todayParts.year);
  const [viewMonth, setViewMonth] = useState(todayParts.month);
  const historyOpen = typeof controlledHistoryOpen === "boolean" ? controlledHistoryOpen : internalHistoryOpen;

  function setHistoryOpen(nextOpen) {
    if (typeof controlledHistoryOpen !== "boolean") {
      setInternalHistoryOpen(nextOpen);
    }
    onHistoryOpenChange?.(nextOpen);
  }

  const monthCells = useMemo(
    () => buildPersianMonthGrid(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  const activeCell = useMemo(() => {
    if (modalDateKey) {
      const matched = monthCells.find((cell) => cell?.key === modalDateKey);
      if (matched) return matched;
    }
    const byWeekday = monthCells.find((cell) => (
      cell && isWithinRollingWeek(cell.date) && cell.weekday === (modalDay || selectedDay)
    ));
    if (byWeekday) return byWeekday;
    return monthCells.find((cell) => cell?.isToday) || monthCells.find(Boolean) || null;
  }, [monthCells, modalDateKey, modalDay, selectedDay]);

  const activeModalDay = activeCell?.weekday || modalDay || selectedDay || tabs[0]?.day || "";
  const activeTitle = useMemo(
    () => (activeCell ? formatPersianDayTitle(activeCell.date) : null),
    [activeCell]
  );

  const modalDayBookings = useMemo(() => {
    if (!activeCell || !activeModalDay) return [];
    if (!isWithinRollingWeek(activeCell.date)) return [];
    return bookings.filter((booking) => matchBookingDay?.(booking, activeModalDay, activeCell.key));
  }, [bookings, activeCell, activeModalDay, matchBookingDay]);

  function dayCountValue(day) {
    const tab = tabs.find((item) => item.day === day);
    const dateKey = tab?.dateKey || "";
    if (typeof getDayCount === "function") return getDayCount(day, dateKey);
    return bookings.filter((booking) => matchBookingDay?.(booking, day, dateKey)).length;
  }

  function cellCount(cell) {
    if (!cell) return 0;
    if (!isWithinRollingWeek(cell.date)) return 0;
    if (typeof getDayCount === "function") return getDayCount(cell.weekday, cell.key);
    return bookings.filter((booking) => matchBookingDay?.(booking, cell.weekday, cell.key)).length;
  }

  const monthTotal = monthCells.reduce((sum, cell) => sum + cellCount(cell), 0);
  const monthLabel = `${getPersianMonthLabel(viewYear, viewMonth)} ${toPersianDigits(viewYear)}`;

  function openHistory() {
    const todayCell = buildPersianMonthGrid(todayParts.year, todayParts.month).find((cell) => cell?.isToday);
    const preferredWeekday = selectedDay || tabs[0]?.day || todayCell?.weekday || "";
    const preferred = buildPersianMonthGrid(todayParts.year, todayParts.month).find((cell) => (
      cell && isWithinRollingWeek(cell.date) && cell.weekday === preferredWeekday
    )) || todayCell;

    setViewYear(todayParts.year);
    setViewMonth(todayParts.month);
    setModalDay(preferred?.weekday || preferredWeekday);
    setModalDateKey(preferred?.key || "");
    setHistoryOpen(true);
  }

  function pickCell(cell) {
    if (!cell) return;
    setModalDay(cell.weekday);
    setModalDateKey(cell.key);
    onSelectDay?.(cell.weekday);
  }

  function moveMonth(delta) {
    const next = shiftPersianMonth(viewYear, viewMonth, delta);
    setViewYear(next.year);
    setViewMonth(next.month);
  }

  return (
    <>
      <div className="bookingWeekRailShell">
        <button
          type="button"
          className="bookingWeekRailTab"
          onClick={openHistory}
          aria-label={tabLabel}
          title={tabLabel}
        >
          <Settings size={14} aria-hidden="true" />
          <span>{tabLabel}</span>
        </button>
        <div className="artistBookingWeekRail" role="tablist" aria-label={ariaLabel}>
          {tabs.map((item) => {
            const active = item.day === selectedDay;
            const count = dayCountValue(item.day);
            return (
              <button
                type="button"
                role="tab"
                key={item.day}
                className={active ? "active" : ""}
                aria-selected={active}
                aria-label={`${item.label || item.day} · ${toPersianDigits(count)} نوبت`}
                title={`${item.label || item.day} · ${toPersianDigits(count)} نوبت`}
                onClick={() => onSelectDay?.(item.day)}
              >
                <span>{item.label || item.day}</span>
                <strong>{toPersianDigits(count)}</strong>
                <b>نوبت</b>
              </button>
            );
          })}
        </div>
      </div>

      <ProfileSheet
        open={historyOpen}
        kicker={modalKicker}
        title={modalTitle}
        label={modalTitle}
        panelClassName="bookingWeekHistorySheet"
        onClose={() => setHistoryOpen(false)}
      >
        <div className="bookingWeekHistoryBody">
          <section className="bookingWeekHistoryDateCard" aria-label="تقویم تاریخچه">
            <div className="bookingWeekHistoryDateHero">
              <div className="bookingWeekHistoryDateHeroCopy">
                <span>تاریخ انتخاب‌شده</span>
                <b>{activeTitle ? `${activeTitle.day} ${activeTitle.monthLabel} ${activeTitle.year}` : activeModalDay}</b>
                <em>{activeTitle?.weekday || activeModalDay}</em>
              </div>
              <div className="bookingWeekHistoryDateHeroStat">
                <CalendarDays size={18} aria-hidden="true" />
                <strong>{toPersianDigits(modalDayBookings.length)}</strong>
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
                const count = cellCount(cell);
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
              <b>{activeTitle?.full || activeModalDay}</b>
            </div>
            <em>{toPersianDigits(modalDayBookings.length)} نوبت</em>
          </div>

          <div className="bookingWeekHistoryList todayScheduleList" aria-label={`رزروهای ${activeTitle?.full || activeModalDay}`}>
            {modalDayBookings.length ? modalDayBookings.map((booking, index) => (
              <div className="bookingWeekHistoryItem" key={booking.id || `${booking.time}-${booking.client}-${index}`}>
                {renderBooking?.(booking, {
                  closeHistory: () => setHistoryOpen(false)
                })}
              </div>
            )) : (
              <div className="bookingWeekHistoryEmpty">
                <CalendarDays size={28} aria-hidden="true" />
                <b>{emptyDayLabel}</b>
                <span>برای «{activeTitle?.full || activeModalDay}» هنوز رزروی نیست.</span>
              </div>
            )}
          </div>
        </div>
      </ProfileSheet>
    </>
  );
}
