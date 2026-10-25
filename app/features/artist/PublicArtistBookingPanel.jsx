"use client";

import { useEffect, useRef } from "react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { MapPin, Store, Timer } from "lucide-react";
import { LocationButton } from "../../components/LocationButton";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatTomanNumber, parseTomanAmount } from "../../shared/lib/money";
import { BookingSlotPicker } from "../../components/BookingSlotPicker";
import {
  buildPublicBookingSlots,
  isPublicArtistSlotBlocked
} from "./bookingUtils";
import { salonClientBookingDays } from "./constants";
import { isTooSoonToRequest } from "../../shared/lib/bookingWindow";
import { buildDayBookingSlots, getTehranClockMinutes, timeLabelToMinutes } from "../../shared/lib/time";
import { resolveRollingPersianDateKey } from "../../shared/lib/persianCalendar";
import { findSalonHourForDateKey, isSalonHourOpen, salonDayWindow } from "../../shared/lib/salonAvailability";
import { salonTimeBlock, workplaceOn } from "../../shared/lib/artistPlace";

/** The day strip holds labels ("شنبه ۲ آبان"); hours and places are looked up by the real date. */
const dateKeyOf = (day) => resolveRollingPersianDateKey(day) || day;

/**
 * The 30-minute start times of one day that fit the artist's hours (the default week when none are known) and, when
 * the artist works at a salon that day, the salon's hours too (shared/lib/artistPlace.js; the server refuses the rest).
 */
function slotsInHours(artist, day, durationMinutes) {
  const rows = Array.isArray(artist?.hours) && artist.hours.length ? artist.hours : null;
  let slots;
  if (!rows) slots = buildPublicBookingSlots(durationMinutes);
  else {
    const row = findSalonHourForDateKey(rows, dateKeyOf(day));
    if (!isSalonHourOpen(row)) return [];
    const window = salonDayWindow(row);
    slots = buildDayBookingSlots(window.open, window.close, durationMinutes);
  }
  const salon = workplaceOn(artist?.workplaces, dateKeyOf(day));
  return salon ? slots.filter((slot) => !salonTimeBlock(salon.hours, dateKeyOf(day), slot, durationMinutes)) : slots;
}

/** «کجا» for the chosen day: the workplace salon with its area, or the artist's own place (named, never addressed). */
function PlaceLine({ artist, day }) {
  const salon = workplaceOn(artist?.workplaces, dateKeyOf(day));
  const firstName = String(artist?.name || "آرتیست").trim().split(/\s+/)[0];
  const name = salon ? salon.name : `جای ${firstName}`;
  return (
    <div className="plWhere" aria-label="کجا">
      <span className="plWhereIcon" aria-hidden="true">{salon ? <Store size={16} /> : <MapPin size={16} />}</span>
      <span className="plWhereText">
        <small>کجا</small>
        <b>{salon && salon.area ? `${salon.name}، ${salon.area}` : name}</b>
      </span>
      <LocationButton name={name} location={salon ? salon.location : artist?.location} />
    </div>
  );
}

export function PublicArtistBookingPanel({
  artist,
  services,
  selectedServiceId,
  bookingDay,
  bookingSlot,
  parseDuration,
  onBackToServices,
  onDayChange,
  onSlotChange
}) {
  const safeServices = Array.isArray(services) ? services : [];
  const activeService = safeServices.find((item) => item.id === selectedServiceId) || safeServices[0];
  const durationMinutes = parseDuration(activeService?.duration);
  // Only times inside the artist's hours for that day are offered (the server refuses anything else).
  const slotsFor = (day) => slotsInHours(artist, day, durationMinutes);
  const slots = slotsFor(bookingDay);
  const freeSlots = slots.filter(
    (slot) => !isTooSoonToRequest(bookingDay, slot) && !isPublicArtistSlotBlocked(
      artist,
      bookingDay,
      slot,
      durationMinutes
    )
  );

  // Rule: a day with NO free slot is full — shown disabled and not selectable.
  const fullDays = salonClientBookingDays.filter((day) => (
    !slotsFor(day).some((slot) => !isTooSoonToRequest(day, slot) && !isPublicArtistSlotBlocked(artist, day, slot, durationMinutes))
  ));

  // Open on the first day that still has a free hour (today is often already over), until the
  // client picks a day themselves.
  const autoDayRef = useRef(true);
  const firstOpenDay = salonClientBookingDays.find((day) => !fullDays.includes(day));
  useEffect(() => {
    if (autoDayRef.current && fullDays.includes(bookingDay) && firstOpenDay && firstOpenDay !== bookingDay) {
      onDayChange(firstOpenDay, durationMinutes);
    }
  }, [bookingDay, fullDays.join("|")]);

  // Default: nearest free hour (from now), refreshed when the day changes.
  useEffect(() => {
    if (!bookingSlot && freeSlots.length) {
      const nowMinutes = getTehranClockMinutes();
      const nearest = freeSlots.find((slot) => timeLabelToMinutes(slot) >= nowMinutes) || freeSlots[0];
      if (nearest) onSlotChange?.(nearest);
    }
  }, [bookingDay, freeSlots.join("|")]);

  return (
    <section className="artistPublicBookingPanel" aria-label="انتخاب نوبت">

      <div className="artistPublicBookingService">
        <ServiceIcon emoji={activeService?.emoji} name={activeService?.name} size="lg" />
        <div className="artistPublicBookingServiceInfo">
          <span>خدمت انتخاب‌شده</span>
          <strong>{activeService?.name || "خدمت"}</strong>
          <small>
            <Timer size={12} /> {activeService?.duration || `${toPersianDigits(durationMinutes)} دقیقه`}
          </small>
        </div>
        <b>{activeService?.price ? `${formatTomanNumber(parseTomanAmount(activeService.price))} تومان` : "—"}</b>
      </div>

      <PlaceLine artist={artist} day={bookingDay} />

      {activeService?.hint ? (
        <p className="artistPublicBookingServiceHint">{activeService.hint}</p>
      ) : null}

      <BookingSlotPicker
        dayOptions={salonClientBookingDays}
        dayValue={bookingDay}
        onDayChange={(day) => { autoDayRef.current = false; onDayChange(day, durationMinutes); }}
        disabledDays={fullDays}
        timeOptions={freeSlots}
        timeValue={bookingSlot}
        onTimeChange={onSlotChange}
        emptyTimeMessage="این روز ساعت خالی‌ای به این اندازه نیست."
      />

      <p className="artistPublicBookingNote">
        تا کار تموم نشه، ساعت دیگه‌ای گرفته نمی‌شه.
      </p>
    </section>
  );
}
