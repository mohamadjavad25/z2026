/**
 * A salon's or artist's Instagram page, kept as the page name only (lower case, no "@"). People paste it in every
 * shape: "@salon.roz", "salon.roz", "instagram.com/salon.roz", "https://www.instagram.com/salon.roz/?igsh=…".
 * Instagram names are 1–30 of a–z, 0–9, "." and "_", never starting or ending with "." and never "..".
 * Used by the settings card (to show the cleaned name) and by POST /api/profile (to store it).
 */
const NAME = /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{1,30}$/;

export const INSTAGRAM_INVALID_MESSAGE = "این اسم پیج نیست. فقط حرف انگلیسی، عدد، نقطه و خط زیر بنویس.";

/** The page name, "" for empty input, or null when it cannot be an Instagram name. */
export function normalizeInstagram(input) {
  let text = String(input ?? "").trim();
  if (!text) return "";
  const link = text.match(/^(?:https?:\/\/)?(?:www\.|m\.)?(?:instagram\.com|instagr\.am)\/+([^/?#\s]+)/i);
  if (link) text = link[1];
  text = text.replace(/^@+/, "").replace(/\/+$/, "").toLowerCase();
  return NAME.test(text) ? text : null;
}

export function instagramUrl(name) {
  return name ? `https://instagram.com/${name}` : "";
}
