import { getDb } from "../connection.js";
import { countFollowers } from "./users.js";
import { storyFieldsFor } from "./stories.js";
import { countFollowing } from "./salons/common.js";
import { listClientSalonBookings, listSalonBookings } from "./salons/bookings.js";
import { listSalonHours } from "./salons/hours.js";
import { listSalonPortfolio } from "./salons/portfolio.js";
import { listSalonServices } from "./salons/services.js";
import { listSalonStaff } from "./salons/staff.js";

export { listSalonBookings, listClientSalonBookings, addSalonBooking, updateSalonBooking, cancelSalonBooking, patchSalonBookingWithArtistSync, getSalonBookingById } from "./salons/bookings.js";
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
  `).all().map((row) => {
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
      phone: row.phone,
      email: row.email,
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

export function getSalon(userId) {
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
    phone: row.phone,
    email: row.email,
    avatar: row.avatar || "",
    bio: row.bio || "",
    postCount: row.post_count,
    post_count: row.post_count,
    followerCount,
    follower_count: followerCount,
    followingCount,
    following_count: followingCount,
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
