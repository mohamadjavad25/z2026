import { getDb, all, get, run } from "../connection.js";
import { countFollowers } from "./users.js";
import { isProfileSaved } from "./social.js";
import { getSettings } from "./userSettings.js";
import { countFollowing } from "./salons/common.js";
import { listClientSalonBookings, listSalonBookings } from "./salons/bookings.js";
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
  joinSalonByArtist,
  getSalonJoinPreview
} from "./salons/invites.js";

export async function listSalons() {
  const db = await getDb();
  const rows = await all(db, `
    SELECT s.*, u.avatar, u.bio, u.avatar_position
    FROM salons s JOIN users u ON u.id = s.user_id
    ORDER BY s.created_at DESC
  `);
  const result = [];
  for (const row of rows) {
    // A salon switched to "خصوصی" via تنظیمات → پروفایل عمومی سالن must be
    // hidden from the public directory — this was previously never checked
    // at all for salons, so toggling the setting off did nothing on the
    // read side (still fully listed here).
    const settings = await getSettings(row.user_id, db);
    if (settings.publicPortfolio === false) continue;
    const followingCount = await countFollowing(row.user_id, db);
    const followerCount = await countFollowers(row.user_id, db);
    const staff = await listSalonStaff(row.user_id, db);
    result.push({
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
      services: await listSalonServices(row.user_id, db),
      portfolio: await listSalonPortfolio(row.user_id, db),
      staff,
      hours: await listSalonHours(row.user_id, db)
    });
  }
  return result;
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
    SELECT s.*, u.avatar, u.bio, u.avatar_position
    FROM saved_profiles sp
    JOIN salons s ON s.user_id = sp.target_user_id
    JOIN users u ON u.id = s.user_id
    WHERE sp.user_id = ?
    ORDER BY sp.created_at DESC
  `, [userId]);
  const result = [];
  for (const row of rows) {
    const followerCount = await countFollowers(row.user_id, db);
    const followingCount = await countFollowing(row.user_id, db);
    result.push({
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
    });
  }
  return result;
}

export async function getSalon(userId, viewerUserId = null) {
  const db = await getDb();
  const row = await get(db, `
    SELECT s.*, u.avatar, u.bio, u.avatar_position
    FROM salons s JOIN users u ON u.id = s.user_id
    WHERE s.user_id = ?
  `, [userId]);
  if (!row) return null;
  const followerCount = await countFollowers(row.user_id, db);
  const followingCount = await countFollowing(row.user_id, db);
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
    isPublic: (await getSettings(row.user_id, db)).publicPortfolio !== false,
    isSaved: viewerUserId ? await isProfileSaved(viewerUserId, row.user_id, db) : false,
    services: await listSalonServices(userId, db),
    portfolio: await listSalonPortfolio(userId, db),
    staff: await listSalonStaff(userId, db),
    hours: await listSalonHours(userId, db),
    bookings: await listSalonBookings(userId)
  };
}

export async function setSalonFollow(salonUserId, followerUserId, follow = true) {
  const db = await getDb();
  if (follow) {
    await run(db, `
      INSERT INTO follows (follower_user_id, target_user_id) VALUES (?, ?)
      ON CONFLICT (follower_user_id, target_user_id) DO NOTHING
    `, [followerUserId, salonUserId]);
  } else {
    await run(db, "DELETE FROM follows WHERE follower_user_id = ? AND target_user_id = ?", [followerUserId, salonUserId]);
  }
  const count = await get(db, "SELECT COUNT(*) AS c FROM follows WHERE target_user_id = ?", [salonUserId]);
  const followerCount = Number(count?.c || 0);
  await run(db, "UPDATE salons SET follower_count = ? WHERE user_id = ?", [followerCount, salonUserId]);
  return {
    following: follow,
    followerCount,
    follower_count: followerCount,
    source_key: String(salonUserId),
    salonUserId
  };
}
