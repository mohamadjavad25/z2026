import { apiFetch, apiJson } from "./client";

// 100 pages of 100: a directory past 10,000 needs a real "load more" screen, which this app does not have yet.
const DIRECTORY_MAX_PAGES = 100;

/**
 * GET /api/salons → { salons, data?: { salons } } (public directory; no /api/salons/:id)
 * The server answers one page at a time; this follows nextCursor and returns every salon in one list (same shape as
 * before), so the screens that expect the whole directory keep working while each request stays small.
 */
export async function getSalons() {
  let result = await apiJson("/api/salons");
  const all = [];
  for (let page = 0; page < DIRECTORY_MAX_PAGES; page += 1) {
    if (!result.ok) return page === 0 ? result : { ...result, ok: true, data: { salons: all } };
    all.push(...(result.data?.salons || []));
    const next = result.data?.nextCursor;
    if (!next) return { ...result, data: { ...result.data, salons: all, nextCursor: null } };
    result = await apiJson(`/api/salons?cursor=${encodeURIComponent(next)}`);
  }
  return { ...result, ok: true, data: { salons: all, nextCursor: null } };
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
 * GET /api/salon-bookings/availability → { times, durationMinutes }
 * Start times on `day` at which these services (one, or several back to back in this order)
 * can be requested. `services`: names, or { name, minutes } (minutes count only for a service
 * the salon does not list).
 */
export async function getSalonVisitTimes(salonUserId, day, services, people = 1) {
  const query = new URLSearchParams({ salonUserId: String(salonUserId), day: String(day || "") });
  if (people > 1) query.set("people", String(people));
  for (const service of services) {
    query.append("service", typeof service === "string" ? service : service.name);
    if (service?.minutes) query.append("minutes", String(service.minutes));
  }
  return apiJson(`/api/salon-bookings/availability?${query}`);
}

/**
 * GET /api/salon-bookings/fallbacks → { salons: [{ id, name, area, avatar }] }
 * Salons the client follows that do every one of these services and are free at that day and time:
 * the backup choices for a request that gets only an hour. `services`: names or { name }.
 */
export async function getSalonFallbacks(salonUserId, day, time, services) {
  const query = new URLSearchParams({ salonUserId: String(salonUserId), day: String(day || ""), time: String(time || "") });
  for (const service of services) query.append("service", typeof service === "string" ? service : service.name);
  return apiJson(`/api/salon-bookings/fallbacks?${query}`);
}

/**
 * GET /api/salon-bookings/preview → { ok, code?, message?, partIndex?, durationMinutes, end, parts: [{ service, minutes, start, end, staff }] }
 * Who would do what, and when, if this visit were booked at `time` (the same checks the booking itself
 * runs). `services`: { name, minutes }, in order; `staff`: the salon's own pick per service, same order
 * ("" = the system's), used only for the salon's own session. For the salon each part also has `free`
 * and `options`. A plan the salon cannot take is `ok: false` with the reason, not an error.
 */
export async function getSalonVisitPreview(salonUserId, day, time, services, staff = [], people = 1) {
  const query = new URLSearchParams({ salonUserId: String(salonUserId), day: String(day || ""), time: String(time || "") });
  if (people > 1) query.set("people", String(people));
  for (const service of services) {
    query.append("service", typeof service === "string" ? service : service.name);
    if (service?.minutes) query.append("minutes", String(service.minutes));
  }
  if (staff.some(Boolean)) for (const name of staff) query.append("staff", name || "");
  return apiJson(`/api/salon-bookings/preview?${query}`);
}

/** GET /api/salon-bookings/:id/times → { times: [{ time, end, overtimeMinutes }], close } salon-only «تغییر ساعت» list */
export async function getSalonBookingMoveTimes(bookingId) {
  return apiJson(`/api/salon-bookings/${encodeURIComponent(bookingId)}/times`);
}

/**
 * GET /api/salon-bookings/:id/staff → { parts: [{ service, start, end, staff, options: [{ name, free, skilled, away }] }], suggested }
 * salon-only: who on the team is free for each service of the booking, and the automatic split.
 */
export async function getSalonBookingStaffOptions(bookingId) {
  return apiJson(`/api/salon-bookings/${encodeURIComponent(bookingId)}/staff`);
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

/** GET /api/salon-staff/self → { profile }: what the manager entered for their own team card (kept after leaving) */
export async function getSalonOwnerProfile() {
  return apiJson("/api/salon-staff/self");
}

/** POST /api/salon-staff/self { name?, role?, photo? } → { person, staff, profile }: the manager joins (or edits) their own team card */
export async function joinSalonTeamAsOwner(body) {
  return apiFetch("/api/salon-staff/self", {
    method: "POST",
    body: JSON.stringify(body)
  });
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
export async function deleteSalonStaff(id, { cancelAll = false } = {}) {
  return apiFetch("/api/salon-staff", {
    method: "DELETE",
    body: JSON.stringify({ id, ...(cancelAll ? { cancelAll: true } : {}) })
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

/** GET /api/salon-invites/join-code → { code } — the secret in the salon's own QR/join link */
export async function getSalonJoinCode() {
  return apiJson("/api/salon-invites/join-code");
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
