"use client";

import { useEffect } from "react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { Timer } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { DateTimeWheelPicker } from "../../components/DateTimeWheelPicker";
import {
  buildPublicBookingSlots,
  isPublicArtistSlotBlocked
} from "./bookingUtils";
import { salonClientBookingDays } from "./constants";
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
    (slot) => !isPublicArtistSlotBlocked(
      artist,
      bookingDay,
      slot,
      durationMinutes
    )
  );

  // Rule: a day with NO free slot is full — shown disabled and not selectable.
  const fullDays = salonClientBookingDays.filter((day) => (
    !slots.some((slot) => !isPublicArtistSlotBlocked(artist, day, slot, durationMinutes))
  ));

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
        <b>{activeService?.price ? `${toPersianDigits(activeService.price)} تومان` : "—"}</b>
      </div>

      {activeService?.hint ? (
        <p className="artistPublicBookingServiceHint">{activeService.hint}</p>
      ) : null}

      <DateTimeWheelPicker
        dayOptions={salonClientBookingDays}
        dayValue={bookingDay}
        onDayChange={(day) => onDayChange(day, durationMinutes)}
        disabledDays={fullDays}
        dayIdPrefix="public-artist-booking-day"
        dayLabel="روز رزرو"
        timeOptions={freeSlots}
        timeValue={bookingSlot}
        onTimeChange={onSlotChange}
        timeIdPrefix="public-artist-booking-time"
        timeLabel="ساعت رزرو"
        emptyTimeMessage="برای این روز نوبت آزادی با این مدت‌زمان نیست."
      />

      <p className="artistPublicBookingNote">
        در طول مدت خدمت، ساعت دیگری قابل رزرو نیست.
      </p>
    </section>
  );
}
