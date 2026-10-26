import { releasePlacedBookings, forgetArtistPlace } from "./db/repos/artistPlace.js";
import { noticeClientPlaceMoved } from "./providerNotices.js";

/**
 * An artist is no longer on a salon's team: their choice for it is forgotten and the clients booked at the salon are told
 * the booking is now held at the artist's own place. Nothing is cancelled. Best effort after the leave itself succeeded.
 */
export async function artistLeftSalon({ artistUserId, salonUserId, salonName = "" }) {
  try {
    await forgetArtistPlace(artistUserId, salonUserId);
    const moved = await releasePlacedBookings(salonUserId, artistUserId);
    for (const row of moved) {
      noticeClientPlaceMoved(row.client_user_id, { artistName: row.artist_name, salonName, booking: row });
    }
    return moved.length;
  } catch {
    return 0;
  }
}

/** A salon is leaving frfro: its direct bookings move back to each artist's own place, with notice. */
export async function salonGone({ salonUserId, salonName = "" }) {
  try {
    const moved = await releasePlacedBookings(salonUserId, null);
    for (const row of moved) {
      noticeClientPlaceMoved(row.client_user_id, { artistName: row.artist_name, salonName, salonGone: true, booking: row });
    }
    return moved.length;
  } catch {
    return 0;
  }
}
