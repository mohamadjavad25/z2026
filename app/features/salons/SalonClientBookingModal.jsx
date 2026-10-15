"use client";

import { useMemo } from "react";
import { VisitBooker } from "../booking/VisitBooker";
import { normalizeServices } from "../booking/visitBookerModel";
import { getSalonVisitPreview, getSalonVisitTimes } from "../../shared/api/salons";
import { serviceKey } from "../../shared/lib/serviceBundle";
import { salonClientBookingDays } from "../artist/constants";
import { getBookableSalonServiceItems } from "./useSalonDirectory";

// The salon's hours rows are keyed by the Persian weekday name; a day label looks like "یکشنبه ۱۲ مهر".
function getClosedDayLabels(hours, dayLabels) {
  if (!Array.isArray(hours) || !hours.length) return new Set();
  return new Set(dayLabels.filter((label) => {
    const row = hours.find((item) => item.day === String(label).split(" ")[0]);
    return row && !row.active;
  }));
}

/**
 * A client's booking request at a salon: VisitBooker with the services they picked (one, or several
 * back to back), the salon's free times and who would do what, both asked of the server. The request
 * goes out through `onSubmit` (useSalonDirectory submitSalonClientVisit).
 */
export function SalonClientBookingModal({ open, salon, booking, onClose, onSubmit, onEditProfile }) {
  const services = useMemo(() => normalizeServices(getBookableSalonServiceItems(salon)), [salon]);
  const days = useMemo(() => {
    const closed = getClosedDayLabels(salon?.hours, salonClientBookingDays);
    return salonClientBookingDays.map((label) => ({ value: label, label, closed: closed.has(label) }));
  }, [salon]);

  if (!open || !salon) return null;
  const salonUserId = salon.id || salon.source_key;
  const picked = booking.bundle?.name === booking.service && Array.isArray(booking.bundle.items)
    ? booking.bundle.items.map(serviceKey)
    : [services.find((service) => service.name === booking.service)?.key].filter(Boolean);
  const source = {
    loadTimes: async ({ day, services: list }) => {
      const { ok, data } = await getSalonVisitTimes(salonUserId, day, list);
      return { ok, times: data?.times };
    },
    loadPlan: async ({ day, time, services: list }) => {
      const { ok, data } = await getSalonVisitPreview(salonUserId, day, time, list);
      return { ok, data };
    }
  };
  return (
    <VisitBooker
      open
      role="client"
      title={`رزرو در ${salon.name || "سالن"}`}
      services={services}
      days={days}
      initial={{ selected: picked, name: booking.client, phone: booking.phone }}
      source={source}
      onSubmit={onSubmit}
      onDone={() => {}}
      onClose={onClose}
      onEditProfile={onEditProfile}
    />
  );
}
