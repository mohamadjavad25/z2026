import { toAsciiDigits, toPersianDigits } from "./digits.js";

const persianDateFmt = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
  timeZone: "Asia/Tehran"
});

const persianMonthLongFmt = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
  month: "long",
  timeZone: "Asia/Tehran"
});

const persianWeekdayFmt = new Intl.DateTimeFormat("fa-IR", {
  weekday: "long",
  timeZone: "Asia/Tehran"
});

export const PERSIAN_WEEKDAY_HEADERS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
export const PERSIAN_WEEKDAYS = ["شنبه", "یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه"];

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function getPersianDateParts(date = new Date()) {
  const parts = Object.fromEntries(
    persianDateFmt
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return {
    year: Number(parts.year) || 0,
    month: Number(parts.month) || 0,
    day: Number(parts.day) || 0
  };
}

export function formatPersianDateKey(date = new Date()) {
  const parts = getPersianDateParts(date);
  if (!parts.year || !parts.month || !parts.day) return "";
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

export function getPersianWeekday(date = new Date()) {
  return persianWeekdayFmt.format(date);
}

export function getPersianMonthLabel(year, month) {
  const probe = findPersianMonthStart(year, month);
  return persianMonthLongFmt.format(probe);
}

export function findPersianMonthStart(year, month) {
  let cursor = startOfDay(new Date());
  for (let guard = 0; guard < 48; guard += 1) {
    const parts = getPersianDateParts(cursor);
    const diffMonths = (year - parts.year) * 12 + (month - parts.month);
    if (diffMonths === 0) {
      cursor.setDate(cursor.getDate() - (parts.day - 1));
      const verified = getPersianDateParts(cursor);
      if (verified.year === year && verified.month === month && verified.day === 1) {
        return startOfDay(cursor);
      }
      cursor.setDate(cursor.getDate() - 1);
      continue;
    }
    cursor.setDate(cursor.getDate() + diffMonths * 29);
  }
  return startOfDay(new Date());
}

export function shiftPersianMonth(year, month, delta) {
  let nextYear = year;
  let nextMonth = month + delta;
  while (nextMonth < 1) {
    nextMonth += 12;
    nextYear -= 1;
  }
  while (nextMonth > 12) {
    nextMonth -= 12;
    nextYear += 1;
  }
  return { year: nextYear, month: nextMonth };
}

export function persianWeekdayIndex(weekday) {
  const normalized = compactLabel(weekday);
  let index = PERSIAN_WEEKDAYS.findIndex((day) => compactLabel(day) === normalized);
  if (index < 0) {
    // Labels may carry a date suffix ("یکشنبه ۸ شهریور"): match the LONGEST
    // contained weekday name so "یکشنبه" wins over its "شنبه" substring.
    let best = -1;
    let bestLen = 0;
    PERSIAN_WEEKDAYS.forEach((day, i) => {
      const compact = compactLabel(day);
      if (normalized.includes(compact) && compact.length > bestLen) {
        best = i;
        bestLen = compact.length;
      }
    });
    index = best;
  }
  return index >= 0 ? index : 0;
}

export function buildPersianMonthGrid(year, month) {
  const start = findPersianMonthStart(year, month);
  const lead = persianWeekdayIndex(getPersianWeekday(start));
  const cells = [];

  for (let i = 0; i < lead; i += 1) {
    cells.push(null);
  }

  let cursor = new Date(start);
  while (true) {
    const parts = getPersianDateParts(cursor);
    if (parts.year !== year || parts.month !== month) break;
    const key = formatPersianDateKey(cursor);
    cells.push({
      key,
      date: new Date(cursor),
      year: parts.year,
      month: parts.month,
      day: parts.day,
      weekday: getPersianWeekday(cursor),
      dayLabel: toPersianDigits(parts.day),
      isToday: isSamePersianDay(cursor, new Date())
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

export function isPersianDateKey(value) {
  return /^\d{3,4}-\d{2}-\d{2}$/.test(String(value || "").trim());
}

/**
 * A written date ("1405-08-03", also with Persian/Arabic digits, "/" or "." separators, or no zero padding)
 * as the canonical key "YYYY-MM-DD" -- only when it is a REAL Jalali day within about a year of `from`
 * (the range persianDateKeyToDate can check). "" for anything else: impossible month/day, a Gregorian
 * date, text. Never "today" as a fallback.
 */
export function parsePersianDateKey(value, from = new Date()) {
  const match = toAsciiDigits(String(value ?? "").trim()).match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > (month <= 6 ? 31 : 30)) return "";
  const key = `${match[1]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return year >= 1300 && persianDateKeyToDate(key, from) ? key : "";
}

/**
 * Reverses a Persian date key ("1404-02-24") back into a real Date, by
 * walking outward from `from` day by day until the formatted key matches.
 * There is no closed-form Persian→Gregorian conversion available via Intl
 * (only the other direction), so a bounded linear search is the simplest
 * reliable option; bookings are always within a small window of "now", so
 * this is cheap in practice.
 */
export function persianDateKeyToDate(dateKey, from = new Date(), rangeDays = 400) {
  if (!isPersianDateKey(dateKey)) return null;
  const base = startOfDay(from);
  const baseKey = formatPersianDateKey(base);
  if (baseKey === dateKey) return base;
  // The same key is asked for again and again (every booking row of an artist is read for each availability question,
  // up to 800 Intl formats per row), and the answer only depends on the key and on today's date, so it is remembered.
  const cacheKey = `${dateKey}|${baseKey}|${rangeDays}`;
  const known = dateKeyCache.get(cacheKey);
  if (known !== undefined) return known === null ? null : new Date(known);
  let found = null;
  for (let offset = 1; offset <= rangeDays && !found; offset += 1) {
    const forward = new Date(base);
    forward.setDate(forward.getDate() + offset);
    if (formatPersianDateKey(forward) === dateKey) { found = forward; break; }
    const backward = new Date(base);
    backward.setDate(backward.getDate() - offset);
    if (formatPersianDateKey(backward) === dateKey) found = backward;
  }
  if (dateKeyCache.size >= 4000) dateKeyCache.clear();
  dateKeyCache.set(cacheKey, found ? found.getTime() : null);
  return found;
}

const dateKeyCache = new Map();

const compactLabel = (text) => String(text || "").replace(/[\s\u200c]/g, "").replace(/ي/g, "ی").replace(/ك/g, "ک");

function hasWeekdayName(raw) {
  const normalized = compactLabel(raw);
  return PERSIAN_WEEKDAYS.some((day) => normalized.includes(compactLabel(day)));
}

/**
 * The strict reading of a booking's day: the Date it means, or null when it is not a real day. Accepted:
 * "" (today), "امروز", "فردا", "پس‌فردا", a weekday name (optionally followed by a date label), and a real
 * Jalali date key in any digits. An impossible date or plain text is null, never today and never "Saturday".
 */
export function tryResolveRollingPersianDate(value, from = new Date()) {
  const raw = String(value ?? "").trim();
  const today = startOfDay(from);
  if (!raw) return today;
  if (/^[\d۰-۹٠-٩０-９\s\-/.]+$/.test(raw)) {
    const key = parsePersianDateKey(raw, from);
    return key ? persianDateKeyToDate(key, from) : null;
  }
  if (raw === "امروز") return today;
  if (raw === "فردا" || raw === "پس‌فردا") {
    const next = new Date(today);
    next.setDate(today.getDate() + (raw === "فردا" ? 1 : 2));
    return next;
  }
  if (!hasWeekdayName(raw)) return null;
  const targetIndex = persianWeekdayIndex(raw);
  const todayIndex = persianWeekdayIndex(getPersianWeekday(today));
  const offset = (targetIndex - todayIndex + 7) % 7;
  const target = new Date(today);
  target.setDate(today.getDate() + offset);
  return target;
}

/**
 * Resolves a booking's stored day value ("امروز" / "فردا" / a bare weekday
 * name / an absolute "YYYY-MM-DD" key) to the actual Date it refers to.
 *
 * IMPORTANT: relative labels ("امروز", "فردا", a bare weekday) are only
 * meaningful at the moment they were written down — resolve them to an
 * absolute date key (see resolveRollingPersianDateKey) at write time and
 * store *that*. Passing a relative label back through this function later,
 * with a different `from`, intentionally reinterprets it relative to the
 * new `from` — callers that need a value pinned in time must store/pass an
 * absolute "YYYY-MM-DD" key instead.
 *
 * Display code only: an unreadable value still gives today so a screen never breaks. Anything that
 * decides or stores a day must use resolveRollingPersianDateKey (or tryResolveRollingPersianDate).
 */
export function resolveRollingPersianDate(value, from = new Date()) {
  return tryResolveRollingPersianDate(value, from) || startOfDay(from);
}

/** The canonical "YYYY-MM-DD" for a day value, or "" when it is not a real day (empty input still means today). */
export function resolveRollingPersianDateKey(value, from = new Date()) {
  const date = tryResolveRollingPersianDate(value, from);
  return date ? formatPersianDateKey(date) : "";
}

/**
 * Human label for a booking's date, always computed fresh against "now":
 * "امروز" / "فردا" today/tomorrow, otherwise a full weekday + date so it
 * never reads as an ambiguous bare weekday name from some other week.
 */
export function formatRelativeBookingDayLabel(value, from = new Date()) {
  const date = resolveRollingPersianDate(value, from);
  if (isSamePersianDay(date, from)) return "امروز";
  const tomorrow = new Date(startOfDay(from));
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSamePersianDay(date, tomorrow)) return "فردا";
  const title = formatPersianDayTitle(date);
  return `${title.weekday} ${title.day} ${title.monthLabel}`;
}

export function isSamePersianDay(a, b) {
  const left = getPersianDateParts(a);
  const right = getPersianDateParts(b);
  return left.year === right.year && left.month === right.month && left.day === right.day;
}

export function isWithinRollingWeek(date, from = new Date(), length = 7) {
  const start = startOfDay(from).getTime();
  const end = start + length * 24 * 60 * 60 * 1000;
  const value = startOfDay(date).getTime();
  return value >= start && value < end;
}

export function formatPersianDayTitle(date) {
  const parts = getPersianDateParts(date);
  const monthLabel = getPersianMonthLabel(parts.year, parts.month);
  return {
    weekday: getPersianWeekday(date),
    day: toPersianDigits(parts.day),
    monthLabel,
    year: toPersianDigits(parts.year),
    full: `${getPersianWeekday(date)} ${toPersianDigits(parts.day)} ${monthLabel}`
  };
}
