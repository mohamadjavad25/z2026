import { randomBytes, timingSafeEqual } from "node:crypto";
import { getDb, all, get, run } from "../connection.js";
import { toLatinDigits } from "../../../shared/lib/digits.js";
import { parseProfileLink } from "../../../shared/lib/connectCodes.js";

/**
 * A client's "salons and artists" — the people they book with.
 *
 * A connection is a row in the existing `follows` table (client -> salon or
 * artist). Reusing it means a profile page's follow button, follower counts
 * and this list always agree, and no new table or migration is needed.
 */

const SEARCH_LIMIT = 10;

// Shared SELECT for a salon/artist card: the salon's own name/area win over the
// owner account's, so a salon shows as "سالن روژان", not its manager's name.
const PROFILE_COLUMNS = `
  u.id,
  u.type,
  COALESCE(NULLIF(s.name, ''), u.name) AS name,
  COALESCE(NULLIF(s.area, ''), u.area) AS area,
  COALESCE(NULLIF(s.tag, ''), u.service) AS specialty,
  (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS has_avatar,
  u.avatar_position
`;
const PROFILE_FROM = `
  FROM users u
  LEFT JOIN salons s ON s.user_id = u.id AND u.type = 'salon'
`;
const IS_ACTIVE_PROFILE = `u.type IN ('salon', 'artist') AND u.suspended_at IS NULL`;

// Persian/Arabic digits -> ASCII, then digits only, inside SQL (salon phones are free text).
const DIGITS_ONLY_SQL = (column) => `regexp_replace(translate(${column}, '۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789'), '[^0-9]', '', 'g')`;
// Arabic yeh/kaf -> Persian on both sides, so «علي» finds «علی».
const PERSIAN_LETTERS_SQL = (expr) => `translate(${expr}, 'يك', 'یک')`;
const toPersianLetters = (text) => text.replace(/ي/g, "ی").replace(/ك/g, "ک");
const escapeLike = (text) => text.replace(/[\\%_]/g, (char) => `\\${char}`);

/** Iranian phone in canonical 0-prefixed form ("09161234567", "06133334444"), or "" if it is not a phone. */
export function canonicalPhone(text) {
  const raw = toLatinDigits(text).replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660)).trim();
  if (!/^\+?[\d\s\-()]{7,}$/.test(raw)) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0098")) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("98") && digits.length === 12) digits = `0${digits.slice(2)}`;
  else if (digits.startsWith("9") && digits.length === 10) digits = `0${digits}`;
  return /^0\d{9,10}$/.test(digits) ? digits : "";
}

function toCard(row, hoursByUser, connectedIds = null) {
  return {
    id: row.id,
    type: row.type,
    name: row.name || "",
    area: row.area || "",
    specialty: row.specialty || "",
    avatar: row.has_avatar ? `/api/media/avatar/${row.id}` : "",
    avatarPosition: row.avatar_position || "",
    hours: hoursByUser.get(row.id) || [],
    ...(connectedIds ? { connected: connectedIds.has(row.id) } : {})
  };
}

async function loadHours(db, rows) {
  const salonIds = rows.filter((row) => row.type === "salon").map((row) => row.id);
  const artistIds = rows.filter((row) => row.type === "artist").map((row) => row.id);
  const [salonHours, artistHours] = await Promise.all([
    salonIds.length
      ? all(db, "SELECT salon_user_id AS owner_id, day, open_time, close_time, active FROM salon_hours WHERE salon_user_id = ANY($1)", [salonIds])
      : [],
    artistIds.length
      ? all(db, "SELECT artist_user_id AS owner_id, day, open_time, close_time, active FROM artist_hours WHERE artist_user_id = ANY($1)", [artistIds])
      : []
  ]);
  const byUser = new Map();
  for (const row of [...salonHours, ...artistHours]) {
    const list = byUser.get(row.owner_id) || [];
    list.push({ day: row.day, open_time: row.open_time, close_time: row.close_time, active: Boolean(Number(row.active)) });
    byUser.set(row.owner_id, list);
  }
  return byUser;
}

async function toCards(db, rows, connectedIds = null) {
  const hours = await loadHours(db, rows);
  return rows.map((row) => toCard(row, hours, connectedIds));
}

/** The client's connected salons and artists, newest first. */
export async function listConnections(clientUserId) {
  const db = await getDb();
  const rows = await all(db, `
    SELECT ${PROFILE_COLUMNS}
    FROM follows f
    JOIN users u ON u.id = f.target_user_id
    LEFT JOIN salons s ON s.user_id = u.id AND u.type = 'salon'
    WHERE f.follower_user_id = $1 AND ${IS_ACTIVE_PROFILE}
    ORDER BY f.created_at DESC
  `, [clientUserId]);
  return toCards(db, rows);
}

