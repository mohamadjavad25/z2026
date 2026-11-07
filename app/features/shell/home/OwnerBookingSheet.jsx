"use client";

import { useMemo } from "react";
import { VisitBooker } from "../../booking/VisitBooker";
import { artistVisitTimes } from "../../booking/artistVisitTimes";
import { buildExactBookingDateTabs, mapArtistBooking } from "../../artist/bookingUtils";
import { getArtistMe } from "../../../shared/api/artists";
import { getSalonVisitPreview, getSalonVisitTimes } from "../../../shared/api/salons";
import { findSalonHourForWeekday, isSalonHourOpen } from "../../../shared/lib/salonAvailability";
import { normalizeServices } from "../../booking/visitBookerModel";
import { useHome } from "../HomeContext";

// A salon or an artist may enter any date themselves (owner's decision of 2026-10-25; the 60 days are for clients only):
// a year ahead, as far as their calendar goes. The form shows these a few weeks at a time.
export const OWNER_VISIT_DAYS = 365;

/**
 * «ایجاد رزرو» for a salon or an independent artist: VisitBooker with the owner's own data. The
 * salon asks the server for free times and the plan (who does what); the artist's times come from
 * their own calendar. Opened once per use, so what it was given at that moment stays put.
 */
export function OwnerBookingSheet() {
  const {
    bookingSheetOpen,
    bookingPrefill,
    createdProfile,
    closeBookingSheet,
    bookingCustomerOptions,
    salonServiceList,
    artistServiceList,
    salonHoursList,
    artistBookingList,
    artistBreakTime,
    openArtistServiceCreate,
    openSalonServiceCreate,
    submitSalonVisit,
    submitArtistVisit
  } = useHome();
  const type = createdProfile?.type;
  const role = type === "artist" ? "artist" : "salon";
  const open = Boolean(bookingSheetOpen) && (type === "salon" || type === "artist");

  const services = useMemo(() => normalizeServices(role === "artist" ? artistServiceList : salonServiceList), [role, artistServiceList, salonServiceList]);
  // The salon's closed days are shown but cannot be picked. A year of days costs real time, and this sheet sits in every
  // home screen, also closed: nothing is worked out until it opens, and a day's hours come from its weekday name.
  const days = useMemo(() => (open ? buildExactBookingDateTabs(OWNER_VISIT_DAYS).map((tab) => ({
    value: tab.dateKey,
    label: `${tab.label} ${tab.sub || ""}`.trim(),
    closed: role === "salon" && !isSalonHourOpen(findSalonHourForWeekday(salonHoursList, tab.day))
  })) : []
  // Worked out again each time the sheet opens, so a screen left open past midnight is not a day behind.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [role, salonHoursList, open]);

  const salonUserId = createdProfile?.id;
  const source = role === "artist"
    ? {
      // The artist's own calendar: the app's copy, or -- after a clash or a failed try -- a fresh look at the server's.
      loadTimes: async ({ day, services: picked, fresh }) => {
        let bookings = artistBookingList;
        let breakTime = artistBreakTime;
        if (fresh) {
          const { ok, data } = await getArtistMe();
          if (!ok) return { ok: false };
          bookings = (data?.bookings || []).map(mapArtistBooking).filter(Boolean);
          breakTime = data?.breakTime || null;
        }
        return { ok: true, times: artistVisitTimes({ day, minutes: picked.reduce((sum, item) => sum + item.minutes, 0), bookings, breakTime }) };
      }
    }
    : {
      loadTimes: async ({ day, services: picked }) => {
        const { ok, data } = await getSalonVisitTimes(salonUserId, day, picked);
        return { ok, times: data?.times };
      },
      loadPlan: async ({ day, time, services: picked, staff }) => {
        const { ok, data } = await getSalonVisitPreview(salonUserId, day, time, picked, staff);
        return { ok, data };
      }
    };

  if (!open) return null;
  return (
    <VisitBooker
      // The lists are taken when the sheet opens; if the services were still loading then, start again once they are there.
      key={`${role}-${services.length ? "ready" : "loading"}`}
      open
      role={role}
      title="نوبت تازه"
      services={services}
      days={days}
      initial={{ name: bookingPrefill?.client || "", phone: bookingPrefill?.phone || "" }}
      customers={bookingCustomerOptions}
      source={source}
      onSubmit={role === "artist" ? submitArtistVisit : submitSalonVisit}
      onDone={closeBookingSheet}
      onClose={closeBookingSheet}
      onAddService={() => {
        closeBookingSheet();
        if (role === "artist") openArtistServiceCreate();
        else openSalonServiceCreate();
      }}
    />
  );
}
