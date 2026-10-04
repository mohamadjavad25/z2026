import { checkRateLimit } from "./rateLimit.js";
import { error } from "./http.js";
import { isImageDataUrlTooLarge, isImageDataUrlInvalidType } from "./mediaLimits.js";

/** Only artists and salons publish posts; clients have no gallery. */
export const POST_AUTHOR_TYPES = ["artist", "salon"];

/** Shared create/update validation. Returns an error Response, or null when fine. */
export function validatePostBody(body, { creating }) {
  if (creating && !String(body.title || "").trim()) return error("عنوان لازم است.", 400);
  if (creating && !String(body.image || "").startsWith("data:image/")) return error("تصویر نمونه‌کار لازم است.", 400);
  if (body.title !== undefined && !String(body.title).trim()) return error("عنوان نمی‌تواند خالی باشد.", 400);
  if (body.image && typeof body.image === "string" && body.image.startsWith("data:")) {
    if (isImageDataUrlTooLarge(body.image)) return error("حجم عکس بیش از حد مجاز (۵ مگابایت) است.", 413);
    if (isImageDataUrlInvalidType(body.image)) return error("فرمت عکس پشتیبانی نمی‌شود.", 400);
  }
  return null;
}

/** 60 post writes per 10 minutes per user -- generous for people, hostile to scripts. */
export async function limitPostWrites(userId) {
  const limited = await checkRateLimit(`post-write:${userId}`, 60, 10 * 60 * 1000);
  if (limited.ok) return null;
  return error("تعداد درخواست‌ها زیاد است؛ چند دقیقه بعد دوباره امتحان کن.", 429);
}
