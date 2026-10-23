import { checkRateLimit } from "./rateLimit.js";
import { error } from "./http.js";
import { isImageDataUrlTooLarge, isImageDataUrlInvalidType } from "./mediaLimits.js";

/** Only artists and salons publish posts; clients have no gallery. */
export const POST_AUTHOR_TYPES = ["artist", "salon"];

/** Shared create/update validation. Returns an error Response, or null when fine. */
export function validatePostBody(body, { creating }) {
  if (creating && !String(body.title || "").trim()) return error("یه عنوان بنویس.", 400);
  if (creating && !String(body.image || "").startsWith("data:image/")) return error("یه عکس از کارت بذار.", 400);
  if (body.title !== undefined && !String(body.title).trim()) return error("عنوان نمی‌تونه خالی باشه.", 400);
  if (body.image && typeof body.image === "string" && body.image.startsWith("data:")) {
    if (isImageDataUrlTooLarge(body.image)) return error("عکس بزرگ‌تر از ۵ مگابایته؛ یه عکس کوچیک‌تر بذار.", 413);
    if (isImageDataUrlInvalidType(body.image)) return error("این نوع عکس رو نمی‌شناسیم؛ JPG یا PNG بذار.", 400);
  }
  return null;
}

/** 60 post writes per 10 minutes per user -- generous for people, hostile to scripts. */
export async function limitPostWrites(userId) {
  const limited = await checkRateLimit(`post-write:${userId}`, 60, 10 * 60 * 1000);
  if (limited.ok) return null;
  return error("یه کم زیاد زدی؛ چند دقیقه دیگه دوباره بزن.", 429);
}
