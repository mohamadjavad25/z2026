import { getDb } from "../connection.js";
import { countFollowers } from "./users.js";
import { storyFieldsFor } from "./stories.js";
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
  respondArtistSalonInvite
} from "./salons/invites.js";

export function listSalons() {
  return getDb().prepare(`
    SELECT s.*, u.avatar, u.bio
    FROM salons s JOIN users u ON u.id = s.user_id
    ORDER BY s.created_at DESC
  `).all()
    // A salon switched to "خصوصی" via تنظیمات → پروفایل عمومی سالن must be
    // hidden from the public directory — this was previously never checked
    // at all for salons, so toggling the setting off did nothing on the
    // read side (still fully listed here).
    .filter((row) => getSettings(row.user_id).publicPortfolio !== false)
    .map((row) => {
    const followingCount = countFollowing(row.user_id);
    const followerCount = countFollowers(row.user_id);
    const staff = listSalonStaff(row.user_id);
    return {
      id: row.user_id,
      user_id: row.user_id,
      source_key: String(row.user_id),
      name: row.name,
      area: row.area,
      tag: row.tag,
      price: row.price,
      open: row.open,
      rating: row.rating,
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
      avatar: row.avatar || "",
      bio: row.bio || "",
      postCount: row.post_count,
      followerCount,
      followingCount,
      post_count: row.post_count,
      follower_count: followerCount,
      following_count: followingCount,
      services: listSalonServices(row.user_id),
      portfolio: listSalonPortfolio(row.user_id),
      staff,
      hours: listSalonHours(row.user_id),
      // Keep the list light: full story video only travels with getSalon (public page detail).
      hasStory: Boolean(storyFieldsFor(row.user_id))
    };
  });
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
export function listSavedSalonsForUser(userId) {
  return getDb().prepare(`
    SELECT s.*, u.avatar, u.bio
    FROM saved_profiles sp
    JOIN salons s ON s.user_id = sp.target_user_id
    JOIN users u ON u.id = s.user_id
    WHERE sp.user_id = ?
    ORDER BY sp.created_at DESC
  `).all(userId).map((row) => {
    const followerCount = countFollowers(row.user_id);
    const followingCount = countFollowing(row.user_id);
    return {
      id: row.user_id,
      user_id: row.user_id,
      source_key: String(row.user_id),
      name: row.name,
      area: row.area,
      tag: row.tag,
      price: row.price,
      open: row.open,
      rating: row.rating,
      match: row.match_score,
      avatar: row.avatar || "",
      bio: row.bio || "",
      postCount: row.post_count,
      post_count: row.post_count,
      followerCount,
      follower_count: followerCount,
      followingCount,
      following_count: followingCount
    };
  });
}

export function getSalon(userId, viewerUserId = null) {
  const row = getDb().prepare(`
    SELECT s.*, u.avatar, u.bio
    FROM salons s JOIN users u ON u.id = s.user_id
    WHERE s.user_id = ?
  `).get(userId);
  if (!row) return null;
  const followerCount = countFollowers(row.user_id);
  const followingCount = countFollowing(row.user_id);
  return {
    id: row.user_id,
    user_id: row.user_id,
    source_key: String(row.user_id),
    name: row.name,
    area: row.area,
    tag: row.tag,
    price: row.price,
    open: row.open,
    rating: row.rating,
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
    avatar: row.avatar || "",
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
    // the SSR /salons/[id] page), same split shops.js already uses between
    // getShop()'s isPublic field and the route-level check.
    isPublic: getSettings(row.user_id).publicPortfolio !== false,
    isSaved: viewerUserId ? isProfileSaved(viewerUserId, row.user_id) : false,
    services: listSalonServices(userId),
    portfolio: listSalonPortfolio(userId),
    staff: listSalonStaff(userId),
    hours: listSalonHours(userId),
    bookings: listSalonBookings(userId),
    ...(storyFieldsFor(userId) || {})
  };
}

export function setSalonFollow(salonUserId, followerUserId, follow = true) {
  const db = getDb();
  if (follow) {
    db.prepare(`
      INSERT OR IGNORE INTO follows (follower_user_id, target_user_id) VALUES (?, ?)
    `).run(followerUserId, salonUserId);
  } else {
    db.prepare("DELETE FROM follows WHERE follower_user_id = ? AND target_user_id = ?").run(followerUserId, salonUserId);
  }
  const count = db.prepare("SELECT COUNT(*) AS c FROM follows WHERE target_user_id = ?").get(salonUserId);
  db.prepare("UPDATE salons SET follower_count = ? WHERE user_id = ?").run(Number(count?.c || 0), salonUserId);
  const followerCount = Number(count?.c || 0);
  return {
    following: follow,
    followerCount,
    follower_count: followerCount,
    source_key: String(salonUserId),
    salonUserId
  };
}
