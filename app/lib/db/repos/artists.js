/**
 * An artist's data. This file is only the door: code outside this folder imports from here, and each part lives in
 * ./artists/:
 *
 *   hours.js         working hours of the week
 *   services.js      the artist's own services
 *   breaks.js        the daily break and «الان استراحت می‌کنم»
 *   collabs.js       asking to join a salon's team, and the salon's answers
 *   calendar.js      what already holds an artist's day ("is this artist free then")
 *   bookings.js      writing bookings: direct ones and the calendar copies of salon bookings
 *   bookingLists.js  the artist's list and a client's list
 *   directory.js     the public page, the list of artists, saved artists
 */
export { ensureArtistHours, listArtistHours, updateArtistHour, saveArtistHoursWeek } from "./artists/hours.js";
export { listArtistServices, addArtistService, updateArtistService, deleteArtistService } from "./artists/services.js";
export { getArtistBreak, setArtistBreak, clearArtistBreak, setArtistBreakNow } from "./artists/breaks.js";
export {
  JOIN_NOTE_MAX,
  JOIN_PROPOSAL_DAYS,
  acceptSalonCollab,
  addArtistCollab,
  counterSalonCollab,
  createJoinProposal,
  deleteArtistCollab,
  endSalonCollabsForArtist,
  expireJoinProposals,
  listArtistCollabs,
  listSalonCollabRequests,
  rejectSalonCollab,
  updateSalonCollabStatus
} from "./artists/collabs.js";
export { isArtistSlotBlocked, listArtistBookedSlots, listArtistBusyRanges } from "./artists/calendar.js";
export {
  addArtistBooking,
  addArtistBookingInTx,
  cancelArtistBookingByClient,
  cancelArtistBookingRow,
  findLinkedSalonArtistBooking,
  syncSalonBookingsForArtist,
  updateArtistBookingRow
} from "./artists/bookings.js";
export { getArtistBookingById, listArtistBookings, listClientArtistBookings } from "./artists/bookingLists.js";
export { getPublicArtist, listArtists, listSavedArtistsForUser } from "./artists/directory.js";
