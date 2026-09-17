import { getDb } from "../../connection.js";
import { normalizePhone } from "./common.js";
export function listSalonStaff(salonUserId) {
  ensureSalonStaffArtistColumn();
  const rows = getDb().prepare(`
    SELECT st.*
    FROM salon_staff st
    WHERE st.salon_user_id = ?
    ORDER BY st.id
  `).all(salonUserId);

  return rows.map((row) => {
    const artist = resolveArtistUserForStaff(row);
    if (artist?.id && !row.artist_user_id) {
      getDb().prepare(`
        UPDATE salon_staff
        SET artist_user_id = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND salon_user_id = ?
      `).run(artist.id, row.id, salonUserId);
    }
    return {
      ...row,
      artist_user_id: artist?.id || row.artist_user_id || null,
      avatar: artist?.avatar || "",
      staff_avatar: artist?.avatar || "",
      artist_name: artist?.name || row.name || "",
      artist_area: artist?.area || "",
      artist_bio: artist?.bio || row.bio || "",
      artist_service: artist?.service || "",
      artist_phone: artist?.phone || row.phone || "",
      has_artist_profile: Boolean(artist?.id)
    };
  });
}

function resolveArtistUserForStaff(staff) {
  if (!staff) return null;

  if (staff.artist_user_id) {
    const linked = getDb().prepare(`
      SELECT id, name, phone, area, service, avatar, bio, type
      FROM users WHERE id = ? AND type = 'artist'
      LIMIT 1
    `).get(staff.artist_user_id);
    if (linked) return linked;
  }

  const rawPhone = String(staff.phone || "").trim();
  const phone = normalizePhone(rawPhone);
  if (phone) {
    const byPhone = getDb().prepare(`
      SELECT id, name, phone, area, service, avatar, bio, type
      FROM users
      WHERE type = 'artist'
        AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(phone,
          '۰','0'),'۱','1'),'۲','2'),'۳','3'),'۴','4'),'۵','5'),'۶','6'),'۷','7'),'۸','8'),'۹','9') = ?
      LIMIT 1
    `).get(phone);
    if (byPhone) return byPhone;
  }

  const name = String(staff.name || "").trim();
  if (!name) return null;
  return getDb().prepare(`
    SELECT id, name, phone, area, service, avatar, bio, type
    FROM users
    WHERE type = 'artist' AND name = ?
    LIMIT 1
  `).get(name);
}

export function findSalonStaffForBooking(salonUserId, staffName, serviceName = "") {
  ensureSalonStaffArtistColumn();
  const name = String(staffName || "").trim();
  const service = String(serviceName || "").trim();
  let row = name
    ? getDb().prepare(`
      SELECT * FROM salon_staff
      WHERE salon_user_id = ? AND name = ?
      LIMIT 1
    `).get(salonUserId, name)
    : null;
  if (!row && service) {
    row = getDb().prepare(`
      SELECT st.*
      FROM salon_services sv
      JOIN salon_staff st
        ON st.id = sv.staff_id AND st.salon_user_id = sv.salon_user_id
      WHERE sv.salon_user_id = ? AND sv.name = ?
      LIMIT 1
    `).get(salonUserId, service) || null;
  }
  if (!row && service) {
    row = getDb().prepare(`
      SELECT *
      FROM salon_staff
      WHERE salon_user_id = ?
        AND artist_user_id IS NOT NULL
        AND (role = ? OR bio LIKE ?)
      ORDER BY id DESC
      LIMIT 1
    `).get(salonUserId, service, `%${service}%`) || null;
  }
  if (!row) return null;
  const artist = resolveArtistUserForStaff(row);
  if (artist?.id && !row.artist_user_id) {
    getDb().prepare(`
      UPDATE salon_staff
      SET artist_user_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND salon_user_id = ?
    `).run(artist.id, row.id, salonUserId);
  }
  return {
    ...row,
    artist_user_id: artist?.id || row.artist_user_id || null,
    avatar: artist?.avatar || "",
    staff_avatar: artist?.avatar || ""
  };
}

function ensureSalonStaffArtistColumn() {
  const cols = getDb().prepare("PRAGMA table_info(salon_staff)").all();
  if (!cols.some((col) => col.name === "artist_user_id")) {
    getDb().exec("ALTER TABLE salon_staff ADD COLUMN artist_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL");
  }
}

