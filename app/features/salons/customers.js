import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { formatPersianDayTitle, isSamePersianDay, resolveRollingPersianDate } from "../../shared/lib/persianCalendar";

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
 *
 * `followers` (GET /api/followers) are people who followed this owner: each is
 * a contact too. One who already booked is merged into that customer (and
 * marked as a follower); one who has not booked yet becomes a customer with
 * `noBookingYet` so the owner can see who still needs a first reason to come.
 */
export function buildBookingCustomers(bookings = [], followers = []) {
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
        followedAt: 0,
        isFollower: false,
        isNewFollower: false,
        followedToday: false,
        hasBooked: true,
        noBookingYet: false,
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
  const now = new Date();
  [...followers]
    .sort((a, b) => followTime(b) - followTime(a))
    .forEach((follower) => {
      const phone = phoneKey(follower.phone);
      const id = follower.userId;
      const keys = [phone && `phone:${phone}`, id && `id:${id}`].filter(Boolean);
      let customer = keys.map((key) => byKey.get(key)).find(Boolean);
      if (!customer) {
        customer = {
          key: keys[0] || `follower:${follower.name}`,
          name: follower.name || "مشتری جدید",
          phone: follower.phone || "",
          avatar: follower.avatar || "",
          lastService: "",
          lastDate: "",
          visitCount: 0,
          completed: 0,
          upcoming: 0,
          cancelled: 0,
          lastVisitTime: 0,
          nextTime: 0,
          bookings: []
        };
        byKey.set(customer.key, customer);
      }
      const since = followTime(follower);
      customer.isFollower = true;
      customer.followedAt = since;
      customer.isNewFollower = Boolean(follower.isNew);
      customer.followedToday = since > 0 && isSamePersianDay(new Date(since), now);
      customer.hasBooked = customer.visitCount > 0 || customer.cancelled > 0 || Boolean(follower.hasBooked);
      customer.noBookingYet = !customer.hasBooked;
      if (!customer.avatar && follower.avatar) customer.avatar = follower.avatar;
      if (!customer.phone && follower.phone) customer.phone = follower.phone;
    });
  return [...byKey.values()];
}

function followTime(follower) {
  const time = new Date(follower?.followedAt || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}

/**
 * The people to greet at the top of the customers page: followers from today,
 * plus anyone still unseen even if they followed earlier (the owner may not have
 * opened the app for days). Newest first.
 */
export function pickFreshFollowers(customers = []) {
  return customers
    .filter((customer) => customer.isFollower && (customer.followedToday || customer.isNewFollower))
    .sort((a, b) => b.followedAt - a.followedAt);
}

const MINUTE_MS = 60 * 1000;

/** «همین الان» / «۱۲ دقیقه پیش» / «امروز ساعت ۱۴:۳۰» / «دیروز» / «۳ آبان»: when someone followed, in plain words. */
export function describeFollowTime(time, now = new Date()) {
  if (!time) return "";
  const date = new Date(time);
  if (!Number.isFinite(date.getTime())) return "";
  const minutes = Math.floor((now.getTime() - date.getTime()) / MINUTE_MS);
  if (minutes < 1) return "همین الان";
  if (minutes < 60) return `${toPersianDigits(minutes)} دقیقه پیش`;
  if (isSamePersianDay(date, now)) {
    const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Tehran" }).format(date);
    return `امروز ساعت ${toPersianDigits(clock)}`;
  }
  const yesterday = new Date(now.getTime() - 24 * 60 * MINUTE_MS);
  if (isSamePersianDay(date, yesterday)) return "دیروز";
  const title = formatPersianDayTitle(date);
  return `${title.day} ${title.monthLabel}`;
}
