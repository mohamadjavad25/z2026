"use client";

import { useEffect } from "react";
import { Timer } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { BreakTimeWheel } from "../../components/BreakTimeWheel";
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
        <div>
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

      <div className="artistPublicBookingWheels">
        <div className="artistPublicBookingDayPicker">
          <span>روز رزرو</span>
          <BreakTimeWheel
            mode="label"
            idPrefix="public-artist-booking-day"
            options={salonClientBookingDays}
            value={bookingDay}
            disabledValues={fullDays}
            onChange={(day) => onDayChange(day, durationMinutes)}
            ariaLabel="انتخاب روز رزرو"
          />
        </div>
        <div className="artistPublicBookingTimePicker">
          <span>ساعت رزرو</span>
          {freeSlots.length ? (
            <BreakTimeWheel
              mode="clock"
              idPrefix="public-artist-booking-time"
              options={freeSlots}
              value={bookingSlot}
              onChange={onSlotChange}
              ariaLabel="انتخاب ساعت رزرو"
            />
          ) : (
            <div className="artistPublicSlotEmpty">
              برای این روز نوبت آزادی با این مدت‌زمان نیست.
            </div>
          )}
        </div>
      </div>

      <p className="artistPublicBookingNote">
        در طول مدت خدمت، ساعت دیگری قابل رزرو نیست.
      </p>
    </section>
  );
}
