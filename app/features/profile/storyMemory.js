import { formatPersianDateKey } from "../../shared/lib/persianCalendar";
import { slotKey } from "./storySuggestion";

/**
 * What the phone remembers for the story card (owner's request 2026-10-31): the times already put on a story today,
 * so a time that is on it never comes back as news, and the bookings seen at the last look, so one that vanished
 * (cancelled elsewhere) is found. Storage failing (private mode) only means the card knows less; nothing breaks.
 */
const POSTED_KEY = "frfro-story-posted";
const SEEN_KEY = "frfro-story-seen";
export const POSTED_EVENT = "frfro-story-posted";

function read(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode: it just lasts until the page closes.
  }
}

/** "key|time" entries on stories made today or later (older days are dropped). */
export function readPosted() {
  const today = formatPersianDateKey(new Date());
  const list = read(POSTED_KEY);
  if (!Array.isArray(list)) return [];
  // Normalised, so "۱۱:۰۰", "11:00" and "11:0" are one time.
  return list
    .filter((entry) => typeof entry === "string" && entry.includes("|") && entry.split("|")[0] >= today)
    .map((entry) => { const [key, time] = entry.split("|"); return slotKey(key, time); });
}

/** Called when a free-times story is shared or saved, with every free time of that moment (see the sheet). */
export function markPosted(days) {
  const next = new Set(readPosted());
  for (const day of days || []) for (const time of day.times || []) next.add(slotKey(day.key, time));
  write(POSTED_KEY, [...next]);
  try {
    window.dispatchEvent(new Event(POSTED_EVENT));
  } catch {
    // No window events: the card refreshes on its next visit.
  }
}

/** The upcoming bookings as seen last time: [{ id, key, time, staff }] for this owner. */
export function readSeen(ownerKey) {
  const all = read(SEEN_KEY);
  const list = all && typeof all === "object" ? all[ownerKey] : null;
  return Array.isArray(list) ? list : null;
}

export function writeSeen(ownerKey, list) {
  const all = read(SEEN_KEY);
  write(SEEN_KEY, { ...(all && typeof all === "object" ? all : {}), [ownerKey]: list });
}
