import { apiFetch } from "../../shared/api/client";
import { getSaves } from "../../shared/api/saves";

/** The viewer's follows and saves from the server, and removing a card from «ذخیره‌شده‌ها». Part of useShellNavigation. */
export function useSavedProfilesSync({
  setFollowedArtists,
  setFollowedSalons,
  setSavedSalonKeys,
  setSavedArtists,
  setSavedProfiles,
  toggleSaveSalon,
  toggleSavePublicArtist
}) {
  async function refreshFollows() {
    try {
      const { ok, payload } = await apiFetch("/api/follows");
      if (!ok) return;
      const ids = (payload.data?.followingIds || []).map(String);
      setFollowedArtists(ids);
      setFollowedSalons(ids);
    } catch {
      // ignore
    }
  }

  // Seeds real saved-salon/saved-artist state from the server — mirrors
  // refreshFollows above (same "one id list feeds both salon + artist local
  // state" shape, since a save target can be either type). Also stashes the
  // full card arrays for the "ذخیره‌شده‌ها" profile tab so it doesn't have to
  // derive from whatever's currently loaded in salonDirectory.
  async function refreshSaves() {
    try {
      const { ok, data } = await getSaves();
      if (!ok) return;
      const ids = (data?.savedTargetIds || []).map(String);
      setSavedSalonKeys(ids);
      setSavedArtists(ids);
      setSavedProfiles({ salons: data?.salons || [], artists: data?.artists || [] });
    } catch {
      // ignore
    }
  }

  // toggleSaveSalon/toggleSavePublicArtist only update the id-only
  // savedSalonKeys/savedArtists lists (for button state elsewhere) — they
  // don't know about savedProfiles' full card arrays, which only the
  // "ذخیره‌شده‌ها" tab renders. Without this, removing a card from that tab
  // toggled the DB correctly but left the stale card on screen until the
  // next full refreshSaves() (e.g. a reload) — DB and UI silently diverged.
  function removeSavedSalon(salon) {
    toggleSaveSalon(salon);
    const key = String(salon.id || salon.source_key || salon.name);
    setSavedProfiles((prev) => ({
      ...prev,
      salons: prev.salons.filter((item) => String(item.id || item.source_key || item.name) !== key)
    }));
  }

  function removeSavedArtist(artist) {
    toggleSavePublicArtist(artist);
    const key = String(artist.id || artist.name);
    setSavedProfiles((prev) => ({
      ...prev,
      artists: prev.artists.filter((item) => String(item.id || item.name) !== key)
    }));
  }

  return { refreshFollows, refreshSaves, removeSavedSalon, removeSavedArtist };
}