/**
 * Finds salons/artists by whatever the client typed: a public page link, a
 * phone number, or part of a name.
 *
 * A link or an exact phone means the client already knows this business, so
 * it is found even when the profile is hidden from public listings. A name
 * search only returns public profiles.
 */
export async function searchProfiles(query, clientUserId) {
  const text = String(query || "").trim().slice(0, 120);
  if (!text) return { by: "none", results: [] };
  const db = await getDb();

  let by;
  let rows;
  const link = parseProfileLink(text);
  const phone = link ? "" : canonicalPhone(text);
  if (link) {
    by = "link";
    rows = await all(db, `
      SELECT ${PROFILE_COLUMNS} ${PROFILE_FROM}
      WHERE u.id = $1 AND u.type = $2 AND u.suspended_at IS NULL
    `, [link.id, link.type]);
  } else if (phone) {
    by = "phone";
    rows = await all(db, `
      SELECT ${PROFILE_COLUMNS} ${PROFILE_FROM}
      WHERE ${IS_ACTIVE_PROFILE}
        AND (u.phone = $1 OR (s.phone <> '' AND ${DIGITS_ONLY_SQL("s.phone")} = $1))
      ORDER BY u.id
      LIMIT ${SEARCH_LIMIT}
    `, [phone]);
  } else {
    by = "name";
    if (text.length < 2) return { by, results: [] };
    const needle = escapeLike(toPersianLetters(text));
    const nameSql = PERSIAN_LETTERS_SQL("COALESCE(NULLIF(s.name, ''), u.name)");
    rows = await all(db, `
      SELECT ${PROFILE_COLUMNS} ${PROFILE_FROM}
      LEFT JOIN user_settings us ON us.user_id = u.id
      WHERE ${IS_ACTIVE_PROFILE}
        AND COALESCE((us.settings ->> 'publicPortfolio')::boolean, TRUE)
        AND ${nameSql} ILIKE $1
      ORDER BY (${nameSql} ILIKE $2) DESC, u.id DESC
      LIMIT ${SEARCH_LIMIT}
    `, [`%${needle}%`, `${needle}%`]);
  }

  const connectedRows = rows.length
    ? await all(db, "SELECT target_user_id FROM follows WHERE follower_user_id = $1 AND target_user_id = ANY($2)", [clientUserId, rows.map((row) => row.id)])
    : [];
  const connectedIds = new Set(connectedRows.map((row) => row.target_user_id));
  return { by, results: await toCards(db, rows, connectedIds) };
}

async function syncSalonFollowerCount(db, targetUserId) {
  // Salons keep a denormalized follower_count; artists' counts are computed on read.
  await run(db, `
    UPDATE salons SET follower_count = (SELECT COUNT(*) FROM follows WHERE target_user_id = $1)
    WHERE user_id = $1
  `, [targetUserId]);
}

async function getActiveProfile(db, userId) {
  const row = await get(db, `SELECT ${PROFILE_COLUMNS} ${PROFILE_FROM} WHERE u.id = $1 AND ${IS_ACTIVE_PROFILE}`, [userId]);
  return row || null;
}

/**
 * Connects a client to a salon/artist (idempotent).
 * @returns {Promise<{ ok: true, profile: object, alreadyConnected: boolean } | { ok: false, error: "not_found" | "self" }>}
 */
export async function connect(clientUserId, targetUserId) {
  if (clientUserId === targetUserId) return { ok: false, error: "self" };
  const db = await getDb();
  const target = await getActiveProfile(db, targetUserId);
  if (!target) return { ok: false, error: "not_found" };
  const inserted = await get(db, `
    INSERT INTO follows (follower_user_id, target_user_id) VALUES ($1, $2)
    ON CONFLICT (follower_user_id, target_user_id) DO NOTHING
    RETURNING target_user_id
  `, [clientUserId, targetUserId]);
  if (inserted) await syncSalonFollowerCount(db, targetUserId);
  const [profile] = await toCards(db, [target]);
  return { ok: true, profile, alreadyConnected: !inserted };
}

/** Removes a salon/artist from the client's list. */
export async function disconnect(clientUserId, targetUserId) {
  const db = await getDb();
  const removed = await get(db, `
    DELETE FROM follows WHERE follower_user_id = $1 AND target_user_id = $2
    RETURNING target_user_id
  `, [clientUserId, targetUserId]);
  if (removed) await syncSalonFollowerCount(db, targetUserId);
  return { removed: Boolean(removed) };
}

