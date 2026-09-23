import { toLatinDigits } from "../../shared/lib/digits";
import {
  PERSIAN_WEEKDAYS,
  formatPersianDateKey,
  formatPersianDayTitle,
  isPersianDateKey,
  persianDateKeyToDate,
  resolveRollingPersianDateKey
} from "../../shared/lib/persianCalendar";
import {
  buildPublicBookingSlots,
  getTehranClockMinutes,
  getTodayPersianWeekday,
  parseServiceDurationMinutes,
  rangesOverlap,
  timeLabelToMinutes
} from "../../shared/lib/time";
import { artistBookingDays, artistBookingHistoryRank } from "./constants";

export { buildPublicBookingSlots };

export const artistAvailableSlots = buildPublicBookingSlots(60);

export function isPublicArtistSlotBlocked(artist, day, slot, durationMinutes) {
  const start = timeLabelToMinutes(slot);
  const end = start + Math.max(15, Number(durationMinutes) || 60);

  const breakTime = artist?.breakTime;
  if (breakTime?.start && breakTime?.end) {
    const breakStart = timeLabelToMinutes(breakTime.start);
    const breakEnd = timeLabelToMinutes(breakTime.end);
    if (breakEnd > breakStart && rangesOverlap(start, end, breakStart, breakEnd)) {
      return true;
    }
  }

  return (artist?.bookedSlots || [])
    .filter((item) => resolveRollingPersianDateKey(item.booking_date) === resolveRollingPersianDateKey(day))
    .some((item) => {
      const bookedStart = timeLabelToMinutes(item.time);
      const bookedEnd = bookedStart + Math.max(15, Number(item.duration_minutes) || 60);
      return rangesOverlap(start, end, bookedStart, bookedEnd);
    });
}

export function getArtistBookingSortKey(booking) {
  const day = getArtistBookingDayRank(booking?.date);
  const [hours = "0", minutes = "0"] = toLatinDigits(booking?.time).split(":");
  return day * 1440 + (Number(hours) || 0) * 60 + (Number(minutes) || 0);
}

export function sortArtistBookingsNearest(list) {
  return [...list].sort((a, b) => getArtistBookingSortKey(a) - getArtistBookingSortKey(b));
}

export function buildArtistBookingWeekTabs() {
  const today = getTodayPersianWeekday();
  const todayIndex = PERSIAN_WEEKDAYS.indexOf(today);
  const ordered = todayIndex >= 0
    ? [...PERSIAN_WEEKDAYS.slice(todayIndex), ...PERSIAN_WEEKDAYS.slice(0, todayIndex)]
    : PERSIAN_WEEKDAYS;
  return ordered.map((day, index) => ({
    day,
    label: index === 0 ? "امروز" : day,
    sub: index === 0 ? day : index === 1 ? "فردا" : "",
    dateKey: resolveRollingPersianDateKey(day)
  }));
}

export function buildExactBookingDateTabs(count = 7) {
  const today = new Date();
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const title = formatPersianDayTitle(date);
    return {
      day: title.weekday,
      label: index === 0 ? "امروز" : title.weekday,
      sub: `${title.day} ${title.monthLabel}`,
      dateKey: formatPersianDateKey(date),
      value: title.full
    };
  });
}

/**
 * Like buildExactBookingDateTabs, but centered on today instead of starting
 * at it: `daysBefore` past days, today, then `daysAfter` future days. Used
 * where the rail should scroll both directions with today in the middle
 * (e.g. the salon hero week strip). `daysBefore`/`daysAfter` can safely
 * exceed 6 (a range spanning more than one week) as long as the CALLER
 * keys day-identity/selection off `dateKey` rather than the bare `day`
 * (weekday name) field — weekday names repeat every 7 days, so beyond a
 * single week they're only meaningful as display text, not as an identity.
 */
