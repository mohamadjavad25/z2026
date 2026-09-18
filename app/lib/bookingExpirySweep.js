import { getDb } from "./db/connection.js";
import * as salons from "./db/repos/salons.js";
import * as artists from "./db/repos/artists.js";
import * as shops from "./db/repos/shops.js";
import * as messages from "./db/repos/messages.js";
import { publishChatEvent } from "./chatEvents.js";
import { enrichBookingCards, enrichOrderCards } from "./chatOrderCards.js";

/**
 * Auto-expiry sweep for booking REQUESTS a salon/artist never actively
 * responded to (Snapp-Food-style bounded response window — founder-approved
 * product decision: 1 hour, auto-cancel on timeout, notify the client).
 * Also covers unacknowledged shop orders under the identical policy (see
 * source 3 below). Covers three independent, non-overlapping sources:
 *
 * 1. `salon_bookings` rows with status "درخواست" (see
 *    confirmSalonClientBooking in useSalonDirectory.js) — the real
 *    confirm/reject action is approveReservationRequest/
 *    declineReservationRequest in useSalonWorkspace.js + PATCH
 *    /api/salon-bookings. When a salon booking has a linked staff member
 *    (staff -> salon_staff.artist_user_id), POST /api/salon-bookings mirrors
 *    it into artist_bookings with the SAME status, and PATCH
 *    /api/salon-bookings keeps that mirror in sync via
 *    salons.patchSalonBookingWithArtistSync. This sweep reuses that exact
 *    same atomic sync function to expire the salon row, so the mirrored
 *    artist_bookings row (if any) is expired in the same transaction — no
 *    separate artist_bookings query needed for the linked-staff case.
 *
 * 2. DIRECT `artist_bookings` rows (client booked an independent artist
 *    straight, not through a salon) with status "تازه" AND
 *    source_salon_user_id IS NULL — the real confirm/decline action is
 *    confirmArtistBookingRequest/declineArtistBookingRequest in
 *    useArtistWorkspace.js + PATCH /api/artist/me (kind: "booking"). The
 *    `source_salon_user_id IS NULL` filter is load-bearing: a salon-linked
 *    artist_bookings mirror row already gets expired via path (1) above
 *    (patchSalonBookingWithArtistSync operates on the SAME transaction as
 *    the salon row) — sweeping it a second time here would be a redundant
 *    second UPDATE + a duplicate "your booking expired" chat card for the
 *    same appointment.
 *
 * 3. `shop_orders` rows with status "جدید" (unacknowledged order — see
 *    createOrder in shops.js repo) — founder-approved product decision
 *    (2026-09-18): the 1-hour window isn't about giving the shop prep time,
 *    it's so the buyer knows their order was actually seen, so it gets the
 *    exact same policy as a booking request. The real "shop took action"
 *    path is updateOrderStatus (PATCH /api/shop/orders — moves it forward,
 *    or an explicit cancel); anything else within the window leaves it
 *    "جدید" and eligible here. Uses its own dedicated sweep-only transition
 *    (shops.expireStaleOrder), never updateOrderStatus, for the same reason
 *    paths (1)/(2) never call their real PATCH-backing functions with a
 *    status outside their public enum — see expireStaleOrder's docstring in
 *    shops.js for the full guard rationale (including why it restocks).
 */

/** Status written to an expired booking — distinct from "درخواست" (still pending),
 *  "تازه"/"تایید شده" (never timed out) and "لغو" (actively rejected/cancelled by
 *  the salon), so the client-facing UI can eventually tell "salon said no" apart
 *  from "nobody answered in time". Chosen deliberately NOT to collide with any
 *  existing status literal in this codebase (grepped across booking code paths).
 */
export const BOOKING_REQUEST_EXPIRED_STATUS = "منقضی شده";

/** Same literal as BOOKING_REQUEST_EXPIRED_STATUS, reused deliberately for
 *  orders too (not a shop-specific wording) — grepped every place a status
 *  string is compared across this codebase and confirmed booking code always
 *  queries salon_bookings/artist_bookings and order code always queries
 *  shop_orders, so the two never share a column or a comparison; reusing the
 *  identical "timed out" meaning is pure upside (one concept, one string,
 *  recognizable everywhere) with zero ambiguity risk. */
export const ORDER_REQUEST_EXPIRED_STATUS = BOOKING_REQUEST_EXPIRED_STATUS;

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

/** Every still-pending ("تازه") DIRECT artist_bookings row (source_salon_user_id
 *  IS NULL — see the module docstring for why that filter matters) whose
 *  created_at is older than the configured window, same DB-clock comparison
 *  as findExpiredSalonBookingRequests above. */
function findExpiredDirectArtistBookingRequests(db, minutes) {
  return db.prepare(`
    SELECT id, artist_user_id, client_user_id
    FROM artist_bookings
    WHERE status = 'تازه'
      AND source_salon_user_id IS NULL
      AND created_at <= datetime('now', ?)
  `).all(`-${minutes} minutes`);
}

/** Every still-unacknowledged ("جدید") shop_orders row whose created_at is
 *  older than the configured window, same DB-clock comparison as the two
 *  booking finders above — reuses the SAME `minutes` window (timeoutMinutes()),
 *  per the founder's explicit "the same 1 hour is fine" — no separate
 *  ZIBABAN_*_TIMEOUT_MINUTES knob for orders; one product policy, one env var. */