// ---- What a scanned profile code means to the person who scanned it ----

const INVITE_PENDING = "در انتظار تایید"; // salon_artist_invites.status, see repos/salons/invites.js

/**
 * The salon/artist behind a scanned link, plus how the viewer relates to it, so
 * the scanner can offer the right action:
 *   relation: "self" | "connected" | "none"        (viewer is a client, or anyone scanning themselves)
 *           | "member" | "invited" | "none"          (salon <-> artist team)
 *           | "unrelated"                           (salon scans salon, artist scans artist)
 * A scanned code means the viewer already knows this business, so profiles
 * hidden from public listings are still found.
 * @returns {Promise<{ profile: object, relation: string } | null>}
 */
export async function lookupProfile(viewer, { type, id }) {
  const db = await getDb();
  const row = await get(db, `SELECT ${PROFILE_COLUMNS} ${PROFILE_FROM} WHERE u.id = $1 AND u.type = $2 AND u.suspended_at IS NULL`, [id, type]);
  if (!row) return null;
  const [profile] = await toCards(db, [row]);

  let relation = "none";
  if (row.id === viewer.id) {
    relation = "self";
  } else if (viewer.type === "client") {
    const followed = await get(db, "SELECT 1 FROM follows WHERE follower_user_id = $1 AND target_user_id = $2", [viewer.id, row.id]);
    relation = followed ? "connected" : "none";
  } else if (viewer.type === row.type) {
    relation = "unrelated";
  } else {
    const salonId = viewer.type === "salon" ? viewer.id : row.id;
    const artistId = viewer.type === "artist" ? viewer.id : row.id;
    const member = await get(db, "SELECT 1 FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2", [salonId, artistId]);
    if (member) relation = "member";
    else if (viewer.type === "salon") {
      const invite = await get(db, "SELECT 1 FROM salon_artist_invites WHERE salon_user_id = $1 AND artist_user_id = $2 AND status = $3", [salonId, artistId, INVITE_PENDING]);
      if (invite) relation = "invited";
    }
  }
  return { profile, relation };
}

// ---- Client's personal code ("اسکن شو") ----
//
// The secret lives in the client's user_settings JSON (key `connectCode`) so no
// schema change is needed. userSettings.getSettings only returns known toggle
// keys, so the secret never leaks through the settings API.

function newSecret() {
  return randomBytes(9).toString("base64url").replace(/[^A-Za-z0-9]/g, "").padEnd(12, "0").slice(0, 12);
}

/** The client's personal connect secret, created on first use (race-safe: the first writer wins). */
export async function getOrCreateConnectSecret(userId) {
  const db = await getDb();
  const row = await get(db, `
    INSERT INTO user_settings (user_id, settings, updated_at)
    VALUES ($1, jsonb_build_object('connectCode', $2::text), CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) DO UPDATE SET
      settings = CASE
        WHEN user_settings.settings ? 'connectCode' THEN user_settings.settings
        ELSE COALESCE(user_settings.settings, '{}'::jsonb) || jsonb_build_object('connectCode', $2::text)
      END
    RETURNING settings ->> 'connectCode' AS secret
  `, [userId, newSecret()]);
  return row.secret;
}

function secretsMatch(expected, given) {
  const a = Buffer.from(String(expected || ""));
  const b = Buffer.from(String(given || ""));
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

/**
 * A salon/artist scanned a client's personal code: connect that client to them.
 * @returns {Promise<{ ok: true, client: { id, name, avatar }, alreadyConnected: boolean } | { ok: false, error: "invalid_code" }>}
 */
export async function connectByClientCode(ownerUserId, { userId, secret }) {
  const db = await getDb();
  const client = await get(db, `
    SELECT u.id, u.name, (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS has_avatar, us.settings ->> 'connectCode' AS secret
    FROM users u
    LEFT JOIN user_settings us ON us.user_id = u.id
    WHERE u.id = $1 AND u.type = 'client' AND u.suspended_at IS NULL
  `, [userId]);
  if (!client || client.id === ownerUserId || !secretsMatch(client.secret, secret)) {
    return { ok: false, error: "invalid_code" };
  }
  const result = await connect(client.id, ownerUserId);
  if (!result.ok) return { ok: false, error: "invalid_code" };
  return {
    ok: true,
    alreadyConnected: result.alreadyConnected,
    client: { id: client.id, name: client.name || "", avatar: client.has_avatar ? `/api/media/avatar/${client.id}` : "" }
  };
}
