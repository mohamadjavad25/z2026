"use client";

import { useMemo } from "react";
import { VisitBooker } from "../../booking/VisitBooker";
import { artistVisitTimes } from "../../booking/artistVisitTimes";
import { buildExactBookingDateTabs } from "../../artist/bookingUtils";
import { getSalonVisitPreview, getSalonVisitTimes } from "../../../shared/api/salons";
import { findSalonHourForDateKey, isSalonHourOpen } from "../../../shared/lib/salonAvailability";
import { normalizeServices } from "../../booking/visitBookerModel";
import { useHome } from "../HomeContext";

const VISIT_DAYS = 7;

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
  // The next seven days. The salon's closed days are shown but cannot be picked.
  const days = useMemo(() => buildExactBookingDateTabs(VISIT_DAYS).map((tab) => ({
    value: tab.dateKey,
    label: `${tab.label} ${tab.sub || ""}`.trim(),
    closed: role === "salon" && !isSalonHourOpen(findSalonHourForDateKey(salonHoursList, tab.dateKey))
  })), [role, salonHoursList]);

  const salonUserId = createdProfile?.id;
  const source = role === "artist"
    ? {
      // The artist's own calendar, as it is when asked (a fresh look after a clash).
      loadTimes: async ({ day, services: picked }) => ({
        ok: true,
        times: artistVisitTimes({
          day,
          minutes: picked.reduce((sum, item) => sum + item.minutes, 0),
          bookings: artistBookingList,
          breakTime: artistBreakTime
        })
      })
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
      open
      role={role}
      title="ایجاد رزرو"
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
