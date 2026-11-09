import { AWAITING_CLIENT } from "./bookingOffer.js";

/**
 * What a booking's stored status MEANS, in one place (audit of 2026-11-09). The two tables use different words:
 *  - salon_bookings: «تازه» is the salon's own entry, already settled; «درخواست» is a client waiting for an answer.
 *  - artist_bookings: «تایید» is the artist's own entry, already settled; «تازه» is a client waiting for an answer.
 * So «تازه» means opposite things, and asking "is it confirmed?" without saying which table gives wrong answers. Every
 * list of statuses comes from here (tests/unit/bookingStates.test.js fails on a copy of one elsewhere).
 */
export const SALON_CONFIRMED = Object.freeze(["تایید شده", "تازه"]);
export const ARTIST_CONFIRMED = Object.freeze(["تایید شده", "تایید"]);
export const SALON_LIVE = Object.freeze(["تازه", "درخواست", "تایید شده", AWAITING_CLIENT]);
export const ARTIST_LIVE = Object.freeze(["تازه", "درخواست", "تایید", "تایید شده", AWAITING_CLIENT]);

/** A booking that may still be cancelled, whichever table it is in (the admin panel's list holds both). */
export const ANY_LIVE = Object.freeze([...new Set([...SALON_LIVE, ...ARTIST_LIVE])]);

export const confirmedStatuses = (kind) => (kind === "artist" ? ARTIST_CONFIRMED : SALON_CONFIRMED);
export const isConfirmedBooking = (kind, status) => confirmedStatuses(kind).includes(status);

const sqlList = (statuses) => statuses.map((status) => `'${status}'`).join(", ");

/** For a query's text: these are constants of this file, never input. */
export const SQL_SALON_CONFIRMED = sqlList(SALON_CONFIRMED);
export const SQL_ARTIST_CONFIRMED = sqlList(ARTIST_CONFIRMED);
export const SQL_SALON_LIVE = sqlList(SALON_LIVE);
export const SQL_ARTIST_LIVE = sqlList(ARTIST_LIVE);
