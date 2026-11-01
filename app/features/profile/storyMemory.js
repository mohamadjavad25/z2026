import { formatPersianDateKey } from "../../shared/lib/persianCalendar";

/**
 * What the phone remembers about stories (storage failing in private mode only means it remembers less):
 * - the day a story was last shared or saved, so the home card rests for the rest of that day;
 * - how many times the link guide was shown after sharing (it stops after three, or on «دیگه نشونم نده»).
 */
const POSTED_KEY = "frfro-story-posted-day";
const GUIDE_KEY = "frfro-story-guide";
export const POSTED_EVENT = "frfro-story-posted";
export const GUIDE_TIMES = 3;

function read(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode: it just lasts until the page closes.
  }
}

export function postedToday() {
  return read(POSTED_KEY) === formatPersianDateKey(new Date());
}

export function markPosted() {
  write(POSTED_KEY, formatPersianDateKey(new Date()));
  try {
    window.dispatchEvent(new Event(POSTED_EVENT));
  } catch {
    // No window events: the card refreshes on its next visit.
  }
}

/** True while the link guide should still come up after a share. */
export function guideWanted() {
  const seen = Number(read(GUIDE_KEY) || 0);
  return !(seen >= GUIDE_TIMES);
}

export function guideShown() {
  write(GUIDE_KEY, String(Number(read(GUIDE_KEY) || 0) + 1));
}

export function guideOff() {
  write(GUIDE_KEY, String(GUIDE_TIMES));
}
