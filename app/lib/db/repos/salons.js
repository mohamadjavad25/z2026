import { getDb, all, get, run } from "../connection.js";
import { countFollowers } from "./users.js";
import { isProfileSaved } from "./social.js";
import { getSettings, DEFAULT_SETTINGS } from "./userSettings.js";
import { countFollowing, defaultHours } from "./salons/common.js";
import { listSalonBookings } from "./salons/bookings.js";
import { listSalonHours } from "./salons/hours.js";
import { listSalonPortfolio } from "./salons/portfolio.js";
import { listSalonServices } from "./salons/services.js";
import { listSalonStaff } from "./salons/staff.js";

export { listSalonBookings, listClientSalonBookings, addSalonBooking, updateSalonBooking, cancelSalonBooking, patchSalonBookingWithArtistSync } from "./salons/bookings.js";
export { ensureSalonHours, listSalonHours, updateSalonHour } from "./salons/hours.js";
export { listSalonPortfolio, addSalonPortfolio, updateSalonPortfolio, deleteSalonPortfolio } from "./salons/portfolio.js";
export { listSalonServices, addSalonService, updateSalonService, deleteSalonService } from "./salons/services.js";
export {
  listSalonStaff,
  findSalonStaffForBooking,
  addSalonStaff,
  addSalonStaffFromCollab,
  updateSalonStaff,
  deleteSalonStaff
} from "./salons/staff.js";
export {
  listSalonArtistInvites,
  listArtistSalonInvites,
  countPendingArtistInvites,
  createSalonArtistInvite,
  cancelSalonArtistInvite,
  respondArtistSalonInvite,
  listArtistTeams,
  leaveSalonTeam,
  joinSalonByArtist,
  getSalonJoinPreview
} from "./salons/invites.js";

/**
 * Cursor-paginated when `limit` is given (GET /api/salons); called with no
 * arguments it returns the full, unbounded list -- app/sitemap.js needs
 * every salon to build a complete sitemap, not one page of them, so that
 * caller intentionally omits `limit`.
 *
 * Cursors on s.user_id (salons' own primary key, a FK onto the
 * SERIAL users.id -- unique and monotonic with creation order, so it's a
 * correct, indexed substitute for cursoring on created_at, which isn't
 * guaranteed unique). Fetches `limit + 1` raw rows to detect whether
 * another page exists without a separate COUNT(*) query.
 *
 * Note: the per-row publicPortfolio privacy filter below runs AFTER this
 * page is fetched, so a page can come back with fewer than `limit` visible
 * salons even when more exist later (the filtered-out rows still consumed
 * a slot in this page's LIMIT) -- an accepted tradeoff for keeping the
 * query itself simple, not a pagination bug: nextCursor always reflects
 * the true underlying table position, so paging through it still visits
 * every row exactly once.
 */
