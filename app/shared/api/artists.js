import { apiFetch, apiJson } from "./client";

// 100 pages of 100: a directory past 10,000 needs a real "load more" screen, which this app does not have yet.
const DIRECTORY_MAX_PAGES = 100;

/** GET /api/artists → { data: { artists } } (public directory). Follows nextCursor, see getSalons() in ./salons.js. */
export async function getArtists() {
  let result = await apiJson("/api/artists");
  const all = [];
  for (let page = 0; page < DIRECTORY_MAX_PAGES; page += 1) {
    if (!result.ok) return page === 0 ? result : { ...result, ok: true, data: { artists: all } };
    all.push(...(result.data?.artists || []));
    const next = result.data?.nextCursor;
    if (!next) return { ...result, data: { ...result.data, artists: all, nextCursor: null } };
    result = await apiJson(`/api/artists?cursor=${encodeURIComponent(next)}`);
  }
  return { ...result, ok: true, data: { artists: all, nextCursor: null } };
}

/** GET /api/artists/:id → { data: { artist } } (public profile; viewer session optional) */
export async function getArtist(id) {
  return apiJson(`/api/artists/${id}`);
}

/**
 * GET /api/artist/me → owner workspace
 * { data: { services, bookings, collabs, invites, pendingInviteCount, breakTime, followers } }
 * Note: GET also runs syncSalonBookingsForArtist on the server.
 */
export async function getArtistMe() {
  return apiJson("/api/artist/me");
}

/**
 * POST /api/artist/me — owner multiplex:
 * - default body → create service → { data: { service } } 201
 * - { kind: "booking", … } → { data: { booking, bookings } } 201|409
 * - { kind: "break", startTime, endTime | clear } → { data: { breakTime } }
 * - { kind: "collab", … } → { data: { collab } } 201
 */
export async function createArtistMe(body) {
  return apiFetch("/api/artist/me", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/** PATCH /api/artist/me → update service { data: { service } } */
export async function updateArtistMe(body) {
  return apiFetch("/api/artist/me", {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

/**
 * PATCH /api/artist/me { kind: "booking", id, status: "تایید شده" | "لغو" (or action: "cancel") }
 * → owner confirm/decline of a REAL pending (status "تازه") artist_bookings
 * row — { data: { booking, bookings } }. Same route as updateArtistMe above
 * (services), dispatched by `kind`, mirroring the POST multiplex.
 */
export async function updateArtistBooking(body) {
  return apiFetch("/api/artist/me", {
    method: "PATCH",
    body: JSON.stringify({ kind: "booking", ...body })
  });
}

/**
 * DELETE /api/artist/me
 * - { id } → delete service
 * - { kind: "collab", id } → delete collab
 */
export async function deleteArtistMe(body) {
  return apiFetch("/api/artist/me", {
    method: "DELETE",
    body: JSON.stringify(body)
  });
}

/**
 * POST /api/artist/bookings → public/client booking
 * → 201 { data: { booking, bookedSlots } } or 409 SLOT_TAKEN
 * Same DB as owner bookings; does NOT return full owner bookings list.
 */
export async function createArtistBooking(body) {
  return apiFetch("/api/artist/bookings", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/**
 * GET /api/artist-bookings/fallbacks → { artists: [{ id, name, area, avatar }] }
 * Artists the client follows that do this service and are free at that day and time: the backup
 * choices for a direct request that gets only an hour.
 */
export async function getArtistFallbacks(artistUserId, service, day, time) {
  const query = new URLSearchParams({ artistUserId: String(artistUserId), service: String(service || ""), day: String(day || ""), time: String(time || "") });
  return apiJson(`/api/artist-bookings/fallbacks?${query}`);
}

/** PATCH /api/artist/invites → respond { id, status } → { data: { invite, invites, … } } */
export async function respondArtistInvite(body) {
  return apiFetch("/api/artist/invites", {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

/** GET /api/artist/teams → { data: { teams } } the salons this artist belongs to */
export async function getArtistTeams() {
  return apiJson("/api/artist/teams");
}

/** DELETE /api/artist/teams { salonUserId } → leave that team → { data: { teams } } */
export async function leaveArtistTeam(body) {
  return apiFetch("/api/artist/teams", {
    method: "DELETE",
    body: JSON.stringify(body)
  });
}

/** POST /api/follows → { data: { following, followerCount, … } } body: { targetUserId } */
export async function toggleFollow(body) {
  return apiFetch("/api/follows", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/**
 * GET /api/artist-bookings → client session only → { bookings }
 * A client's own bookings made directly with an independent artist
 * (as opposed to GET /api/salon-bookings' client branch, which is
 * salon bookings only). Merged into clientBookingList client-side.
 */
export async function getClientArtistBookings() {
  return apiJson("/api/artist-bookings");
}

/** GET /api/client-bookings → { data: { salonBookings, artistBookings } } client session only (one request instead of two) */
export async function getClientBookings() {
  return apiJson("/api/client-bookings");
}

/** GET /api/artist-hours → { hours } owner-only */
export async function getArtistHours() {
  return apiJson("/api/artist-hours");
}

/** PATCH /api/artist-hours with the whole week → { hours } (all days saved, or none) */
export async function saveArtistHoursWeek(hours) {
  return apiFetch("/api/artist-hours", {
    method: "PATCH",
    body: JSON.stringify({ hours })
  });
}

/** GET /api/artist/place → { data: { workplace: { current, savedCurrent, next, teams } } }: where the artist's own clients go. */
export async function getArtistPlace() {
  return apiJson("/api/artist/place");
}

/** GET /api/artist/place/preview → { data: { moving, staying } }: the bookings a switch to `salonId` (null = own place) from `startsOn` would move. */
export async function previewArtistPlace(salonId, startsOn) {
  const query = new URLSearchParams({ startsOn });
  if (salonId) query.set("salonId", String(salonId));
  return apiJson(`/api/artist/place/preview?${query}`);
}

/** PUT /api/artist/place { salonId: number | null, startsOn, moveBookings } → { data: { workplace, moved, kept } } */
export async function saveArtistPlace(body) {
  return apiFetch("/api/artist/place", { method: "PUT", body: JSON.stringify(body) });
}

/** PUT /api/artist-bookings/:id/place { salonUserId: number | null } → the artist says where one booking is held. */
export async function moveArtistBookingPlace(id, salonUserId) {
  return apiFetch(`/api/artist-bookings/${id}/place`, { method: "PUT", body: JSON.stringify({ salonUserId }) });
}
