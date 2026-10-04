import { toLatinDigits } from "../../shared/lib/digits";
import { resolveRollingPersianDate } from "../../shared/lib/persianCalendar";

const CANCELLED = new Set(["لغو", "منقضی شده"]);

/** Last 10 digits of a phone, so 0912…, +98912… and Persian-digit input all match. */
export function phoneKey(phone) {
  const digits = toLatinDigits(String(phone || "")).replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function customerKey(booking) {
  const phone = phoneKey(booking.phone);
  const id = booking.client_user_id || booking.clientUserId;
  return (
    (phone && `phone:${phone}`)
    || (id && `id:${id}`)
    || (booking.client && `name:${String(booking.client).trim()}`)
    || null
  );
}

function bookingTime(booking) {
  const raw = booking.booking_date || booking.date || "";
  if (!raw) return null;
  const time = resolveRollingPersianDate(raw).getTime();
  return Number.isFinite(time) ? time : null;
}

/**
 * Groups an owner's real bookings (salonAppointmentList for a salon,
 * artistBookingList for an artist) into one row per real-world customer.
 * Shared by the customers page and the booking-create form's name lookup.
 * Rows arrive newest first, so the first booking seen per customer is the
 * most recent one. A customer is keyed by phone first (so a walk-in and the
 * same person's registered account merge), then account id, then name.
 */
export function buildBookingCustomers(bookings = []) {
  const todayTime = resolveRollingPersianDate("امروز").getTime();
  const byKey = new Map();
  bookings.forEach((booking) => {
    const key = customerKey(booking);
    if (!key) return;
    let customer = byKey.get(key);
    if (!customer) {
      customer = {
        key,
        name: booking.client || "مشتری",
        phone: booking.phone || "",
        avatar: booking.client_avatar || booking.clientAvatar || "",
        lastService: booking.service || "",
        lastDate: booking.booking_date || booking.date || "",
        visitCount: 0,
        completed: 0,
        upcoming: 0,
        cancelled: 0,
        lastVisitTime: 0,
        nextTime: 0,
        bookings: []
      };
      byKey.set(key, customer);
    }
    if (!customer.phone && booking.phone) customer.phone = booking.phone;
    if (!customer.avatar) customer.avatar = booking.client_avatar || booking.clientAvatar || "";
    customer.bookings.push(booking);

    if (CANCELLED.has(booking.status)) {
      customer.cancelled += 1;
      return;
    }
    customer.visitCount += 1;
    const time = bookingTime(booking);
    const isPast = time !== null && time < todayTime;
    if (booking.status === "تایید شده" && isPast) {
      customer.completed += 1;
      customer.lastVisitTime = Math.max(customer.lastVisitTime, time);
    } else if (!isPast) {
      customer.upcoming += 1;
      if (time !== null && (!customer.nextTime || time < customer.nextTime)) customer.nextTime = time;
    }
  });
  return [...byKey.values()];
}
