import * as artists from "./db/repos/artists.js";
import * as users from "./db/repos/users.js";
import * as userSettings from "./db/repos/userSettings.js";
import { onlineBookingBlock } from "./billing/access.js";
import { isSlotInPast } from "../shared/lib/slots.js";
import { BOOKING_REQUEST_LEAD_MINUTES, isTooSoonToRequest } from "../shared/lib/bookingWindow.js";
import { toPersianDigits } from "../shared/lib/digits.js";
import { parseServiceDurationMinutes } from "../shared/lib/time.js";
import { readBookingSlot } from "./validation/bookingSlot.js";
import { MAX_BOOKING_MINUTES, parseRequestedMinutes } from "./validation/numbers.js";

const refuse = (status, error, code = "") => ({ ok: false, status, error, code });

/**
 * One new booking with an independent artist, with every check POST /api/artist/bookings makes: not
 * past, not too soon for a request, the artist takes online requests and direct bookings and isn't on
 * leave, the listed service's own length, and the artist's calendar free. Shared by that route and by
 * the expiry sweep, which sends an unanswered request on to the client's backup artist through
 * exactly the same door.
 *
 * `viewer` is the signed-in user or null; `data` the validated body (createBookingSchema), `body` the
 * raw one. `wait` is the client's response window ({ minutes: 60 | null, fallbackArtistUserId,
 * movedFromBookingId }). → { ok: true, booking } or { ok: false, status, error, code }.
 */
export async function createArtistBooking({ artistUserId, viewer, data, body = {}, wait = {} }) {
  // The same strict checks a salon booking gets: the artist exists, there is a service, the day is a real
  // one and the time a real clock time, the length a whole number of minutes. Nothing is guessed.
  const artist = await users.getUserById(artistUserId);
  if (!artist || artist.type !== "artist") return refuse(404, "آرتیست پیدا نشد.");
  const service = String(data.service || "").trim();
  if (!service) return refuse(400, "خدمت رزرو مشخص نیست.");
  const slot = readBookingSlot(data.bookingDate || data.booking_date || data.date || "", data.time ?? "");
  if (!slot.ok) return refuse(slot.status, slot.error);
  const requested = parseRequestedMinutes(data);
  if (!requested.ok) return refuse(400, `مدت نوبت نامعتبر است؛ عدد صحیح دقیقه، حداکثر ${MAX_BOOKING_MINUTES}.`);
  const day = slot.dateKey;
  const time = slot.time;
  if (isSlotInPast(day, time)) return refuse(409, "این ساعت گذشته است. ساعت دیگری انتخاب کن.");
  const artistSettings = await userSettings.getSettings(artistUserId);
  const isOwner = viewer?.id === artistUserId;
  // Anyone but the artist is sending a request the artist must answer: it can't start within the next few minutes.
  if (!isOwner && isTooSoonToRequest(day, time)) {
    return refuse(409, `برای رزرو باید حداقل ${toPersianDigits(BOOKING_REQUEST_LEAD_MINUTES)} دقیقه تا شروع نوبت مانده باشد تا آرتیست فرصت پاسخ داشته باشد. ساعت دیگری انتخاب کن.`);
  }
  // An artist whose subscription has closed (and no salon of theirs covers them) takes no new online requests.
  if (!isOwner) {
    const blocked = await onlineBookingBlock(artistUserId, "artist");
    if (blocked) return refuse(blocked.status, blocked.error, blocked.code);
  }
  if (!isOwner && (artistSettings.vacationMode || artistSettings.directBooking === false)) {
    return refuse(403, artistSettings.vacationMode
      ? "این آرتیست فعلاً در مرخصی است و نوبت جدید نمی‌پذیرد."
      : "این آرتیست فعلاً رزرو مستقیم را بسته است.");
  }
  // Someone booking the artist never chooses how long a listed service takes: that is the artist's own
  // number. (The artist's entry for their own customer may set it; either way it stays within a day.)
  let durationMinutes = requested.minutes || 0;
  if (!isOwner) {
    const listed = (await artists.listArtistServices(artistUserId))
      .find((item) => String(item.name || "").trim() === String(data.service || "").trim());
    if (listed?.duration) durationMinutes = parseServiceDurationMinutes(listed.duration);
  }
  durationMinutes = durationMinutes > 0 ? Math.min(720, Math.max(15, durationMinutes)) : undefined;
  // A client's request waits as long as they chose (an hour, or until the appointment), maybe with a backup artist.
  const isRequest = !isOwner && Boolean(viewer?.id);
  const result = await artists.addArtistBooking(artistUserId, {
    ...data,
    service,
    bookingDate: day,
    booking_date: undefined,
    date: undefined,
    time,
    waitMinutes: !isOwner && wait.minutes !== undefined ? wait.minutes : undefined,
    fallbackArtistUserId: isRequest ? wait.fallbackArtistUserId || null : null,
    movedFromBookingId: wait.movedFromBookingId || null,
    durationMinutes,
    duration_minutes: undefined,
    // `duration` (text) would be read when no number is given; the number above is the only length.
    duration: durationMinutes ? undefined : data.duration,
    // The artist's own entry is settled; a client's waits for the artist (see POST /api/artist/me).
    ...(isOwner ? { status: "تایید" } : {}),
    ...(isRequest && artistSettings.autoConfirm ? { status: "تایید شده" } : {}),
    clientUserId: viewer?.id || null,
    clientName: body.clientName || viewer?.name || "",
    clientPhone: body.clientPhone || viewer?.phone || ""
  });
  if (!result.ok) return refuse(result.code === "SLOT_TAKEN" ? 409 : 400, result.error, result.code);
  return { ok: true, booking: result.booking };
}
