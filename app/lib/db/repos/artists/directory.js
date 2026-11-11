/** An artist as others see them: the public page, the list of artists, and a user's saved artists. */
import { getDb, all } from "../../connection.js";
import { listLeaves } from "../teamAgreements.js";
import { countFollowers, countFollowCountsMany, getUserProfileById, isFollowing } from "../users.js";
import { listPostsByOwner } from "../posts.js";
import { isProfileSaved } from "../social.js";
import { getSettings, DEFAULT_SETTINGS, hidesPrices, shownServices } from "../userSettings.js";
import { workplaceSchedule } from "../artistPlace.js";
import { publicLocation } from "../../../location.js";
import { onlineBookingBlock, withoutHiddenProviders } from "../../../billing/access.js";
import { getArtistBreak } from "./breaks.js";
import { listArtistBookedSlots } from "./calendar.js";
import { listArtistHoursPublic } from "./hours.js";
import { listArtistServices } from "./services.js";

export async function getPublicArtist(userId, viewerUserId = null) {
  const user = await getUserProfileById(userId);
  if (!user || user.type !== "artist") return null;
  const [
    posts,
    services,
    followers,
    settings,
    isFollowingViewer,
    isSaved,
    bookedSlots,
    breakTime,
    hours,
    bookingBlock,
    workplaces,
    leaves
  ] = await Promise.all([
    listPostsByOwner(userId, null, { publicOnly: Number(viewerUserId || 0) !== Number(userId) }),
    listArtistServices(userId),
    countFollowers(user.id),
    getSettings(user.id),
    viewerUserId ? isFollowing(viewerUserId, user.id) : false,
    viewerUserId ? isProfileSaved(viewerUserId, user.id) : false,
    listArtistBookedSlots(userId),
    getArtistBreak(userId),
    listArtistHoursPublic(userId),
    onlineBookingBlock(userId, "artist"),
    workplaceSchedule(userId),
    listLeaves(userId)
  ]);
  return {
    id: user.id,
    name: user.name,
    role: user.service ? `آرتیست ${user.service}` : "آرتیست",
    area: user.area,
    location: publicLocation(user),
    instagram: user.instagram || "",
    // The public page's «تماس» button, same as the salon page (salons.js getSalon).
    phone: user.phone || "",
    avatar: user.avatar ? `/api/media/avatar/${user.id}` : "",
    avatarPosition: user.avatar_position || "",
    // Profile-hero banner, same two-step the salon page uses
    // (salons.js getSalon): users.poster arrives from getUserById as a
    // present/absent flag, and the bytes are streamed by
    // /api/media/poster/[userId] instead of riding along in this payload.
    poster: user.poster ? `/api/media/poster/${user.id}` : "",
    posterPosition: user.poster_position || "",
    service: user.service,
    experienceYears: user.experience_years || "",
    followers,
    // Repo layer stays permissive (GET /api/artist/me calls this with
    // viewerUserId === userId for the artist's own dashboard, which must
    // always see itself regardless of the toggle) -- the public-visibility
    // gate based on this flag lives in the caller (GET /api/artists/[id]
    // route + the SSR /artists/[id] page), same split salons.js uses.
    isPublic: settings.publicPortfolio !== false,
    // Subscription closed: the page says so up front instead of the booking form failing at the end.
    onlineBookingPaused: Boolean(bookingBlock),
    // «تأیید خودکار»: a request from her page is confirmed at once, so the client is never asked how long to wait.
    autoConfirm: Boolean(settings.autoConfirm),
    isFollowing: isFollowingViewer,
    isSaved,
    posts,
    // «نمایش قیمت‌ها» off: only the artist themself sees the prices (userSettings.js hidesPrices).
    services: shownServices(services, hidesPrices(settings) && Number(viewerUserId || 0) !== Number(userId)),
    bookedSlots,
    breakTime,
    hours,
    // Upcoming leaves (no notes): the booking page greys those hours.
    leaves: leaves.map(({ from, to, start, end }) => ({ from, to, start, end })),
    // Where the artist's clients go from today on (shared/lib/artistPlace.js): the page shows «کجا» for the chosen day
    // and offers only hours the workplace salon is open too.
    workplaces
  };
}

