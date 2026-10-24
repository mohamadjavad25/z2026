"use client";

import { useEffect, useRef } from "react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { LocationButton } from "../../components/LocationButton";
import { MapPin, Timer } from "lucide-react";
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
import { findSalonHourForDateKey, isSalonHourOpen, salonDayWindow } from "../../shared/lib/salonAvailability";
import { placeOfDay, placeRefusal } from "../../shared/lib/artistPlace";
import { resolveRollingPersianDateKey } from "../../shared/lib/persianCalendar";
import { openInAppHref } from "../../shared/lib/appHandoff";

/** The 30-minute start times of one day that fit the artist's hours; the default week when none are known. */
function slotsInHours(hours, day, durationMinutes) {
  const rows = Array.isArray(hours) && hours.length ? hours : null;
  if (!rows) return buildPublicBookingSlots(durationMinutes);
  // The day strip holds labels ("شنبه ۲ آبان"); the hours are looked up by the real date.
  const row = findSalonHourForDateKey(rows, resolveRollingPersianDateKey(day) || day);
  if (!isSalonHourOpen(row)) return [];
  const window = salonDayWindow(row);
  return buildDayBookingSlots(window.open, window.close, durationMinutes);
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
  const slotsFor = (day) => slotsInHours(artist?.hours, day, durationMinutes);
  const slots = slotsFor(bookingDay);
  const freeSlots = slots.filter(
    (slot) => !isTooSoonToRequest(bookingDay, slot) && !isPublicArtistSlotBlocked(
      artist,
      bookingDay,
      slot,
      durationMinutes
    )
  );

  // An artist on a salon team: where each day is received (the server sends it with the hours). A day the salon
  // cannot receive them stays selectable, so the reason can be read under it.
  const team = artist?.team || null;
  const placeKindOf = (day) => (artist?.placeDays ? placeOfDay(artist.placeDays, resolveRollingPersianDateKey(day) || day)?.kind || "own" : "own");
  const offDay = (day) => ["closed", "away", "blocked"].includes(placeKindOf(day));
  const placeTone = { salon: { tone: "salon", text: "سالن" }, own: { tone: "own", text: "خودش" }, closed: { tone: "off", text: "تعطیل" }, away: { tone: "off", text: "نیست" }, blocked: { tone: "off", text: "بسته" } };
  const dayTags = team ? Object.fromEntries(salonClientBookingDays.map((day) => [day, placeTone[placeKindOf(day)]])) : {};
  const selectedKind = placeKindOf(bookingDay);

  // Rule: a day with NO free slot is full — shown disabled and not selectable.
  const fullDays = salonClientBookingDays.filter((day) => (
    !offDay(day)
    && !slotsFor(day).some((slot) => !isTooSoonToRequest(day, slot) && !isPublicArtistSlotBlocked(artist, day, slot, durationMinutes))
  ));

  // Open on the first day that still has a free hour (today is often already over), until the
  // client picks a day themselves.
  const autoDayRef = useRef(true);
  const firstOpenDay = salonClientBookingDays.find((day) => !fullDays.includes(day) && !offDay(day));
  useEffect(() => {
    if (autoDayRef.current && (fullDays.includes(bookingDay) || offDay(bookingDay)) && firstOpenDay && firstOpenDay !== bookingDay) {
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

  const placeLine = team ? (
        <div className={`plPlace is-${selectedKind === "salon" ? "salon" : selectedKind === "own" ? "own" : "off"}`} role="note">
          {selectedKind === "salon" ? (
            <>
              <b>این روز {artist.name} توی {team.name} هست</b>
              <span>
                <MapPin size={14} aria-hidden="true" />
                {[team.location?.address, team.location?.detail].filter(Boolean).join("، ") || "آدرس سالن رو از خودش بپرس."}
                <LocationButton name={team.name} location={team.location} />
              </span>
            </>
          ) : selectedKind === "own" ? (
            <>
              <b>این روز {artist.name} جای خودش کار می‌کنه</b>
              <span>
                <MapPin size={14} aria-hidden="true" />
                {[artist.location?.address, artist.location?.detail].filter(Boolean).join("، ") || "آدرسش رو هنوز نذاشته؛ با «تماس» بپرس."}
              </span>
            </>
          ) : (
            <>
              <b>{placeRefusal(selectedKind, { name: artist.name || "آرتیست", salonName: team.name })}</b>
              {selectedKind === "blocked" ? <a href={openInAppHref("salon", team.salonId)}>رزرو از {team.name}، با {artist.name}</a> : null}
            </>
          )}
        </div>
      ) : null;

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
        dayTags={dayTags}
        afterDays={placeLine}
        timeOptions={freeSlots}
        timeValue={bookingSlot}
        onTimeChange={onSlotChange}
        emptyTimeMessage={team && offDay(bookingDay)
          ? placeRefusal(selectedKind, { name: artist.name || "آرتیست", salonName: team.name })
          : "این روز ساعت خالی‌ای به این اندازه نیست."}
      />


      <p className="artistPublicBookingNote">
        تا کار تموم نشه، ساعت دیگه‌ای گرفته نمی‌شه.
      </p>
    </section>
  );
}
