/**
 * A salon's or artist's Instagram page, kept as the page name only (lower case, no "@"). People paste it in every
 * shape: "@salon.roz", "salon.roz", "instagram.com/salon.roz", "https://www.instagram.com/salon.roz/?igsh=…".
 * Instagram names are 1–30 of a–z, 0–9, "." and "_", never starting or ending with "." and never "..".
 * Used by the settings card (to show the cleaned name) and by POST /api/profile (to store it).
 */
const NAME = /^(?!\.)(?!.*\.\.)(?!.*\.$)[a-z0-9._]{1,30}$/;
// Instagram paths that are not a page: a pasted post or reel link must not save "p" or "reel" as the page.
const NOT_A_PAGE = new Set(["p", "reel", "reels", "tv", "explore", "accounts", "direct", "about", "legal", "web", "developer"]);

export const INSTAGRAM_INVALID_MESSAGE = "این اسم پیج نیست. فقط حرف انگلیسی، عدد، نقطه و خط زیر بنویس.";

/** The page name, "" for empty input, or null when it cannot be an Instagram name. */
export function normalizeInstagram(input) {
  let text = String(input ?? "").trim();
  if (!text) return "";
  // Persian and Arabic digits from a Persian keyboard count as the same digits.
  text = text.replace(/[\u06F0-\u06F9\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) & 0xf));
  const link = text.match(/^(?:https?:\/\/)?(?:www\.|m\.)?(?:instagram\.com|instagr\.am)\/+([^/?#\s]+)(?:\/+([^/?#\s]+))?/i);
  if (link) {
    // A story link (instagram.com/stories/<page>/…) names the page second.
    text = link[1].toLowerCase() === "stories" && link[2] ? link[2] : link[1];
    if (NOT_A_PAGE.has(text.toLowerCase())) return null;
  }
  text = text.replace(/^@+/, "").replace(/\/+$/, "").toLowerCase();
  return NAME.test(text) ? text : null;
}

export function instagramUrl(name) {
  return name ? `https://instagram.com/${name}` : "";
}
