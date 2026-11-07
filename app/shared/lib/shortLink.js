import { toAsciiDigits } from "./digits.js";

/**
 * Short addresses for a public page: frfro.ir/a/4447 for an artist, frfro.ir/s/4447 for a salon. Instagram sends every
 * tapped link through its own address, which is filtered in Iran, so a customer has to carry the address to Chrome by
 * copying or typing it; a short one survives both (owner, 2026-11-07). A Persian keyboard types Persian digits, so those
 * are read as well. Anything that is not a page number goes to the home page.
 */
const PUBLIC_PAGES = { artist: "/artists", salon: "/salons" };
const SHORT_PREFIXES = { artist: "/a", salon: "/s" };

export function shortPublicPath(profileType, id) {
  return `${SHORT_PREFIXES[profileType]}/${Number(id)}`;
}

export function publicPathFromShort(profileType, rawId) {
  let text = String(rawId ?? "");
  try {
    text = decodeURIComponent(text);
  } catch {
    return "/";
  }
  const digits = toAsciiDigits(text).trim();
  if (!/^[0-9]{1,15}$/.test(digits) || Number(digits) <= 0) return "/";
  return `${PUBLIC_PAGES[profileType]}/${Number(digits)}`;
}

/** The ready message for Instagram direct: a customer can copy it there and open it outside Instagram. */
export function directMessageText(shownAddress) {
  return `سلام، برای نوبت گرفتن این لینک رو نگه دار، کپی کن و توی کروم یا سافاری بزن: ${shownAddress}`;
}
