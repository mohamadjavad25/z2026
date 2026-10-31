import { sendPushToUser } from "./push.js";
import { bookingWhen, smsClientCancelled } from "./bookingSms.js";
import { notifyStaff } from "./staffNotify.js";

/**
 * Tells the salon (and the team artists on that booking) or the artist that the client cancelled: a push, and the SMS
 * when the push did not reach the app. `result` is what cancelSalonBookingByClient / cancelArtistBookingByClient returned.
 * `accountDeleted`: the client cancelled it by deleting their account (owner's decision 2026-10-26), so the push says
 * «… رو لغو کرد و حسابش رو از فرفرو پاک کرد.»; the SMS template stays the usual one. Fire-and-forget.
 */
export function noticeProviderClientCancelled(kind, result, { accountDeleted = false } = {}) {
  const booking = result.booking || {};
  const providerUserId = kind === "salon" ? result.salonUserId : result.artistUserId;
  const client = (kind === "salon" ? booking.client : booking.client_name) || "مشتری";
  const when = bookingWhen(booking.booking_date, booking.time);
  const message = accountDeleted
    ? {
      title: "مشتری حسابش رو پاک کرد",
      body: `${client} نوبت ${booking.service ? `${booking.service}، ` : ""}${when} رو لغو کرد و حسابش رو از فرفرو پاک کرد.`
    }
    : { title: "مشتری نوبت رو لغو کرد", body: `${client}، ${booking.service || "نوبت"}، ${when}` };
  if (providerUserId) {
    const push = sendPushToUser(providerUserId, message).catch(() => null);
    smsClientCancelled(providerUserId, { client, bookingDate: booking.booking_date, time: booking.time }, push);
  }
  if (kind === "salon" && booking.id) notifyStaff({ salonBookingId: booking.id }, message);
}
