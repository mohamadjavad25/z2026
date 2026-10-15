/**
 * What a QR code (or a pasted link) means to frfro's "connect" feature.
 * Shared by the browser (scanner, search box) and the server (search API,
 * owner scan API), so both sides read codes exactly the same way.
 *
 * Two kinds of code exist:
 *  - A salon / artist page link (`…/salons/12`, `…/artists/34`, or a salon's
 *    team link `…/join-salon/12`): the QR on a salon's counter or a profile.
 *    What scanning it does depends on who scans: a client connects, an artist
 *    joins the salon's team, a salon invites the artist to its team.
 *  - A client's personal code (`FRFRO-C1:<userId>:<secret>`): shown by the
 *    client ("اسکن شو") so a salon or artist can add them. The secret proves
 *    the client chose to show it; a bare user id would let anyone add anyone.
 */

export const CLIENT_CODE_PREFIX = "FRFRO-C1";

const PROFILE_PATH = /\/(salons|artists|join-salon)\/(\d+)(?:[/?#]|$)/;
const CLIENT_CODE = /^FRFRO-C1:(\d+):([A-Za-z0-9]{8,64})$/;

export function buildClientCode(userId, secret) {
  return `${CLIENT_CODE_PREFIX}:${Number(userId)}:${secret}`;
}

/**
 * `{ type: "salon" | "artist", id, joinCode }` for a public profile link, else null.
 * `joinCode` is the `?k=` secret when the link is a salon's dedicated join link
 * (app/join-salon/[id]) — "" for a plain profile link, which proves nothing
 * (see app/lib/db/repos/salons/invites.js for why that distinction matters).
 */
export function parseProfileLink(text) {
  const trimmed = String(text || "").trim();
  const match = trimmed.match(PROFILE_PATH);
  if (!match) return null;
  const id = Number(match[2]);
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  let joinCode = "";
  try {
    joinCode = new URL(trimmed, "https://frfro.ir").searchParams.get("k") || "";
  } catch {
    joinCode = "";
  }
  return { type: match[1] === "artists" ? "artist" : "salon", id, joinCode };
}

/** `{ userId, secret }` for a client's personal code, else null. */
export function parseClientCode(text) {
  const match = String(text || "").trim().match(CLIENT_CODE);
  if (!match) return null;
  const userId = Number(match[1]);
  if (!Number.isSafeInteger(userId) || userId <= 0) return null;
  return { userId, secret: match[2] };
}

/**
 * Classifies anything a scanner read:
 *   { kind: "profile", type, id } | { kind: "client", userId, secret } | { kind: "unknown" }
 */
export function readScannedCode(text) {
  const client = parseClientCode(text);
  if (client) return { kind: "client", ...client };
  const profile = parseProfileLink(text);
  if (profile) return { kind: "profile", ...profile };
  return { kind: "unknown" };
}
