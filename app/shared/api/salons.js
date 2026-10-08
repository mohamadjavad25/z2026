import { apiFetch, apiJson } from "./client";

/** GET /api/salons → { salons, data?: { salons } } (public directory; no /api/salons/:id) */
export async function getSalons() {
  return apiJson("/api/salons");
}

/**
 * GET /api/salon-bookings
 * - ?salonUserId= → { unavailableSlots } (viewer ≠ owner) or { bookings } (owner self)
 * - client session → { bookings } (own reservations)
 * - salon session → { bookings } (owner dashboard)
 */
export async function getSalonBookings(salonUserId) {
  const query = salonUserId != null && salonUserId !== ""
    ? `?salonUserId=${encodeURIComponent(salonUserId)}`
    : "";
  return apiJson(`/api/salon-bookings${query}`);
}

/**
 * POST /api/salon-bookings → 201
 * { booking, bookings, artistBooking?, linkedArtistId? }
 * When staff resolves to artist_user_id, also inserts artist_bookings (or rolls back on failure).
 */
export async function createSalonBooking(body) {
  return apiFetch("/api/salon-bookings", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/** PATCH /api/salon-bookings → owner update/cancel; syncs linked artist_bookings atomically
 *  Body fields: client, phone, service, staff, booking_date/time, duration_*, status | action:"cancel"
 *  → { booking, bookings, linkedArtistId?, linkedArtistIds? }
 */
export async function updateSalonBooking(body) {
  return apiFetch("/api/salon-bookings", {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

/** POST /api/salon-follow → follow toggle */
export async function toggleSalonFollow(body) {
  return apiFetch("/api/salon-follow", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/** GET /api/salon-hours → { hours } owner-only */
export async function getSalonHours() {
  return apiJson("/api/salon-hours");
}

/** PATCH /api/salon-hours → { hour } singular (not full list) */
export async function updateSalonHours(body) {
  return apiFetch("/api/salon-hours", {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

/** GET /api/salon-services → { services } owner-only */
export async function getSalonServices() {
  return apiJson("/api/salon-services");
}

/** POST /api/salon-services → { service } 201 */
export async function createSalonService(body) {
  return apiFetch("/api/salon-services", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/** PATCH /api/salon-services → { service } */
export async function updateSalonService(body) {
  return apiFetch("/api/salon-services", {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

/** DELETE /api/salon-services → { ok } body: { id } */
export async function deleteSalonService(id) {
  return apiFetch("/api/salon-services", {
    method: "DELETE",
    body: JSON.stringify({ id })
  });
}

/** GET /api/salon-portfolio → { portfolio } owner-only */
export async function getSalonPortfolio() {
  return apiJson("/api/salon-portfolio");
}

/** POST /api/salon-portfolio → { item } 201 */
export async function createSalonPortfolio(body) {
  return apiFetch("/api/salon-portfolio", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/** PATCH /api/salon-portfolio → { item } */
export async function updateSalonPortfolio(body) {
  return apiFetch("/api/salon-portfolio", {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

/** DELETE /api/salon-portfolio → { ok } body: { id } */
export async function deleteSalonPortfolio(id) {
  return apiFetch("/api/salon-portfolio", {
    method: "DELETE",
    body: JSON.stringify({ id })
  });
}

/** GET /api/salon-staff → { staff } owner-only */
export async function getSalonStaff() {
  return apiJson("/api/salon-staff");
}

/** GET /api/salon-staff/calendars → { calendars } owner-only: linked artists' break + busy times */
export async function getSalonStaffCalendars() {
  return apiJson("/api/salon-staff/calendars");
}

/** PATCH /api/salon-staff → { person, staff } */
export async function updateSalonStaff(body) {
  return apiFetch("/api/salon-staff", {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

/**
 * DELETE /api/salon-staff → { ok, staff, endedCollabs, artistNotified, artistUserId }
 * May end linked artist collabs.
 */
export async function deleteSalonStaff(id) {
  return apiFetch("/api/salon-staff", {
    method: "DELETE",
    body: JSON.stringify({ id })
  });
}

/** GET /api/salon-collabs → { collabs } owner inbox (artist→salon) */
export async function getSalonCollabs() {
  return apiJson("/api/salon-collabs");
}

/** PATCH /api/salon-collabs → { collab, staff? } approve/reject */
export async function updateSalonCollabs(body) {
  return apiFetch("/api/salon-collabs", {
    method: "PATCH",
    body: JSON.stringify(body)
  });
}

/** GET /api/salon-invites → { invites } salon-sent invites */
export async function getSalonInvites(status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiJson(`/api/salon-invites${query}`);
}

/** POST /api/salon-invites → { invite, invites, created? } 201 */
export async function createSalonInvite(body) {
  return apiFetch("/api/salon-invites", {
    method: "POST",
    body: JSON.stringify(body)
  });
}

/** DELETE /api/salon-invites → { invite, invites } body: { id } */
export async function deleteSalonInvite(id) {
  return apiFetch("/api/salon-invites", {
    method: "DELETE",
    body: JSON.stringify({ id })
  });
}

/** GET /api/salon-rules → { data: { rules } } (salon owner) */
export async function getSalonRules() {
  return apiJson("/api/salon-rules");
}

/** PUT /api/salon-rules { rules } → { data: { rules } } (saved, trimmed text) */
export async function saveSalonRules(rules) {
  return apiJson("/api/salon-rules", {
    method: "PUT",
    body: JSON.stringify({ rules })
  });
}
