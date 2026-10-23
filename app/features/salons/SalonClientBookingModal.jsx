"use client";

import { useMemo } from "react";
import { VisitBooker } from "../booking/VisitBooker";
import { normalizeServices } from "../booking/visitBookerModel";
import { getSalonFallbacks, getSalonVisitPreview, getSalonVisitTimes } from "../../shared/api/salons";
import { serviceKey } from "../../shared/lib/serviceBundle";
import { matchServiceNames } from "../../shared/lib/serviceMatch";
import { buildExactBookingDateTabs } from "../artist/bookingUtils";
import { findSalonHourForDateKey, isSalonHourOpen } from "../../shared/lib/salonAvailability";
import { getBookableSalonServiceItems } from "./useSalonDirectory";

/**
 * A client's booking request at a salon: VisitBooker with the services they picked (one, or several
 * back to back), the salon's free times and who would do what, both asked of the server. The request
 * goes out through `onSubmit` (useSalonDirectory submitSalonClientVisit).
 */
export function SalonClientBookingModal({ open, salon, booking, onClose, onSubmit, onEditProfile }) {
  const services = useMemo(() => normalizeServices(getBookableSalonServiceItems(salon)), [salon]);
  // The next two weeks (the form looks ahead through all of them for a free hour) as real dates (never a bare weekday name, which a server would have to guess a
  // date for), worked out each time the sheet opens so a screen left open past midnight is not a day behind.
  const days = useMemo(() => buildExactBookingDateTabs(14).map((tab) => ({
    value: tab.dateKey,
    weekday: tab.day,
    label: `${tab.label} ${tab.sub || ""}`.trim(),
    closed: Array.isArray(salon?.hours) && salon.hours.length > 0 && !isSalonHourOpen(findSalonHourForDateKey(salon.hours, tab.dateKey))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [salon, open]);

  if (!open || !salon) return null;
  const salonUserId = salon.id || salon.source_key;
  // From an unanswered request: the same services by this salon's own names (a salon may spell one a little differently).
  const wanted = booking.prefill?.names?.length ? (matchServiceNames(services, booking.prefill.names) || booking.prefill.names) : null;
  const picked = wanted
    ? wanted.map((name) => services.find((service) => service.name === name)?.key).filter(Boolean)
    : booking.bundle?.name === booking.service && Array.isArray(booking.bundle.items)
      ? booking.bundle.items.map(serviceKey)
      : [services.find((service) => service.name === booking.service)?.key].filter(Boolean);
  const source = {
    loadTimes: async ({ day, services: list, people = 1 }) => {
      const { ok, data } = await getSalonVisitTimes(salonUserId, day, list, people);
      return { ok, times: data?.times };
    },
    loadPlan: async ({ day, time, services: list, people = 1 }) => {
      const { ok, data } = await getSalonVisitPreview(salonUserId, day, time, list, [], people);
      return { ok, data };
    },
    // Followed salons that could take the same visit if this one doesn't answer within the hour.
    loadBackups: async ({ day, time, services: list }) => {
      const { ok, data } = await getSalonFallbacks(salonUserId, day, time, list);
      return { ok, salons: data?.salons };
    }
  };
  return (
    <VisitBooker
      open
      role="client"
      title={`رزرو در ${salon.name || "سالن"}`}
      services={services}
      days={days}
      initial={{ selected: picked, day: booking.prefill?.day, time: booking.prefill?.time, name: booking.client, phone: booking.phone }}
      contactPhone={salon.phone || ""}
      source={source}
      onSubmit={onSubmit}
      onDone={() => {}}
      onClose={onClose}
      onEditProfile={onEditProfile}
    />
  );
}