function findExpiredOrders(db, minutes) {
  return db.prepare(`
    SELECT id, shop_user_id, buyer_user_id
    FROM shop_orders
    WHERE status = 'جدید'
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

/** Same idea as notifyClientOfExpiry, for a direct artist_bookings row —
 *  reuses sendArtistBookingCardMessage, the exact same card mechanism
 *  POST /api/artist/bookings already uses for the initial booking-confirmation
 *  card, so the client sees a fresh, always-live-status card in the
 *  client<->artist chat. */
function notifyClientOfArtistBookingExpiry(booking) {
  const clientUserId = Number(booking.client_user_id || 0);
  const artistUserId = Number(booking.artist_user_id || 0);
  if (!clientUserId || !artistUserId || clientUserId === artistUserId) return;
  const conversation = messages.getOrCreateDirectConversation(clientUserId, artistUserId);
  if (!conversation) return;
  const sendResult = messages.sendArtistBookingCardMessage(conversation.id, artistUserId, booking.id);
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
 * Same idea as notifyClientOfExpiry, for a shop_orders row — reuses
 * sendOrderCardMessage, the exact same card mechanism POST /api/shop/orders
 * already uses for the initial receipt card, so the buyer sees a fresh,
 * always-live-status card (getOrderById is re-read on every fetch, so it
 * already shows the new expired status with no extra plumbing) in the
 * buyer<->shop chat. Also publishes the same "order-status" live-push event
 * PATCH /api/shop/orders sends, so an order card the buyer already has open
 * on screen updates instantly too — not just the new card message.
 */
function notifyClientOfOrderExpiry(order) {
  const buyerUserId = Number(order.buyer_user_id || 0);
  const shopUserId = Number(order.shop_user_id || 0);
  if (!buyerUserId || !shopUserId || buyerUserId === shopUserId) return;
  const conversation = messages.getOrCreateDirectConversation(buyerUserId, shopUserId);
  if (!conversation) return;
  const sendResult = messages.sendOrderCardMessage(conversation.id, shopUserId, order.id);
  if (sendResult.ok) {
    enrichOrderCards([sendResult.message]);
    publishChatEvent({
      type: "message",
      conversationId: conversation.id,
      message: sendResult.message,
      recipients: sendResult.recipients
    });
  }
  publishChatEvent({
    type: "order-status",
    orderId: order.id,
    status: ORDER_REQUEST_EXPIRED_STATUS,
    recipients: [buyerUserId, shopUserId]
  });
}

/**
 * Runs one sweep pass synchronously. Exported (not just used by the
 * self-starting interval below) so isolated tests can call it directly
 * instead of waiting for a real interval tick.
 * @returns {{ expired: number, attempted: number, salonExpired: number, artistExpired: number, orderExpired: number }}
 */
export function sweepExpiredBookingRequestsOnce() {
  const db = getDb();
  const minutes = timeoutMinutes();

  const staleSalon = findExpiredSalonBookingRequests(db, minutes);
  let salonExpired = 0;
  for (const row of staleSalon) {
    // Reuse the exact same atomic salon+linked-artist status-sync path the
    // real PATCH /api/salon-bookings route uses (patchSalonBookingWithArtistSync) —
    // not a second, ad-hoc "just UPDATE the row" mechanism.
    const result = salons.patchSalonBookingWithArtistSync(row.id, row.salon_user_id, {
      status: BOOKING_REQUEST_EXPIRED_STATUS
    });
    if (result.ok) {
      salonExpired += 1;
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

  const staleDirectArtist = findExpiredDirectArtistBookingRequests(db, minutes);
  let artistExpired = 0;
  for (const row of staleDirectArtist) {
    // A plain single-row UPDATE (updateArtistBookingRow) is already atomic on
    // its own — unlike the salon case there's no linked mirror row to keep in
    // sync here (this query already excludes salon-linked rows), so no
    // withTransaction wrapper is needed.
    const updated = artists.updateArtistBookingRow(row.id, { status: BOOKING_REQUEST_EXPIRED_STATUS });
    if (updated) {
      artistExpired += 1;
      try {
        notifyClientOfArtistBookingExpiry(row);
      } catch {
        // Notification is best-effort; the booking is already correctly expired
        // even if the chat message failed to send (e.g. conversation race).
      }
    }
  }

  const staleOrders = findExpiredOrders(db, minutes);
  let orderExpired = 0;
  for (const row of staleOrders) {
    // Dedicated sweep-only transition (bypasses updateOrderStatus's public
    // enum guard) — see expireStaleOrder's docstring in shops.js.
    const updated = shops.expireStaleOrder(row.id, ORDER_REQUEST_EXPIRED_STATUS);
    if (updated) {
      orderExpired += 1;
      try {
        notifyClientOfOrderExpiry(row);
      } catch {
        // Notification is best-effort; the order is already correctly expired
        // (and restocked) even if the chat message failed to send.
      }
    }
    // If the transition failed (e.g. the shop genuinely acted on it in the
    // same instant — see expireStaleOrder's race guard), leave it as-is;
    // created_at doesn't change, so the next sweep pass simply won't find it
    // anymore (its status is no longer "جدید").
  }

  return {
    expired: salonExpired + artistExpired + orderExpired,
    attempted: staleSalon.length + staleDirectArtist.length + staleOrders.length,
    salonExpired,
    artistExpired,
    orderExpired
  };
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
