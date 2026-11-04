"use client";

import { useEffect, useRef } from "react";
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
const firstNameOf = (artist) => String(artist?.name || "آرتیست").trim().split(/\s+/)[0];

/** «کجا» for the chosen day: the workplace salon with its area, or the artist's own place (named, never addressed). */
function PlaceLine({ artist, day }) {
  const salon = workplaceOn(artist?.workplaces, dateKeyOf(day));
  const name = salon ? salon.name : `جای ${firstNameOf(artist)}`;
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
 * Each day of the strip: "open" (a free time is left), "full" (every working time is booked: greyed but tappable, for
 * «خبرم کن»), "over" (today, its times have passed) or "closed" (no hours, a leave or the break covers it: «تعطیل»).
 */
export function artistDayStates(artist, days, durationMinutes) {
  const unbooked = { ...artist, bookedSlots: [] };
  const stateOf = (day) => {
    const working = slotsInHours(artist, day, durationMinutes).filter((slot) => !isPublicArtistSlotBlocked(unbooked, day, slot, durationMinutes));
    if (!working.length) return "closed";
    const ahead = working.filter((slot) => !isTooSoonToRequest(day, slot));
    if (!ahead.length) return "over";
    return ahead.some((slot) => !isPublicArtistSlotBlocked(artist, day, slot, durationMinutes)) ? "open" : "full";
  };
  return Object.fromEntries(days.map((day) => [day, stateOf(day)]));
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
  const freeSlots = slotsInHours(artist, bookingDay, durationMinutes).filter(
    (slot) => !isTooSoonToRequest(bookingDay, slot) && !isPublicArtistSlotBlocked(
      artist,
      bookingDay,
      slot,
      durationMinutes
    )
  );

  const states = artistDayStates(artist, salonClientBookingDays, durationMinutes);
  const daysIn = (state) => salonClientBookingDays.filter((day) => states[day] === state);
  const statesKey = salonClientBookingDays.map((day) => states[day]).join("|");

  // Open on the first day that still has a free hour (today is often already over), until the
  // client picks a day themselves.
  const autoDayRef = useRef(true);
  const firstOpenDay = salonClientBookingDays.find((day) => states[day] === "open");
  useEffect(() => {
    if (autoDayRef.current && states[bookingDay] !== "open" && firstOpenDay && firstOpenDay !== bookingDay) {
      onDayChange(firstOpenDay, durationMinutes);
    }
  }, [bookingDay, statesKey]);

  // Default: nearest free hour (from now), refreshed when the day changes. A time the new day does not offer (outside
  // its hours, or a full day) is dropped, so «بفرست» never names a time the server refuses.
  useEffect(() => {
    if (bookingSlot && freeSlots.includes(bookingSlot)) return;
    const nowMinutes = getTehranClockMinutes();
    const nearest = freeSlots.find((slot) => timeLabelToMinutes(slot) >= nowMinutes) || freeSlots[0] || "";
    if (nearest !== bookingSlot) onSlotChange?.(nearest);
  }, [bookingDay, bookingSlot, freeSlots.join("|")]);

  const fullDayWait = states[bookingDay] === "full" && artist?.id && activeService?.name ? (
    <div className="plFullDay" role="status">
      <b>{bookingDay === salonClientBookingDays[0] ? "امروز" : String(bookingDay).split(" ")[0]} پره.</b>
      <WaitlistButton
        compact
        kind="artist"
        ownerId={artist.id}
        day={dateKeyOf(bookingDay)}
        dayLabel={bookingDay}
        placeLabel={`پیش ${firstNameOf(artist)}`}
        services={[{ name: activeService.name, minutes: durationMinutes }]}
      />
    </div>
  ) : null;

  return (
    <section className="artistPublicBookingPanel" aria-label="انتخاب نوبت">

      <div className="artistPublicBookingService">
        <ServiceIcon emoji={activeService?.emoji} name={activeService?.name} size="lg" />
        <div className="artistPublicBookingServiceInfo">
          <strong>{activeService?.name || "خدمت"}</strong>
          <small>
            <Timer size={12} /> {activeService?.duration || `${toPersianDigits(durationMinutes)} دقیقه`}
          </small>
        </div>
        {activeService?.priceHidden ? null : (
          <b>{parseTomanAmount(activeService?.price) ? `${formatTomanNumber(parseTomanAmount(activeService.price))} تومان` : "—"}</b>
        )}
      </div>

      <PlaceLine artist={artist} day={bookingDay} />

      {activeService?.hint ? (
        <p className="artistPublicBookingServiceHint">{activeService.hint}</p>
      ) : null}

      <BookingSlotPicker
        dayOptions={salonClientBookingDays}
        dayValue={bookingDay}
        onDayChange={(day) => { autoDayRef.current = false; onDayChange(day, durationMinutes); }}
        closedDays={daysIn("closed")}
        disabledDays={daysIn("over")}
        fullDays={daysIn("full")}
        timeOptions={freeSlots}
        timeValue={bookingSlot}
        onTimeChange={onSlotChange}
        emptyTimeMessage="این روز برای این کار جای خالی نداره."
        emptyTime={fullDayWait}
      />
    </section>
  );
}
