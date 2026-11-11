/**
 * A salon's bookings. This file is only the door: code outside this folder imports from here (or from ../salons.js),
 * and each part lives in ./bookings/:
 *
 *   columns.js       booking columns made on first use
 *   cancellation.js  who cancelled, and the provider's counter
 *   day.js           what already holds a salon's day, and when two bookings clash
 *   draft.js         who does what in a visit (the one draft every screen and the booking itself share)
 *   plan.js          read-only answers before booking: free times, previews, artist pickers, move times
 *   mirrors.js       the artists' calendar copies of a salon booking
 *   unavailable.js   the short-lived list of taken slots a client's booking screen greys out
 *   lists.js         the salon's list and a client's list
 *   create.js        making a booking (the salon's entry, a client's request, a visit of several services)
 *   update.js        changing the salon's own row, with every rule a change must pass
 *   patch.js         a change together with the artists' calendar copies, in one transaction
 *   client.js        what a client may do to their own booking
 *   artistSync.js    a team artist's answer moving the salon's booking
 */
export { ensureBookingPartsColumns } from "./bookings/columns.js";
export { recordCancellation } from "./bookings/cancellation.js";
export {
  draftSingleBookingStaff,
  getSalonBookingRow,
  listBookingMoveTimes,
  listBookingStaffOptions,
  listFeasibleVisitTimes,
  previewVisit,
  suggestBookingStaff
} from "./bookings/plan.js";
export { invalidateUnavailable, listUnavailableSlots } from "./bookings/unavailable.js";
export { listClientSalonBookings, listSalonBookings } from "./bookings/lists.js";
export { addSalonBooking } from "./bookings/create.js";
export { updateSalonBooking } from "./bookings/update.js";
export { cancelSalonBooking, patchSalonBookingWithArtistSync } from "./bookings/patch.js";
export { answerSalonTimeOffer, cancelSalonBookingByClient } from "./bookings/client.js";
export { syncSalonBookingFromArtistMirror } from "./bookings/artistSync.js";
