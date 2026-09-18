import { apiFetch, apiJson } from "./client";

/**
 * GET /api/saves → { data: { salons, artists, savedTargetIds } } (session required)
 * salons/artists are full card arrays (same shapes as listSalons()/listArtists()'
 * card listings) ready to render in the "ذخیره‌شده‌ها" tab. savedTargetIds is a flat
 * id list for quick "is this open profile saved?" checks — mirrors GET /api/follows'
 * followingIds.
 */
export async function getSaves() {
  return apiJson("/api/saves");
}

/**
 * POST /api/saves → { data: { ok, saved, targetUserId } } body: { targetUserId }
 * Toggles save/unsave on a salon or independent artist's public profile.
 */
export async function toggleSave(targetUserId) {
  return apiFetch("/api/saves", {
    method: "POST",
    body: JSON.stringify({ targetUserId })
  });
}
