"use client";

import { useEffect, useRef, useState } from "react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { MapPin, Store, Timer } from "lucide-react";
import { LocationButton } from "../../components/LocationButton";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatTomanNumber, parseTomanAmount } from "../../shared/lib/money";
import { BookingSlotPicker } from "../../components/BookingSlotPicker";
import { isPublicArtistSlotBlocked } from "./bookingUtils";
import { salonClientBookingDays } from "./constants";
import { isTooSoonToRequest } from "../../shared/lib/bookingWindow";
import { getTehranClockMinutes, timeLabelToMinutes } from "../../shared/lib/time";
import { resolveRollingPersianDateKey } from "../../shared/lib/persianCalendar";
import { workplaceOn } from "../../shared/lib/artistPlace";
import { slotsInHours } from "../../shared/lib/artistFreeTimes";
import { WaitlistButton } from "../booking/WaitlistButton";

/** The day strip holds labels ("شنبه ۲ آبان"); hours and places are looked up by the real date. */
const dateKeyOf = (day) => resolveRollingPersianDateKey(day) || day;

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

/**
 * «خبرم کن» for an artist (owner's decision of 2026-10-27): the full days are greyed out in the day strip, so they are
 * offered here: pick one, and the client hears when a time for this service opens on it.
 */
function FullDaysWaitlist({ artist, fullDays, service, durationMinutes }) {
  const [day, setDay] = useState("");
  const shown = fullDays.slice(0, 4);
  if (!artist?.id || !shown.length || !service?.name) return null;
  const picked = shown.includes(day) ? day : "";
  return (
    <div className="plWaitDays">
      <p>روزی که می‌خوای پره؟ بزن تا اگه جا باز شد خبرت کنیم:</p>
      <div className="plWaitDayRow" role="group" aria-label="روزهای پر">
        {shown.map((item) => (
          <button type="button" key={item} aria-pressed={picked === item} className={picked === item ? "is-on" : ""} onClick={() => setDay(item)}>
            {item}
          </button>
        ))}
      </div>
      {picked ? (
        <WaitlistButton
          kind="artist"
          ownerId={artist.id}
          day={dateKeyOf(picked)}
          dayLabel={picked}
          placeLabel={`پیش ${String(artist.name || "آرتیست").trim().split(/\s+/)[0]}`}
          services={[{ name: service.name, minutes: durationMinutes }]}
        />
      ) : null}
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

      <FullDaysWaitlist artist={artist} fullDays={fullDays} service={activeService} durationMinutes={durationMinutes} />

      <p className="artistPublicBookingNote">
        تا کار تموم نشه، ساعت دیگه‌ای گرفته نمی‌شه.
      </p>
    </section>
  );
}
