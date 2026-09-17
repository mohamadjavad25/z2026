import { getDb } from "../connection.js";

// Whitelisted per kind — the media route below trusts these lists to set the
// HTTP Content-Type header, so an unrecognized type must never reach storage
// (a stored `data:text/html;...` served back with that header would be a
// stored-XSS vector the moment a browser requests the media URL directly,
// not just through a <video>/<img> tag).
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime", "video/ogg"];
export const ALLOWED_POSTER_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Parses a `data:<type>;base64,<data>` string; returns null if malformed or the type isn't in `allowedTypes`. */
export function parseStoryDataUrl(dataUrl, allowedTypes) {
  const match = /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ""));
  if (!match) return null;
  const [, contentType, base64] = match;
  if (!allowedTypes.includes(contentType)) return null;
  return { contentType, base64 };
}

export function saveStory(userId, { video = "", poster = "" } = {}) {
  getDb().prepare(`
    INSERT INTO profile_stories (user_id, video, poster, updated_at)
    VALUES (?, ?, ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET
      video = excluded.video,
      poster = excluded.poster,
      updated_at = excluded.updated_at
  `).run(Number(userId), String(video || ""), String(poster || ""));
}

export function deleteStory(userId) {
  getDb().prepare("DELETE FROM profile_stories WHERE user_id = ?").run(Number(userId));
}

export function getStory(userId) {
  return getDb().prepare(
    "SELECT video, poster, updated_at FROM profile_stories WHERE user_id = ?"
  ).get(Number(userId)) || { video: "", poster: "", updated_at: "" };
}

/**
 * Spreadable story fields for PUBLIC profile responses (getShop/getSalon/
 * getArtistProfile). Returns media-endpoint URLs, never the raw base64 —
 * embedding the actual video/poster in every profile-detail JSON meant a
 * ~30MB payload shipped on every page visit even when the story was never
 * opened. The `v=` cache-buster is the row's own updated_at so a replaced
 * video can't be served stale from the browser's long-lived cache.
 */
export function storyFieldsFor(userId) {
  const { video, poster, updated_at } = getStory(userId);
  if (!video && !poster) return null;
  const version = encodeURIComponent(updated_at || "");
  return {
    ...(video ? { storyVideo: `/api/profile/story/media/${userId}?kind=video&v=${version}` } : {}),
    ...(poster ? { storyPoster: `/api/profile/story/media/${userId}?kind=poster&v=${version}` } : {})
  };
}
