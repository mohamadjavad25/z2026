import { getDb } from "./db/connection.js";
import * as salons from "./db/repos/salons.js";
import * as messages from "./db/repos/messages.js";
import { publishChatEvent } from "./chatEvents.js";
import { enrichBookingCards } from "./chatOrderCards.js";

/**
 * Auto-expiry sweep for salon booking REQUESTS the salon never actively
 * responded to (Snapp-Food-style bounded response window — founder-approved
 * product decision: 1 hour, auto-cancel on timeout, notify the client).
 *
 * Scope note (deliberately salon-only): a `salon_bookings` row created with
 * status "درخواست" (see confirmSalonClientBooking in useSalonDirectory.js)
 * is the ONLY real "pending, needs an owner decision" state in this app that
 * actually has a real confirm/reject action wired to it (see
 * approveReservationRequest/declineReservationRequest in
 * useSalonWorkspace.js + PATCH /api/salon-bookings). Direct client→artist
 * bookings (POST /api/artist/bookings) default to status "تازه" too, but
 * there is currently NO confirm/reject flow for those at all anywhere in
 * this codebase — an artist booking just sits at "تازه" forever by design
 * (or lack of one). Blanket-expiring every "تازه" artist_bookings row after
 * 1 hour would therefore auto-cancel real, otherwise-fine future
 * appointments that were never meant to be "accepted" in the first place.
 * That is a separate, real gap (flagged back to the founder/product — see
 * this session's report) and intentionally NOT handled by this sweep.
 *
 * What this DOES cover on the artist_bookings table: when a salon booking
 * has a linked staff member (staff -> salon_staff.artist_user_id), POST
 * /api/salon-bookings mirrors it into artist_bookings with the SAME status
 * ("درخواست"), and PATCH /api/salon-bookings keeps that mirror in sync via
 * salons.patchSalonBookingWithArtistSync. This sweep reuses that exact same
 * atomic sync function to expire the salon row, so the mirrored
 * artist_bookings row (if any) is expired in the same transaction — no
 * separate artist_bookings query needed for the linked-staff case.
 */

/** Status written to an expired booking — distinct from "درخواست" (still pending),
 *  "تازه"/"تایید شده" (never timed out) and "لغو" (actively rejected/cancelled by
 *  the salon), so the client-facing UI can eventually tell "salon said no" apart
 *  from "nobody answered in time". Chosen deliberately NOT to collide with any
 *  existing status literal in this codebase (grepped across booking code paths).
 */
export const BOOKING_REQUEST_EXPIRED_STATUS = "منقضی شده";

const DEFAULT_TIMEOUT_MINUTES = 60;
const DEFAULT_SWEEP_INTERVAL_MS = 3 * 60 * 1000; // every 3 minutes; timeout precision doesn't need to be tighter than this

/** Test-speedup hook, same idea as ZIBABAN_BOOKING_PATCH_SYNC_TEST elsewhere in this file's neighbors:
 *  lets an isolated test shrink the window to seconds instead of waiting a real hour. */
function timeoutMinutes() {
  const override = Number(process.env.ZIBABAN_BOOKING_REQUEST_TIMEOUT_MINUTES);
  return Number.isFinite(override) && override > 0 ? override : DEFAULT_TIMEOUT_MINUTES;
}

function sweepIntervalMs() {
  const override = Number(process.env.ZIBABAN_BOOKING_EXPIRY_SWEEP_MS);
  return Number.isFinite(override) && override > 0 ? override : DEFAULT_SWEEP_INTERVAL_MS;
}

/** Every still-pending ("درخواست") salon_bookings row whose created_at is older than the
 *  configured window, compared using the DB's own clock (datetime('now', ...)) — not JS
 *  Date.now() — so this is immune to any clock skew between the Node process and SQLite. */
function findExpiredSalonBookingRequests(db, minutes) {
  return db.prepare(`
    SELECT id, salon_user_id, client_user_id
    FROM salon_bookings
    WHERE status = 'درخواست'
      AND created_at <= datetime('now', ?)
  `).all(`-${minutes} minutes`);
}

/**
 * Drops a fresh "salon booking card" system message into the client<->salon
 * chat, reusing the exact same tamper-proof card mechanism
 * POST /api/salon-bookings already uses right after a booking is created
 * (see sendSalonBookingCardMessage there) — a real, persistent, visible
 * channel that reaches the client even if they aren't in the app right now
 * (they'll see the unread badge / card next time they open it), unlike a
 * client-side-only toast. The card always re-renders the booking's CURRENT
 * live status (enrichBookingCards), so it shows "منقضی شده" correctly.
 */
function notifyClientOfExpiry(booking) {
  const clientUserId = Number(booking.client_user_id || 0);
  const salonUserId = Number(booking.salon_user_id || 0);
  if (!clientUserId || !salonUserId || clientUserId === salonUserId) return;
  const conversation = messages.getOrCreateDirectConversation(clientUserId, salonUserId);
  if (!conversation) return;
  const sendResult = messages.sendSalonBookingCardMessage(conversation.id, salonUserId, booking.id);
  if (sendResult.ok) {
    enrichBookingCards([sendResult.message]);
    publishChatEvent({
      type: "message",
      conversationId: conversation.id,
      message: sendResult.message,
      recipients: sendResult.recipients
    });
  }
}

/**
 * Runs one sweep pass synchronously. Exported (not just used by the
 * self-starting interval below) so isolated tests can call it directly
 * instead of waiting for a real interval tick.
 * @returns {{ expired: number, attempted: number }}
 */
export function sweepExpiredBookingRequestsOnce() {
  const db = getDb();
  const minutes = timeoutMinutes();
  const stale = findExpiredSalonBookingRequests(db, minutes);
  let expired = 0;
  for (const row of stale) {
    // Reuse the exact same atomic salon+linked-artist status-sync path the
    // real PATCH /api/salon-bookings route uses (patchSalonBookingWithArtistSync) —
    // not a second, ad-hoc "just UPDATE the row" mechanism.
    const result = salons.patchSalonBookingWithArtistSync(row.id, row.salon_user_id, {
      status: BOOKING_REQUEST_EXPIRED_STATUS
    });
    if (result.ok) {
      expired += 1;
      try {
        notifyClientOfExpiry(row);
      } catch {
        // Notification is best-effort; the booking is already correctly expired
        // even if the chat message failed to send (e.g. conversation race).
      }
    }
    // If patch failed (e.g. a genuine slot conflict on the artist mirror),
    // leave the row as-is — created_at doesn't change, so the next sweep
    // pass retries it automatically.
  }
  return { expired, attempted: stale.length };
}

// Self-starting periodic sweep, following this codebase's existing precedent
// for in-process background behavior started once at module-import time
// (see app/lib/rateLimit.js's sweep) — guarded by a globalThis flag so
// Next.js dev-mode module reloads (Turbopack HMR) never double-start it.
// .unref() so this interval alone never keeps the Node process alive.
if (typeof setInterval === "function" && !globalThis.__zibabanBookingExpirySweepStarted) {
  globalThis.__zibabanBookingExpirySweepStarted = true;
  setInterval(() => {
    try {
      sweepExpiredBookingRequestsOnce();
    } catch {
      // Best-effort background sweep — a failed pass must not crash the
      // server; the next tick retries.
    }
  }, sweepIntervalMs()).unref?.();
}