export function buildExactBookingDateTabsCentered(daysBefore = 3, daysAfter = 3) {
  const today = new Date();
  const length = daysBefore + daysAfter + 1;
  return Array.from({ length }, (_, index) => {
    const offset = index - daysBefore;
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    const title = formatPersianDayTitle(date);
    return {
      day: title.weekday,
      label: offset === 0 ? "امروز" : title.weekday,
      sub: `${title.day} ${title.monthLabel}`,
      dateKey: formatPersianDateKey(date),
      value: title.full,
      offset
    };
  });
}

/**
 * Days between `dateKey` ("1404-06-11") and `from` (default today), signed:
 * negative = past, positive = future. Used to size unrestricted-scroll
 * ranges (how far back/forward a widget needs to go to cover real bookings)
 * and to let absolute dateKeys resolve to a same-day rank below.
 */
export function getBookingDateOffsetDays(dateKey, from = new Date()) {
  const resolved = persianDateKeyToDate(dateKey, from);
  if (!resolved) return 0;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const end = new Date(resolved.getFullYear(), resolved.getMonth(), resolved.getDate());
  return Math.round((end - start) / 86400000);
}

export function getArtistBookingDayRank(date) {
  const value = String(date || "").trim();
  if (!value) return 99;
  if (value === "امروز") return 0;
  if (value === "فردا") return 1;
  if (value === "پس‌فردا") return 2;
  if (isPersianDateKey(value)) {
    // Widgets with an unrestricted (non-weekly) scroll range key days by
    // absolute dateKey instead of a relative label. Only today/tomorrow/day
    // after map onto this rolling 0..6 rank scale meaningfully; anything
    // else (a specific far day) isn't "the rolling week" so it falls back
    // to the same 99 ("not ranked") used for any other non-matching value.
    const offset = getBookingDateOffsetDays(value);
    if (offset >= 0 && offset <= 2) return offset;
    return 99;
  }
  const todayIndex = PERSIAN_WEEKDAYS.indexOf(getTodayPersianWeekday());
  const dayIndex = PERSIAN_WEEKDAYS.indexOf(value);
  if (todayIndex >= 0 && dayIndex >= 0) return (dayIndex - todayIndex + 7) % 7;
  const relativeIndex = artistBookingDays.indexOf(value);
  return relativeIndex >= 0 ? relativeIndex : 99;
}

export function isArtistBookingOnSelectedDay(booking, selectedDay) {
  const date = String(booking?.date || "").trim();
  if (!selectedDay) return true;
  if (date === selectedDay) return true;
  if (booking?.dateKey && booking.dateKey === selectedDay) return true;
  if (selectedDay === getTodayPersianWeekday() && date === "امروز") return true;
  if (getArtistBookingDayRank(date) === getArtistBookingDayRank(selectedDay)) return true;
  return false;
}

export function getBookingDateKey(value, from = new Date()) {
  return resolveRollingPersianDateKey(value || "امروز", from);
}

export function isArtistBookingOnExactDate(booking, dateKey) {
  const targetKey = String(dateKey || "").trim();
  if (!targetKey) return true;
  const source = booking?.dateKey || booking?.booking_date || booking?.date || "";
  return resolveRollingPersianDateKey(source) === targetKey;
}

/** Map "امروز"/"فردا"/weekday labels to the weekday used by booking week rails. */
export function resolveBookingDateToWeekday(date) {
  const value = String(date || "").trim();
  if (PERSIAN_WEEKDAYS.includes(value)) return value;
  const rank = getArtistBookingDayRank(value);
  if (rank >= 0 && rank < 7) {
    const todayIndex = PERSIAN_WEEKDAYS.indexOf(getTodayPersianWeekday());
    if (todayIndex >= 0) return PERSIAN_WEEKDAYS[(todayIndex + rank) % 7];
  }
  return getTodayPersianWeekday();
}

const BOOKING_PHASE_LABEL = {
  live: "در حال انجام",
  done: "انجام شد",
  upcoming: "در انتظار"
};

/**
 * Timeline phase for a booking relative to now.
 * - live: started and not yet finished (today only)
 * - done: end time has passed (today)
 * - upcoming: not started yet, or a future day in the week rail
 */