export function addSalonStaff(salonUserId, data) {
  ensureSalonStaffArtistColumn();
  const draft = {
    artist_user_id: data.artistUserId || data.artist_user_id || null,
    name: data.name || "",
    phone: data.phone || "",
    role: data.role || "",
    bio: data.bio || "",
    booked: data.booked || "",
    state: data.state || "",
    access_level: data.accessLevel || data.access_level || "آرتیست"
  };
  const resolvedArtist = resolveArtistUserForStaff(draft);
  const artistUserId = draft.artist_user_id || resolvedArtist?.id || null;
  const info = getDb().prepare(`
    INSERT INTO salon_staff
      (salon_user_id, artist_user_id, name, phone, role, bio, booked, state, access_level)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    salonUserId,
    artistUserId,
    draft.name,
    draft.phone,
    draft.role,
    draft.bio,
    draft.booked,
    draft.state,
    draft.access_level
  );
  const created = getDb().prepare("SELECT * FROM salon_staff WHERE id = ?").get(Number(info.lastInsertRowid));
  const artist = resolveArtistUserForStaff(created);
  return {
    ...created,
    artist_user_id: artist?.id || created.artist_user_id || null,
    avatar: artist?.avatar || "",
    staff_avatar: artist?.avatar || "",
    artist_name: artist?.name || created.name || "",
    artist_area: artist?.area || "",
    artist_bio: artist?.bio || created.bio || "",
    artist_service: artist?.service || "",
    artist_phone: artist?.phone || created.phone || "",
    has_artist_profile: Boolean(artist?.id)
  };
}

export function addSalonStaffFromCollab(salonUserId, collab) {
  ensureSalonStaffArtistColumn();
  const artistId = Number(collab?.artistId || collab?.artist_user_id || 0) || null;
  const artistName = collab?.artistName || collab?.artist_name || "آرتیست زیبابان";
  const role = collab?.service || collab?.artistService || "همکار سالن";
  const existing = artistId
    ? getDb().prepare("SELECT * FROM salon_staff WHERE salon_user_id = ? AND artist_user_id = ? LIMIT 1").get(salonUserId, artistId)
    : getDb().prepare("SELECT * FROM salon_staff WHERE salon_user_id = ? AND name = ? AND role = ? LIMIT 1").get(salonUserId, artistName, role);
  const bio = [
    "افزوده‌شده از پیشنهاد همکاری",
    collab?.days ? `روزها: ${collab.days}` : "",
    collab?.from && collab?.to ? `ساعت: ${collab.from} تا ${collab.to}` : "",
    collab?.share ? `سهم آرتیست: ${collab.share}٪` : ""
  ].filter(Boolean).join(" · ");

  if (existing) {
    getDb().prepare(`
      UPDATE salon_staff
      SET state = ?, access_level = ?, bio = COALESCE(NULLIF(bio, ''), ?), updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND salon_user_id = ?
    `).run("فعال", "همکار", bio, existing.id, salonUserId);
    return { person: getDb().prepare("SELECT * FROM salon_staff WHERE id = ?").get(existing.id), created: false };
  }

  return {
    person: addSalonStaff(salonUserId, {
      artistUserId: artistId,
      name: artistName,
      phone: "",
      role,
      bio,
      booked: "۰ وقت",
      state: "فعال",
      accessLevel: "همکار"
    }),
    created: true
  };
}

export function updateSalonStaff(id, salonUserId, data) {
  ensureSalonStaffArtistColumn();
  const current = getDb().prepare("SELECT * FROM salon_staff WHERE id = ? AND salon_user_id = ?").get(id, salonUserId);
  if (!current) return null;
  const nextDraft = {
    artist_user_id: data.artistUserId ?? data.artist_user_id ?? current.artist_user_id,
    name: data.name ?? current.name,
    phone: data.phone ?? current.phone,
    role: data.role ?? current.role,
    bio: data.bio ?? current.bio,
    booked: data.booked ?? current.booked,
    state: data.state ?? current.state,
    access_level: data.accessLevel ?? data.access_level ?? current.access_level
  };
  const resolvedArtist = resolveArtistUserForStaff(nextDraft);
  const artistUserId = nextDraft.artist_user_id || resolvedArtist?.id || null;
  getDb().prepare(`
    UPDATE salon_staff SET
      artist_user_id = ?, name = ?, phone = ?, role = ?, bio = ?, booked = ?, state = ?, access_level = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND salon_user_id = ?
  `).run(
    artistUserId,
    nextDraft.name,
    nextDraft.phone,
    nextDraft.role,
    nextDraft.bio,
    nextDraft.booked,
    nextDraft.state,
    nextDraft.access_level,
    id,
    salonUserId
  );
  const updated = getDb().prepare("SELECT * FROM salon_staff WHERE id = ?").get(id);
  const artist = resolveArtistUserForStaff(updated);
  return {
    ...updated,
    artist_user_id: artist?.id || updated.artist_user_id || null,
    avatar: artist?.avatar || "",
    staff_avatar: artist?.avatar || "",
    artist_name: artist?.name || updated.name || "",
    artist_area: artist?.area || "",
    artist_bio: artist?.bio || updated.bio || "",
    artist_service: artist?.service || "",
    artist_phone: artist?.phone || updated.phone || "",
    has_artist_profile: Boolean(artist?.id)
  };
}

export function deleteSalonStaff(id, salonUserId) {
  ensureSalonStaffArtistColumn();
  const current = getDb().prepare("SELECT * FROM salon_staff WHERE id = ? AND salon_user_id = ?").get(id, salonUserId);
  if (!current) return { ok: false, person: null };
  const ok = getDb().prepare("DELETE FROM salon_staff WHERE id = ? AND salon_user_id = ?").run(id, salonUserId).changes > 0;
  return { ok, person: ok ? current : null };
}