export async function listSalons({ cursor, limit } = {}) {
  const db = await getDb();
  const params = [];
  let where = "";
  if (cursor != null) {
    params.push(Number(cursor));
    where = `WHERE s.user_id < $${params.length}`;
  }
  let limitClause = "";
  const pageSize = limit ? Math.min(Math.max(Number(limit) || 20, 1), 50) : null;
  if (pageSize) {
    params.push(pageSize + 1);
    limitClause = `LIMIT $${params.length}`;
  }
  const rawRows = await all(db, `
    SELECT s.*, (u.avatar <> '') AS avatar, u.bio, u.avatar_position
    FROM salons s JOIN users u ON u.id = s.user_id
    ${where}
    ORDER BY s.user_id DESC
    ${limitClause}
  `, params);
  const hasMore = pageSize ? rawRows.length > pageSize : false;
  const rows = pageSize ? rawRows.slice(0, pageSize) : rawRows;
  const nextCursor = hasMore ? rows[rows.length - 1].user_id : null;

  if (rows.length === 0) {
    return pageSize ? { salons: [], nextCursor: null } : [];
  }

  // This used to run 7 lookups PER ROW (settings, 2 follow counts, staff,
  // services, portfolio, hours) -- with Promise.all per row, but still
  // 1 + 7*N round-trips total, all competing for the 5-connection pool
  // (connection.js), which meant "concurrent" mostly just meant "queued
  // 5-wide" rather than actually fast. That was the single heaviest source
  // of DB round-trips in the app and the main reason /api/salons (hit on
  // every app boot and again after every login) was slow.
  //
  // Batched instead: one query per *kind* of lookup, covering every salon
  // on this page at once, independent of how many salons there are.
  //
  // staff/portfolio are deliberately NOT fetched here (unlike before) --
  // grepped every directory/browse consumer (useSalonDirectory.js,
  // HomeApp.jsx): none of them read salon.staff/.portfolio from this list
  // shape. Opening a salon's detail view (selectSalonWithDetail in
  // HomeApp.jsx) always re-fetches the full single-salon getSalon() payload
  // -- which still includes staff/portfolio, unchanged below -- and merges
  // it over whatever came from this list. services/hours ARE kept because
  // useSalonDirectory.js's inline booking modal reads them directly off a
  // directory row without waiting for that detail fetch.
  const userIds = rows.map((row) => row.user_id);
  const [settingsRows, followerRows, followingRows, serviceRows, hourRows] = await Promise.all([
    all(db, "SELECT user_id, settings FROM user_settings WHERE user_id = ANY($1)", [userIds]),
    all(db, "SELECT target_user_id, COUNT(*) AS c FROM follows WHERE target_user_id = ANY($1) GROUP BY target_user_id", [userIds]),
    all(db, "SELECT follower_user_id, COUNT(*) AS c FROM follows WHERE follower_user_id = ANY($1) GROUP BY follower_user_id", [userIds]),
    // Deliberately a plain column select, not listSalonServices()'s
    // staff-enrichment JOIN (which itself calls listSalonStaff(), the
    // expensive per-staff artist-resolution fanout) -- confirmed nothing
    // in the directory/booking-modal path reads service.staff_members/
    // staff_names, only .name/.price/.duration/.hint, all plain columns.
    all(db, "SELECT * FROM salon_services WHERE salon_user_id = ANY($1) ORDER BY id", [userIds]),
    all(db, "SELECT * FROM salon_hours WHERE salon_user_id = ANY($1)", [userIds])
  ]);

  const settingsByUser = new Map(settingsRows.map((r) => [
    r.user_id,
    r.settings && typeof r.settings === "object" ? r.settings : {}
  ]));
  const followerByUser = new Map(followerRows.map((r) => [r.target_user_id, Number(r.c)]));
  const followingByUser = new Map(followingRows.map((r) => [r.follower_user_id, Number(r.c)]));
  const servicesByUser = new Map();
  for (const svc of serviceRows) {
    if (!servicesByUser.has(svc.salon_user_id)) servicesByUser.set(svc.salon_user_id, []);
    servicesByUser.get(svc.salon_user_id).push(svc);
  }
  const hourOrder = new Map(defaultHours.map((h, i) => [h.day, i]));
  const hoursByUser = new Map();
  for (const hour of hourRows) {
    if (!hoursByUser.has(hour.salon_user_id)) hoursByUser.set(hour.salon_user_id, []);
    hoursByUser.get(hour.salon_user_id).push(hour);
  }
  for (const list of hoursByUser.values()) {
    list.sort((a, b) => (hourOrder.get(a.day) ?? 99) - (hourOrder.get(b.day) ?? 99));
  }

  const built = rows.map((row) => {
    // A salon switched to "خصوصی" via تنظیمات → پروفایل عمومی سالن must be
    // hidden from the public directory — this was previously never checked
    // at all for salons, so toggling the setting off did nothing on the
    // read side (still fully listed here).
    const settings = { ...DEFAULT_SETTINGS, ...(settingsByUser.get(row.user_id) || {}) };
    if (settings.publicPortfolio === false) return null;
    const followerCount = followerByUser.get(row.user_id) || 0;
    const followingCount = followingByUser.get(row.user_id) || 0;
    return {
      id: row.user_id,
      user_id: row.user_id,
      source_key: String(row.user_id),
      name: row.name,
      area: row.area,
      tag: row.tag,
      price: row.price,
      open: row.open,
      match: row.match_score,
      // Deliberately NOT including phone/email here: row.phone/row.email are
      // users.phone/users.email -- this account's LOGIN credentials, not a
      // business contact the owner opted to publish (same finding as the
      // JSON-LD telephone leak fixed in buildSalonJsonLd -- see
      // app/salons/[id]/page.jsx). This is the unauthenticated bulk salon
      // directory (GET /api/salons, no session required): every salon's
      // login phone/email would otherwise be scrapable in one request. No
      // salon-card component reads .phone/.email from this list shape
      // (grepped app/features/salons) -- only the single-salon detail view
      // (getSalon() below) does, for its "call the salon" contact block.
      avatar: row.avatar ? `/api/media/avatar/${row.user_id}` : "",
      avatarPosition: row.avatar_position || "",
      bio: row.bio || "",
      postCount: row.post_count,
      followerCount,
      followingCount,
      post_count: row.post_count,
      follower_count: followerCount,
      following_count: followingCount,
      services: servicesByUser.get(row.user_id) || [],
      hours: hoursByUser.get(row.user_id) || [],
      portfolio: [],
      staff: []
    };
  });
  const visible = built.filter(Boolean);
  return pageSize ? { salons: visible, nextCursor } : visible;
}

/**
 * Card-sized list of salons the user has saved (bookmark button on the
 * salon's public profile) — for the "ذخیره‌شده‌ها" tab, alongside saved
 * posts and saved artists. Deliberately skips the heavy per-salon
 * services/portfolio/staff/hours queries listSalons()/getSalon() do — a
 * saved-list card only needs enough to render without another round-trip
 * (see ProfileSavedPosts.jsx), and post_count already covers the "N
 * نمونه‌کار" fallback it reads when portfolio isn't present.
 */