export function getBookingTimelinePhase(booking, {
  selectedDay = "",
  now = new Date(),
  durationMinutes = 60
} = {}) {
  const date = String(booking?.date || booking?.booking_date || "").trim();
  const dayKey = selectedDay || date;
  const dayRank = getArtistBookingDayRank(dayKey);

  // Rolling week rail only has today (0) and future days (1..6)
  if (dayRank !== 0) return "upcoming";

  const start = timeLabelToMinutes(booking?.time);
  if (!Number.isFinite(start) || start < 0) return "upcoming";
  const duration = Math.max(15, Number(durationMinutes) || 60);
  const end = start + duration;
  const nowMinutes = getTehranClockMinutes(now);

  if (nowMinutes < start) return "upcoming";
  if (nowMinutes < end) return "live";
  return "done";
}

export function getBookingTimelineLabel(phase) {
  return BOOKING_PHASE_LABEL[phase] || BOOKING_PHASE_LABEL.upcoming;
}

export function resolveBookingDurationMinutes(booking, serviceList = []) {
  const direct = Number(booking?.durationMinutes || booking?.duration_minutes || 0);
  if (direct > 0) return direct;
  const serviceName = String(booking?.service || "").trim();
  const matched = (serviceList || []).find((item) => item?.name === serviceName);
  return parseServiceDurationMinutes(matched?.duration);
}

export function getArtistClientVisits(booking) {
  const visits = Array.isArray(booking?.visits) ? booking.visits.slice(0, 10) : [];
  while (visits.length < 10) visits.push(0);
  return visits;
}

export function getArtistBookingStatusKey(status) {
  if (status === "VIP") return "vip";
  // "تایید" = artist self-entered (already decided when created); "تایید شده"
  // = a real client request the artist confirmed via the notification panel.
  // Both mean "confirmed", so both map to "ok" — see the real booking-
  // confirmation flow added this session (PATCH /api/artist/me kind:"booking").
  if (status === "تایید" || status === "تایید شده") return "ok";
  if (status === "لغو") return "cancelled";
  // Timed-out (salon/artist never responded within the 1-hour window) —
  // kept distinct from "لغو" so a viewer can tell "actively declined" apart
  // from "nobody answered in time", same distinction the client-facing
  // status pill already makes (ClientBookingsPanel.jsx).
  if (status === "منقضی شده") return "expired";
  return "wait";
}

export function getArtistBookingHistoryKey(booking) {
  if (booking?.history === "day" || booking?.history === "week" || booking?.history === "month") {
    return booking.history;
  }
  const dayRank = getArtistBookingDayRank(booking?.date);
  if (dayRank === 0) return "day";
  if ((dayRank > 0 && dayRank < 7) || String(booking?.date || "").includes("هفته")) {
    return "week";
  }
  return "month";
}

export function filterArtistBookingsByHistory(list, filterId) {
  if (filterId === "all") return list;
  const maxRank = artistBookingHistoryRank[filterId] || 3;
  return list.filter((booking) => {
    const key = getArtistBookingHistoryKey(booking);
    return (artistBookingHistoryRank[key] || 3) <= maxRank;
  });
}

export function mapArtistBooking(row) {
  if (!row) return null;
  const profile = row.clientProfile && typeof row.clientProfile === "object"
    ? row.clientProfile
    : null;
  const date = row.booking_date || row.date || "";
  return {
    id: row.id,
    time: row.time || "",
    date,
    dateKey: resolveRollingPersianDateKey(date),
    client: profile?.name || row.client_name || row.client || "",
    clientUserId: profile?.id || row.client_user_id || null,
    clientAvatar: profile?.avatar || "",
    clientArea: profile?.area || "",
    clientBio: profile?.bio || "",
    clientType: profile?.type || "client",
    sourceSalon: row.sourceSalon || row.source_salon || null,
    phone: profile?.phone || row.client_phone || row.phone || "",
    service: row.service || "",
    status: row.status || "تایید",
    createdAt: row.created_at || "",
    durationMinutes: Number(row.duration_minutes || 0) || 60,
    history: row.history || "day",
    visits: Array.isArray(row.visits) ? row.visits : Array.from({ length: 10 }, () => 0)
  };
}
