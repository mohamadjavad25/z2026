/**
 * The short code in frfro.ir/b/<code>, the link a client gets in the SMS for a booking entered by hand: it opens that
 * salon's or artist's own page. "a"/"s" then the account id in base 36. It reveals nothing the public page address
 * (/artists/12) does not.
 */
export function providerLinkCode(type, id) {
  return `${type === "artist" ? "a" : "s"}${Number(id).toString(36)}`;
}

/** The page a code opens, or null for anything that is not a well-formed code. */
export function providerLinkPath(code) {
  const match = /^([as])([0-9a-z]{1,8})$/.exec(String(code || ""));
  if (!match) return null;
  const id = parseInt(match[2], 36);
  return id > 0 ? `/${match[1] === "a" ? "artists" : "salons"}/${id}` : null;
}