/**
 * Cursor-paginated when `limit` is given (GET /api/artists); called with no
 * arguments (app/sitemap.js) returns the full, unbounded list -- see
 * salons.js's listSalons() for the identical reasoning (same nextCursor/
 * privacy-filter-after-fetch tradeoff, same why-not-created_at note).
 * Cursors on users.id, artists' own primary key.
 */
export async function listArtists({ cursor, limit, maxLimit = 50 } = {}) {
  const db = await getDb();
  const params = [];
  let where = "type = 'artist'";
  if (cursor != null) {
    params.push(Number(cursor));
    where += ` AND id < $${params.length}`;
  }
  let limitClause = "";
  const pageSize = limit ? Math.min(Math.max(Number(limit) || 20, 1), maxLimit) : null;
  if (pageSize) {
    params.push(pageSize + 1);
    limitClause = `LIMIT $${params.length}`;
  }
  const rawRows = await all(db, `
    SELECT id, name, area, service, (avatar <> '' OR avatar_url IS NOT NULL) AS avatar, avatar_position FROM users WHERE ${where} ORDER BY id DESC ${limitClause}
  `, params);
  const hasMore = pageSize ? rawRows.length > pageSize : false;
  const rows = pageSize ? rawRows.slice(0, pageSize) : rawRows;
  const nextCursor = hasMore ? rows[rows.length - 1].id : null;
  // An artist switched to "خصوصی" via تنظیمات → ویترین عمومی آرتیست must be
  // hidden from the public directory, same rule salons.listSalons()
  // already enforces for its equivalent toggle -- this was previously
  // never checked at all for artists. One batched query for every row's
  // settings instead of N round-trips (same fix as listSalons(), see its
  // comment for the round-trip-count reasoning).
  const userIds = rows.map((row) => row.id);
  const settingsRows = userIds.length
    ? await all(db, "SELECT user_id, settings FROM user_settings WHERE user_id = ANY($1)", [userIds])
    : [];
  const settingsByUser = new Map(settingsRows.map((r) => [
    r.user_id,
    r.settings && typeof r.settings === "object" ? r.settings : {}
  ]));
  const visible = rows.filter((row) => {
    const settings = { ...DEFAULT_SETTINGS, ...(settingsByUser.get(row.id) || {}) };
    return settings.publicPortfolio !== false;
  });
  // Media URL, not raw base64 -- see app/api/media/avatar/[userId]/route.js.
  const mapped = visible.map((row) => ({
    ...row,
    avatar: row.avatar ? `/api/media/avatar/${row.id}` : "",
    avatarPosition: row.avatar_position || ""
  }));
  // An artist whose subscription ran out (and no salon of theirs covers them) is left out until it renews.
  const listed = await withoutHiddenProviders(mapped, (artist) => artist.id);
  return pageSize ? { artists: listed, nextCursor } : listed;
}

/**
 * Card-sized list of independent artists the user has saved (bookmark
 * button on the artist's public profile) — for the "ذخیره‌شده‌ها" tab,
 * alongside saved posts and saved salons. Filters to type = 'artist' so a
 * saved salon (also stored in saved_profiles, target_user_id points at the
 * same users table) never leaks into this list.
 */
export async function listSavedArtistsForUser(userId) {
  const db = await getDb();
  const rows = await all(db, `
    SELECT u.id, u.name, u.service, u.area, u.avatar_position, (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS avatar FROM saved_profiles sp
    JOIN users u ON u.id = sp.target_user_id
    WHERE sp.user_id = $1 AND u.type = 'artist'
    ORDER BY sp.created_at DESC
  `, [userId]);
  const counts = await countFollowCountsMany(rows.map((user) => user.id), db);
  const result = rows.map((user) => ({
    id: user.id,
    name: user.name,
    role: user.service ? `آرتیست ${user.service}` : "آرتیست",
    area: user.area,
    avatar: user.avatar ? `/api/media/avatar/${user.id}` : "",
    avatarPosition: user.avatar_position || "",
    service: user.service,
    followers: counts.followers.get(Number(user.id)) || 0
  }));
  return result;
}
