export const AUTH_SESSION_KEY = "zibaban_session";
export const ARTIST_RAIL_DOCK_KEY = "zibaban_artist_rail_dock";

export function readAuthSession() {
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    if (raw === "1") return { v: 1 };
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeAuthSession(profile) {
  window.localStorage.setItem(
    AUTH_SESSION_KEY,
    JSON.stringify({
      v: 1,
      type: profile?.type || "",
      phone: profile?.data?.phone || ""
    })
  );
}

export function normalizeProfile(profile) {
  if (!profile) return null;
  return {
    id: profile.id,
    type: profile.type,
    data: {
      name: profile.name || "",
      area: profile.area || "",
      service: profile.service || "",
      phone: profile.phone || "",
      email: profile.email || "",
      avatar: profile.avatar || "",
      bio: profile.bio || "",
      experienceYears: profile.experienceYears || profile.experience_years || "",
      managerName: profile.managerName || profile.manager_name || ""
    }
  };
}
