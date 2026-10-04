"use client";

import { useEffect, useRef } from "react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { Timer } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatTomanNumber, parseTomanAmount } from "../../shared/lib/money";
import { BookingSlotPicker } from "../../components/BookingSlotPicker";
import {
  buildPublicBookingSlots,
  isPublicArtistSlotBlocked
} from "./bookingUtils";
import { salonClientBookingDays } from "./constants";
import { isSlotInPast } from "../../shared/lib/slots";
import { getTehranClockMinutes, timeLabelToMinutes } from "../../shared/lib/time";

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
  const slots = buildPublicBookingSlots(durationMinutes);
  const freeSlots = slots.filter(
    (slot) => !isSlotInPast(bookingDay, slot) && !isPublicArtistSlotBlocked(
      artist,
      bookingDay,
      slot,
      durationMinutes
    )
  );

  // Rule: a day with NO free slot is full — shown disabled and not selectable.
  const fullDays = salonClientBookingDays.filter((day) => (
    !slots.some((slot) => !isSlotInPast(day, slot) && !isPublicArtistSlotBlocked(artist, day, slot, durationMinutes))
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
        emptyTimeMessage="برای این روز نوبت آزادی با این مدت‌زمان نیست."
      />

      <p className="artistPublicBookingNote">
        در طول مدت خدمت، ساعت دیگری قابل رزرو نیست.
      </p>
    </section>
  );
}
