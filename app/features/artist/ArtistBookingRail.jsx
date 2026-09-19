"use client";

import { forwardRef } from "react";
import { CalendarCheck, GripVertical, Plus } from "lucide-react";
import { SegmentClock } from "../../components/SegmentClock";
import { toPersianDigits } from "../../shared/lib/digits";
import { artistAvailableSlots, getArtistBookingStatusKey } from "./bookingUtils";
import { artistBookingDays } from "./constants";

// Same status→color mapping as the expanded list's .artistBookingRailStatus
// dot (artist.css), reused here so the collapsed clock-only row actually
// shows status at a glance too — previously the is-ok/is-wait/is-vip/
// is-cancelled/is-expired classes on this row were no-ops (transparent
// background + inherited color), so every booking looked identical until
// the rail was opened.
const ARTIST_RAIL_TIME_STATUS_COLOR = {
  ok: "#60519b",
  wait: "#d4a017",
  vip: "#78486c",
  cancelled: "#d64545",
  expired: "#9a5b52"
};

export const ArtistBookingRail = forwardRef(function ArtistBookingRail(
  {
    className,
    style,
    isOpen,
    isDragging,
    bookings,
    services,
    createOpen,
    onToggle,
    onOpen,
    onShowAll,
    onCreateOpen,
    onCreateClose,
    onCreateSubmit,
    createSubmitting = false,
    onHandlePointerDown,
    onHandlePointerMove,
    onHandlePointerUp,
    shouldIgnoreClick
  },
  ref
) {
  const safeBookings = Array.isArray(bookings) ? bookings : [];
  const safeServices = Array.isArray(services) ? services : [];

  function handleToggle() {
    if (shouldIgnoreClick?.()) return;
    onToggle?.();
  }

  function handleTimeClick() {
    if (shouldIgnoreClick?.()) return;
    onOpen?.();
  }

  return (
    <aside
      ref={ref}
      className={className}
      style={style}
      aria-label="رزروهای نزدیک"
      onPointerMove={onHandlePointerMove}
      onPointerUp={onHandlePointerUp}
      onPointerCancel={onHandlePointerUp}
    >
      <div className="artistBookingRailMenu">
        <button
          type="button"
          className="artistBookingRailHandle"
          aria-label="بکش برای جابه‌جایی"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          <span className="artistBookingRailHandleDots" aria-hidden="true">
            <i /><i /><i /><i /><i /><i />
            <i /><i /><i /><i /><i /><i />
            <i /><i /><i /><i /><i /><i />
          </span>
          <GripVertical className="artistBookingRailHandleGrip" size={16} />
          <span className="artistBookingRailHandleLabel">{isDragging ? "رها کن" : "جابه‌جا"}</span>
        </button>

        <button
          type="button"
          className="artistBookingRailToggle"
          aria-expanded={isOpen}
          onClick={handleToggle}
        >
          <CalendarCheck size={16} />
          <span>{isOpen ? "بستن" : "نوبت‌ها"}</span>
        </button>
      </div>

      <div className="artistBookingRailTimes" aria-hidden={isOpen}>
        {safeBookings.map((booking) => {
          const statusKey = getArtistBookingStatusKey(booking.status);
          return (
            <button
              type="button"
              className={`artistBookingRailTime is-${statusKey}`}
              key={`rail-time-${booking.id}`}
              onClick={handleTimeClick}
              aria-label={`${booking.time} · ${booking.status}`}
              title={booking.status}
            >
              <SegmentClock
                value={booking.time}
                size="xs"
                as="span"
                backgroundColor="transparent"
                color={ARTIST_RAIL_TIME_STATUS_COLOR[statusKey] || undefined}
              />
            </button>
          );
        })}
      </div>

      <div className="artistBookingRailPanel">
        <div className="artistBookingRailHead">
          <div>
            <span>رزروهای امروز</span>
            <strong>{toPersianDigits(safeBookings.length)} نوبت</strong>
          </div>
          <button type="button" onClick={onShowAll}>
            همه
          </button>
        </div>

        {createOpen ? (
          <form className="artistBookingRailForm" onSubmit={onCreateSubmit}>
            <div className="artistBookingRailFormHead">
              <strong>نوبت جدید</strong>
              <button type="button" onClick={onCreateClose}>انصراف</button>
            </div>
            <label>
              نام مشتری
              <input name="client" placeholder="مثلا سارا" required />
            </label>
            <label className="artistBookingRailPhone">
              <span>
                شماره تماس
                <em>اختیاری · مهم برای هماهنگی</em>
              </span>
              <input name="phone" placeholder="09..." inputMode="tel" autoComplete="tel" />
            </label>
            <label>
              خدمت
              <select name="service" defaultValue={safeServices[0]?.name || ""} required>
                {safeServices.map((service) => (
                  <option key={service.id} value={service.name}>{service.name}</option>
                ))}
              </select>
            </label>
            <div className="artistBookingRailFormRow">
              <label>
                روز
                <select name="date" defaultValue="فردا" required>
                  {artistBookingDays.map((day) => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              </label>
              <label>
                ساعت
                <select name="time" defaultValue={artistAvailableSlots[0]} required>
                  {artistAvailableSlots.map((slot) => (
                    <option key={slot} value={slot}>{slot}</option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" className="artistBookingRailSubmit" disabled={createSubmitting}>
              <CalendarCheck size={15} />
              {createSubmitting ? "در حال ثبت..." : "ثبت رزرو"}
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              className="artistBookingRailCreate"
              onClick={onCreateOpen}
            >
              <Plus size={16} />
              ایجاد نوبت
            </button>
            <div className="artistBookingRailList">
              {safeBookings.length ? safeBookings.map((booking) => {
                const statusKey = getArtistBookingStatusKey(booking.status);
                return (
                  <article key={booking.id} className={`is-${statusKey}`}>
                    <span
                      className={`artistBookingRailStatus is-${statusKey}`}
                      aria-label={booking.status}
                      title={booking.status}
                    />
                    <SegmentClock value={booking.time} size="xs" as="span" />
                    <div>
                      <b>{booking.client}</b>
                      <span>
                        {booking.service} · {booking.date}
                      </span>
                      {booking.phone ? (
                        <em className="artistBookingRailListPhone" dir="ltr">
                          {booking.phone}
                        </em>
                      ) : null}
                    </div>
                  </article>
                );
              }) : (
                <div className="artistBookingRailEmpty">
                  امروز نوبتی ثبت نشده
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
});
