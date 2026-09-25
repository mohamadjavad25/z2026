import { getDb } from "../../connection.js";
import { addSalonStaff } from "./staff.js";

const PENDING = "در انتظار تایید";
const ACCEPTED = "تایید شد";
const REJECTED = "رد شد";
const CANCELLED = "لغو شد";

function mapSalonInvite(row) {
  if (!row) return null;
  return {
    id: row.id,
    salonId: row.salon_user_id,
    salonName: row.salon_name || "",
    salonAvatar: row.salon_avatar && row.salon_user_id ? `/api/media/avatar/${row.salon_user_id}` : "",
    salonArea: row.salon_area || "",
    artistId: row.artist_user_id,
    artistName: row.artist_name || "آرتیست زیبابان",
    artistAvatar: row.artist_avatar && row.artist_user_id ? `/api/media/avatar/${row.artist_user_id}` : "",
    artistService: row.artist_service || "",
    artistArea: row.artist_area || "",
    artistPhone: row.artist_phone || "",
    role: row.role || "",
    bio: row.bio || "",
    accessLevel: row.access_level || "همکار",
    status: row.status || PENDING,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function listSalonArtistInvites(salonUserId, { status } = {}) {
  const rows = status
    ? getDb().prepare(`
        SELECT
          i.*,
          u.name AS artist_name,
          u.avatar AS artist_avatar,
          u.service AS artist_service,
          u.area AS artist_area,
          u.phone AS artist_phone,
          s.name AS salon_name,
          salon_user.avatar AS salon_avatar,
          s.area AS salon_area
        FROM salon_artist_invites i
        JOIN users u ON u.id = i.artist_user_id
        LEFT JOIN salons s ON s.user_id = i.salon_user_id
        LEFT JOIN users salon_user ON salon_user.id = i.salon_user_id
        WHERE i.salon_user_id = ? AND i.status = ?
        ORDER BY i.id DESC
      `).all(salonUserId, status)
    : getDb().prepare(`
        SELECT
          i.*,
          u.name AS artist_name,
          u.avatar AS artist_avatar,
          u.service AS artist_service,
          u.area AS artist_area,
          u.phone AS artist_phone,
          s.name AS salon_name,
          salon_user.avatar AS salon_avatar,
          s.area AS salon_area
        FROM salon_artist_invites i
        JOIN users u ON u.id = i.artist_user_id
        LEFT JOIN salons s ON s.user_id = i.salon_user_id
        LEFT JOIN users salon_user ON salon_user.id = i.salon_user_id
        WHERE i.salon_user_id = ?
        ORDER BY i.id DESC
      `).all(salonUserId);
  return rows.map(mapSalonInvite).filter(Boolean);
}

export function listArtistSalonInvites(artistUserId, { status } = {}) {
  const rows = status
    ? getDb().prepare(`
        SELECT
          i.*,
          u.name AS artist_name,
          u.avatar AS artist_avatar,
          u.service AS artist_service,
          u.area AS artist_area,
          u.phone AS artist_phone,
          s.name AS salon_name,
          salon_user.avatar AS salon_avatar,
          s.area AS salon_area
        FROM salon_artist_invites i
        JOIN users u ON u.id = i.artist_user_id
        LEFT JOIN salons s ON s.user_id = i.salon_user_id
        LEFT JOIN users salon_user ON salon_user.id = i.salon_user_id
        WHERE i.artist_user_id = ? AND i.status = ?
        ORDER BY i.id DESC
      `).all(artistUserId, status)
    : getDb().prepare(`
        SELECT
          i.*,
          u.name AS artist_name,
          u.avatar AS artist_avatar,
          u.service AS artist_service,
          u.area AS artist_area,
          u.phone AS artist_phone,
          s.name AS salon_name,
          salon_user.avatar AS salon_avatar,
          s.area AS salon_area
        FROM salon_artist_invites i
        JOIN users u ON u.id = i.artist_user_id
        LEFT JOIN salons s ON s.user_id = i.salon_user_id
        LEFT JOIN users salon_user ON salon_user.id = i.salon_user_id
        WHERE i.artist_user_id = ?
        ORDER BY i.id DESC
      `).all(artistUserId);
  return rows.map(mapSalonInvite).filter(Boolean);
}

export function countPendingArtistInvites(artistUserId) {
  const row = getDb().prepare(`
    SELECT COUNT(*) AS count
    FROM salon_artist_invites
    WHERE artist_user_id = ? AND status = ?
  `).get(artistUserId, PENDING);
  return Number(row?.count || 0);
}

function getInviteRow(id) {
  return getDb().prepare(`
    SELECT
      i.*,
      u.name AS artist_name,
      u.avatar AS artist_avatar,
      u.service AS artist_service,
      u.area AS artist_area,
      u.phone AS artist_phone,
      s.name AS salon_name,
      salon_user.avatar AS salon_avatar,
      s.area AS salon_area
    FROM salon_artist_invites i
    JOIN users u ON u.id = i.artist_user_id
    LEFT JOIN salons s ON s.user_id = i.salon_user_id
    LEFT JOIN users salon_user ON salon_user.id = i.salon_user_id
    WHERE i.id = ?
  `).get(id);
}

export function createSalonArtistInvite(salonUserId, data) {
  const artistUserId = Number(data.artistUserId || data.artist_user_id || 0);
  if (!artistUserId) {
    return { ok: false, error: "آرتیست نامعتبر است.", code: "INVALID_ARTIST" };
  }

  const artist = getDb().prepare(`
    SELECT id, name, phone, area, service, avatar, bio, type
    FROM users WHERE id = ? AND type = 'artist' LIMIT 1
  `).get(artistUserId);
  if (!artist) {
    return { ok: false, error: "آرتیست پیدا نشد.", code: "ARTIST_NOT_FOUND" };
  }

  const alreadyStaff = getDb().prepare(`
    SELECT id FROM salon_staff
    WHERE salon_user_id = ? AND artist_user_id = ?
    LIMIT 1
  `).get(salonUserId, artistUserId);
  if (alreadyStaff) {
    return { ok: false, error: "این آرتیست همین حالا در پرسنل سالن است.", code: "ALREADY_STAFF" };
  }

  const existing = getDb().prepare(`
    SELECT * FROM salon_artist_invites
    WHERE salon_user_id = ? AND artist_user_id = ?
    LIMIT 1
  `).get(salonUserId, artistUserId);

  const role = data.role || artist.service || "آرتیست";
  const bio = data.bio || artist.bio || artist.area || "دعوت‌شده از آرتیست‌های نزدیک";
  const accessLevel = data.accessLevel || data.access_level || "همکار";

  if (existing) {
    if (existing.status === PENDING) {
      return {
        ok: false,
        error: "دعوت قبلی هنوز در انتظار تایید آرتیست است.",
        code: "PENDING_EXISTS",
        invite: mapSalonInvite(getInviteRow(existing.id))
      };
    }
    if (existing.status === ACCEPTED) {
      return { ok: false, error: "این آرتیست قبلا دعوت را پذیرفته است.", code: "ALREADY_ACCEPTED" };
    }
    getDb().prepare(`
      UPDATE salon_artist_invites
      SET role = ?, bio = ?, access_level = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(role, bio, accessLevel, PENDING, existing.id);
    return { ok: true, invite: mapSalonInvite(getInviteRow(existing.id)), created: false };
  }

  const info = getDb().prepare(`
    INSERT INTO salon_artist_invites
      (salon_user_id, artist_user_id, role, bio, access_level, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(salonUserId, artistUserId, role, bio, accessLevel, PENDING);

  return {
    ok: true,
    invite: mapSalonInvite(getInviteRow(Number(info.lastInsertRowid))),
    created: true
  };
}

/**
 * Self-service join via the salon's QR/link (app/join-salon/[id]) — the
 * artist is the one acting (scanned the code themselves), so unlike
 * createSalonArtistInvite this skips the PENDING step entirely and lands
 * straight on ACCEPTED + a real salon_staff row. Physically showing/scanning
 * the code is the trust signal a search-based invite doesn't have; the
 * salon can still remove the person from پرسنل afterward like any other
 * staff row if this was a mistake.
 */
export function joinSalonByArtist(salonUserId, artistUserId) {
  const salon = getDb().prepare(`
    SELECT s.name, s.area FROM salons s WHERE s.user_id = ?
  `).get(salonUserId);
  if (!salon) {
    return { ok: false, error: "سالن پیدا نشد.", code: "SALON_NOT_FOUND" };
  }

  const artist = getDb().prepare(`
    SELECT id, name, phone, area, service, bio FROM users WHERE id = ? AND type = 'artist' LIMIT 1
  `).get(artistUserId);
  if (!artist) {
    return { ok: false, error: "آرتیست پیدا نشد.", code: "ARTIST_NOT_FOUND" };
  }

  const alreadyStaff = getDb().prepare(`
    SELECT id FROM salon_staff WHERE salon_user_id = ? AND artist_user_id = ? LIMIT 1
  `).get(salonUserId, artistUserId);
  if (alreadyStaff) {
    return { ok: false, error: "شما همین حالا عضو تیم این سالن هستید.", code: "ALREADY_STAFF" };
  }

  const role = artist.service || "آرتیست";
  const bio = artist.bio || "پیوستن با اسکن کد QR سالن";

  const existingInvite = getDb().prepare(`
    SELECT id FROM salon_artist_invites WHERE salon_user_id = ? AND artist_user_id = ? LIMIT 1
  `).get(salonUserId, artistUserId);

  if (existingInvite) {
    getDb().prepare(`
      UPDATE salon_artist_invites
      SET role = ?, bio = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(role, bio, ACCEPTED, existingInvite.id);
  } else {
    getDb().prepare(`
      INSERT INTO salon_artist_invites
        (salon_user_id, artist_user_id, role, bio, access_level, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(salonUserId, artistUserId, role, bio, "همکار", ACCEPTED);
  }

  const staffPerson = addSalonStaff(salonUserId, {
    artist_user_id: artistUserId,
    name: artist.name,
    phone: artist.phone || "",
    role,
    bio,
    booked: "۰ وقت",
    state: "فعال",
    access_level: "همکار"
  });

  return {
    ok: true,
    staffPerson,
    salon: { id: salonUserId, name: salon.name || "سالن", area: salon.area || "" }
  };
}

/** Minimal public preview for the QR-join landing page — no auth, so it
 *  deliberately exposes only name/area/avatar, nothing from getSalon()'s
 *  fuller (owner-facing) shape. Works even if the salon set its public
 *  showcase private — that toggle is about the client-facing storefront,
 *  unrelated to whether staff can join the team. */
export function getSalonJoinPreview(salonUserId) {
  const row = getDb().prepare(`
    SELECT s.user_id, s.name, s.area, u.avatar
    FROM salons s JOIN users u ON u.id = s.user_id
    WHERE s.user_id = ?
  `).get(salonUserId);
  if (!row) return null;
  return {
    id: row.user_id,
    name: row.name || "سالن",
    area: row.area || "",
    avatar: row.avatar ? `/api/media/avatar/${row.user_id}` : ""
  };
}

export function cancelSalonArtistInvite(id, salonUserId) {
  const current = getDb().prepare(`
    SELECT * FROM salon_artist_invites
    WHERE id = ? AND salon_user_id = ?
  `).get(id, salonUserId);
  if (!current) return null;
  if (current.status !== PENDING) {
    return mapSalonInvite(getInviteRow(id));
  }
  getDb().prepare(`
    UPDATE salon_artist_invites
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND salon_user_id = ?
  `).run(CANCELLED, id, salonUserId);
  return mapSalonInvite(getInviteRow(id));
}

export function respondArtistSalonInvite(id, artistUserId, status) {
  const allowed = new Set([ACCEPTED, REJECTED]);
  const nextStatus = allowed.has(status) ? status : null;
  if (!nextStatus) {
    return { ok: false, error: "وضعیت نامعتبر است.", code: "INVALID_STATUS" };
  }

  const current = getDb().prepare(`
    SELECT * FROM salon_artist_invites
    WHERE id = ? AND artist_user_id = ?
  `).get(id, artistUserId);
  if (!current) {
    return { ok: false, error: "دعوت پیدا نشد.", code: "NOT_FOUND" };
  }
  if (current.status !== PENDING) {
    return {
      ok: false,
      error: "این دعوت دیگر قابل پاسخ نیست.",
      code: "NOT_PENDING",
      invite: mapSalonInvite(getInviteRow(id))
    };
  }

  getDb().prepare(`
    UPDATE salon_artist_invites
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND artist_user_id = ?
  `).run(nextStatus, id, artistUserId);

  const invite = mapSalonInvite(getInviteRow(id));
  let staffPerson = null;
  let staffCreated = false;

  if (nextStatus === ACCEPTED) {
    const existingStaff = getDb().prepare(`
      SELECT * FROM salon_staff
      WHERE salon_user_id = ? AND artist_user_id = ?
      LIMIT 1
    `).get(current.salon_user_id, current.artist_user_id);

    if (existingStaff) {
      getDb().prepare(`
        UPDATE salon_staff
        SET state = ?, access_level = ?, role = COALESCE(NULLIF(?, ''), role), updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run("فعال", current.access_level || "همکار", current.role || "", existingStaff.id);
      staffPerson = getDb().prepare("SELECT * FROM salon_staff WHERE id = ?").get(existingStaff.id);
      staffCreated = false;
    } else {
      staffPerson = addSalonStaff(current.salon_user_id, {
        artist_user_id: current.artist_user_id,
        name: invite.artistName,
        phone: invite.artistPhone || "",
        role: current.role || invite.artistService || "آرتیست",
        bio: current.bio || "دعوت تایید‌شده توسط آرتیست",
        booked: "۰ وقت",
        state: "فعال",
        access_level: current.access_level || "همکار"
      });
      staffCreated = true;
    }
  }

  return {
    ok: true,
    invite,
    staffPerson,
    staffCreated,
    invites: listArtistSalonInvites(artistUserId)
  };
}