export async function listSavedSalonsForUser(userId) {
  const db = await getDb();
  const rows = await all(db, `
    SELECT s.*, (u.avatar <> '') AS avatar, u.bio, u.avatar_position
    FROM saved_profiles sp
    JOIN salons s ON s.user_id = sp.target_user_id
    JOIN users u ON u.id = s.user_id
    WHERE sp.user_id = $1
    ORDER BY sp.created_at DESC
  `, [userId]);
  const result = await Promise.all(rows.map(async (row) => {
    const [followerCount, followingCount] = await Promise.all([
      countFollowers(row.user_id, db),
      countFollowing(row.user_id, db)
    ]);
    return {
      id: row.user_id,
      user_id: row.user_id,
      source_key: String(row.user_id),
      name: row.name,
      area: row.area,
      tag: row.tag,
      price: row.price,
      open: row.open,
      match: row.match_score,
      avatar: row.avatar ? `/api/media/avatar/${row.user_id}` : "",
      avatarPosition: row.avatar_position || "",
      bio: row.bio || "",
      postCount: row.post_count,
      post_count: row.post_count,
      followerCount,
      follower_count: followerCount,
      followingCount,
      following_count: followingCount
    };
  }));
  return result;
}

export async function getSalon(userId, viewerUserId = null) {
  const db = await getDb();
  const row = await get(db, `
    SELECT s.*, (u.avatar <> '') AS avatar, u.bio, u.avatar_position
    FROM salons s JOIN users u ON u.id = s.user_id
    WHERE s.user_id = $1
  `, [userId]);
  if (!row) return null;
  const [
    followerCount,
    followingCount,
    settings,
    isSaved,
    services,
    portfolio,
    staff,
    hours,
    bookings
  ] = await Promise.all([
    countFollowers(row.user_id, db),
    countFollowing(row.user_id, db),
    getSettings(row.user_id, db),
    viewerUserId ? isProfileSaved(viewerUserId, row.user_id, db) : false,
    listSalonServices(userId, db),
    listSalonPortfolio(userId, db),
    listSalonStaff(userId, db),
    listSalonHours(userId, db),
    listSalonBookings(userId)
  ]);
  return {
    id: row.user_id,
    user_id: row.user_id,
    source_key: String(row.user_id),
    name: row.name,
    area: row.area,
    tag: row.tag,
    price: row.price,
    open: row.open,
    match: row.match_score,
    // phone: still included below -- SalonClientPage's contact block
    // (salonPublicAboutContact) actively renders it as the salon's "call us"
    // number. That reuses users.phone (the LOGIN credential), same root
    // cause as the JSON-LD leak already fixed elsewhere -- flagged for a
    // product decision (see security report) rather than silently removed,
    // since removing it here would break a real, currently-shipped feature.
    // email is NOT included: grepped every salon feature component, nothing
    // reads .email from this shape -- pure unused PII exposure, same as the
    // listSalons() case above.
    phone: row.phone,
    avatar: row.avatar ? `/api/media/avatar/${row.user_id}` : "",
    avatarPosition: row.avatar_position || "",
    bio: row.bio || "",
    rules: row.rules || "",
    postCount: row.post_count,
    post_count: row.post_count,
    followerCount,
    follower_count: followerCount,
    followingCount,
    following_count: followingCount,
    // Repo layer stays permissive (internal callers like POST
    // /api/salon-bookings look salons up with no viewer at all, including a
    // salon's own walk-in booking for itself) -- the public-visibility gate
    // based on this flag lives in the caller (GET /api/salons/[id] route +
    // the SSR /salons/[id] page), same split artists.js already uses
    // between getArtist()'s isPublic field and the route-level check.
    isPublic: settings.publicPortfolio !== false,
    isSaved,
    services,
    portfolio,
    staff,
    hours,
    bookings
  };
}

export async function setSalonFollow(salonUserId, followerUserId, follow = true) {
  const db = await getDb();
  if (follow) {
    await run(db, `
      INSERT INTO follows (follower_user_id, target_user_id) VALUES ($1, $2)
      ON CONFLICT (follower_user_id, target_user_id) DO NOTHING
    `, [followerUserId, salonUserId]);
  } else {
    await run(db, "DELETE FROM follows WHERE follower_user_id = $1 AND target_user_id = $2", [followerUserId, salonUserId]);
  }
  const count = await get(db, "SELECT COUNT(*) AS c FROM follows WHERE target_user_id = $1", [salonUserId]);
  const followerCount = Number(count?.c || 0);
  await run(db, "UPDATE salons SET follower_count = $1 WHERE user_id = $2", [followerCount, salonUserId]);
  return {
    following: follow,
    followerCount,
    follower_count: followerCount,
    source_key: String(salonUserId),
    salonUserId
  };
}

export const SALON_RULES_MAX_LENGTH = 2000;

export async function getSalonRules(userId) {
  const db = await getDb();
  const row = await get(db, "SELECT rules FROM salons WHERE user_id = $1", [userId]);
  return row?.rules || "";
}

export async function updateSalonRules(userId, rules) {
  const db = await getDb();
  const text = String(rules ?? "").replace(/\r\n/g, "\n").trim().slice(0, SALON_RULES_MAX_LENGTH);
  await run(db, "UPDATE salons SET rules = $1, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2", [text, userId]);
  return text;
}
