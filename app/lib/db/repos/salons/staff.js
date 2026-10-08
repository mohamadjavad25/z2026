import { getDb, all, get, run } from "../../connection.js";
import { normalizePhone } from "./common.js";

function artistAvatarUrl(artist) {
  return artist?.avatar ? `/api/media/avatar/${artist.id}` : "";
}

export async function listSalonStaff(salonUserId, runner = null) {
  const db = runner || (await getDb());
  const rows = await all(db, `
    SELECT st.*
    FROM salon_staff st
    WHERE st.salon_user_id = $1
    ORDER BY st.id
  `, [salonUserId]);

  // resolveArtistUserForStaff can run an unindexed phone-matching scan for
  // any staff member not yet linked to an artist account -- independent
  // per row, so resolve (and self-heal artist_user_id) for every row
  // concurrently instead of one at a time.
  const result = await Promise.all(rows.map(async (row) => {
    if (row.is_owner) return decorateOwnerStaff(row, db);
    const artist = await resolveArtistUserForStaff(row, db);
    if (artist?.id && !row.artist_user_id) {
      await run(db, `
        UPDATE salon_staff
        SET artist_user_id = $1, updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND salon_user_id = $3
      `, [artist.id, row.id, salonUserId]);
    }
    const staffAvatarUrl = artistAvatarUrl(artist);
    return {
      ...row,
      artist_user_id: artist?.id || row.artist_user_id || null,
      // The artist's own field of activity wins over whatever the salon typed in an invite.
      role: artist?.service || row.role,
      avatar: staffAvatarUrl,
      staff_avatar: staffAvatarUrl,
      artist_name: artist?.name || row.name || "",
      artist_area: artist?.area || "",
      artist_bio: artist?.bio || row.bio || "",
      artist_service: artist?.service || "",
      artist_phone: artist?.phone || row.phone || "",
      has_artist_profile: Boolean(artist?.id)
    };
  }));
  return result;
}

async function resolveArtistUserForStaff(staff, runner = null) {
  // The manager's own row is the salon account itself, never an artist found by phone/name.
  if (!staff || staff.is_owner) return null;
  const db = runner || (await getDb());

  if (staff.artist_user_id) {
    const linked = await get(db, `
      SELECT id, name, phone, area, service, (avatar <> '' OR avatar_url IS NOT NULL) AS avatar, bio, type
      FROM users WHERE id = $1 AND type = 'artist'
      LIMIT 1
    `, [staff.artist_user_id]);
    if (linked) return linked;
  }

  const rawPhone = String(staff.phone || "").trim();
  const phone = normalizePhone(rawPhone);
  if (phone) {
    // users.phone is already normalized (Persian/Arabic digits -> ASCII) at
    // write time in app/api/auth/register/route.js, so a plain equality
    // check is correct here and, unlike a REPLACE()-wrapped comparison,
    // can use the column's own UNIQUE index.
    const byPhone = await get(db, `
      SELECT id, name, phone, area, service, (avatar <> '' OR avatar_url IS NOT NULL) AS avatar, bio, type
      FROM users
      WHERE type = 'artist' AND phone = $1
      LIMIT 1
    `, [phone]);
    if (byPhone) return byPhone;
  }

  const name = String(staff.name || "").trim();
  if (!name) return null;
  return get(db, `
    SELECT id, name, phone, area, service, (avatar <> '' OR avatar_url IS NOT NULL) AS avatar, bio, type
    FROM users
    WHERE type = 'artist' AND name = $1
    LIMIT 1
  `, [name]);
}

let ownerColumnReady;
/** The is_owner column (migration 027), also added on first use so the feature works before the migration is run. */
function ensureOwnerColumn() {
  ownerColumnReady ??= (async () => {
    const db = await getDb();
    await run(db, "ALTER TABLE salon_staff ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT FALSE");
    await run(db, "CREATE UNIQUE INDEX IF NOT EXISTS salon_staff_one_owner ON salon_staff (salon_user_id) WHERE is_owner");
  })().catch((error) => {
    ownerColumnReady = undefined;
    throw error;
  });
  return ownerColumnReady;
}

async function decorateOwnerStaff(row, db) {
  const salon = await get(db, "SELECT id, (avatar <> '' OR avatar_url IS NOT NULL) AS avatar FROM users WHERE id = $1", [row.salon_user_id]);
  const avatar = artistAvatarUrl(salon);
  return {
    ...row,
    is_owner: true,
    artist_user_id: null,
    avatar,
    staff_avatar: avatar,
    artist_name: row.name || "",
    artist_area: "",
    artist_bio: row.bio || "",
    artist_service: "",
    artist_phone: row.phone || "",
    has_artist_profile: false
  };
}

/** The manager's own team row, or null when they don't work in the salon themselves. */
export async function getSalonOwnerStaff(salonUserId, runner = null) {
  await ensureOwnerColumn();
  const db = runner || (await getDb());
  const row = await get(db, "SELECT * FROM salon_staff WHERE salon_user_id = $1 AND is_owner LIMIT 1", [salonUserId]);
  return row ? decorateOwnerStaff(row, db) : null;
}

/**
 * Puts the manager on their own team (or updates that row). Names are how bookings point at a team
 * member, so the name must not be taken by another member. Returns { ok, person } or { ok: false, error }.
 */
export async function upsertSalonOwnerStaff(salonUserId, { name, role } = {}) {
  await ensureOwnerColumn();
  const db = await getDb();
  const nextName = String(name || "").trim();
  if (!nextName) return { ok: false, error: "نامت را برای نمایش در تیم وارد کن." };
  const current = await get(db, "SELECT * FROM salon_staff WHERE salon_user_id = $1 AND is_owner LIMIT 1", [salonUserId]);
  const clash = await get(db, `
    SELECT id FROM salon_staff WHERE salon_user_id = $1 AND name = $2 AND NOT is_owner LIMIT 1
  `, [salonUserId, nextName]);
  if (clash) return { ok: false, error: "یکی از اعضای تیم همین نام را دارد؛ نام دیگری انتخاب کن." };
  const nextRole = role == null ? (current?.role || "") : String(role).trim();
  if (current) {
    await run(db, `
      UPDATE salon_staff SET name = $1, role = $2, state = CASE WHEN state = '' THEN 'فعال' ELSE state END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [nextName, nextRole, current.id]);
    // Existing bookings point at the member by name: keep them on the renamed member.
    if (current.name && current.name !== nextName) {
      await run(db, "UPDATE salon_bookings SET staff = $1 WHERE salon_user_id = $2 AND staff = $3", [nextName, salonUserId, current.name]);
    }
  } else {
    await run(db, `
      INSERT INTO salon_staff (salon_user_id, artist_user_id, name, role, state, access_level, is_owner)
      VALUES ($1, NULL, $2, $3, 'فعال', 'مدیر', TRUE)
    `, [salonUserId, nextName, nextRole]);
  }
  return { ok: true, person: await getSalonOwnerStaff(salonUserId, db) };
}

export async function findSalonStaffForBooking(salonUserId, staffName, serviceName = "", runner = null) {
  const db = runner || (await getDb());
  const name = String(staffName || "").trim();
  const service = String(serviceName || "").trim();
  let row = name
    ? await get(db, `
      SELECT * FROM salon_staff
      WHERE salon_user_id = $1 AND name = $2
      LIMIT 1
    `, [salonUserId, name])
    : null;
  if (!row && service) {
    row = await get(db, `
      SELECT st.*
      FROM salon_services sv
      JOIN salon_staff st
        ON st.id = sv.staff_id AND st.salon_user_id = sv.salon_user_id
      WHERE sv.salon_user_id = $1 AND sv.name = $2
      LIMIT 1
    `, [salonUserId, service]) || null;
  }
  if (!row && service) {
    row = await get(db, `
      SELECT *
      FROM salon_staff
      WHERE salon_user_id = $1
        AND artist_user_id IS NOT NULL
        AND (role = $2 OR bio LIKE $3)
      ORDER BY id DESC
      LIMIT 1
    `, [salonUserId, service, `%${service}%`]) || null;
  }
  if (!row) return null;
  const artist = await resolveArtistUserForStaff(row, db);
  if (artist?.id && !row.artist_user_id) {
    await run(db, `
      UPDATE salon_staff
      SET artist_user_id = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND salon_user_id = $3
    `, [artist.id, row.id, salonUserId]);
  }
  return {
    ...row,
    artist_user_id: artist?.id || row.artist_user_id || null,
    avatar: artistAvatarUrl(artist),
    staff_avatar: artistAvatarUrl(artist)
  };
}

export async function addSalonStaff(salonUserId, data) {
  const db = await getDb();
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
  const resolvedArtist = await resolveArtistUserForStaff(draft, db);
  const artistUserId = draft.artist_user_id || resolvedArtist?.id || null;
  const info = await run(db, `
    INSERT INTO salon_staff
      (salon_user_id, artist_user_id, name, phone, role, bio, booked, state, access_level)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id
  `, [
    salonUserId,
    artistUserId,
    draft.name,
    draft.phone,
    draft.role,
    draft.bio,
    draft.booked,
    draft.state,
    draft.access_level
  ]);
  const created = await get(db, "SELECT * FROM salon_staff WHERE id = $1", [Number(info.rows[0].id)]);
  const artist = await resolveArtistUserForStaff(created, db);
  return {
    ...created,
    artist_user_id: artist?.id || created.artist_user_id || null,
    avatar: artistAvatarUrl(artist),
    staff_avatar: artistAvatarUrl(artist),
    artist_name: artist?.name || created.name || "",
    artist_area: artist?.area || "",
    artist_bio: artist?.bio || created.bio || "",
    artist_service: artist?.service || "",
    artist_phone: artist?.phone || created.phone || "",
    has_artist_profile: Boolean(artist?.id)
  };
}

export async function addSalonStaffFromCollab(salonUserId, collab) {
  const db = await getDb();
  const artistId = Number(collab?.artistId || collab?.artist_user_id || 0) || null;
  const artistName = collab?.artistName || collab?.artist_name || "آرتیست frfro";
  const role = collab?.service || collab?.artistService || "همکار سالن";
  const existing = artistId
    ? await get(db, "SELECT * FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2 LIMIT 1", [salonUserId, artistId])
    : await get(db, "SELECT * FROM salon_staff WHERE salon_user_id = $1 AND name = $2 AND role = $3 LIMIT 1", [salonUserId, artistName, role]);
  const bio = [
    "افزوده‌شده از پیشنهاد همکاری",
    collab?.days ? `روزها: ${collab.days}` : "",
    collab?.from && collab?.to ? `ساعت: ${collab.from} تا ${collab.to}` : "",
    collab?.share ? `سهم آرتیست: ${collab.share}٪` : ""
  ].filter(Boolean).join(" · ");

  if (existing) {
    await run(db, `
      UPDATE salon_staff
      SET state = $1, access_level = $2, bio = COALESCE(NULLIF(bio, ''), $3), updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND salon_user_id = $5
    `, ["فعال", "همکار", bio, existing.id, salonUserId]);
    return { person: await get(db, "SELECT * FROM salon_staff WHERE id = $1", [existing.id]), created: false };
  }

  return {
    person: await addSalonStaff(salonUserId, {
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

export async function updateSalonStaff(id, salonUserId, data) {
  const db = await getDb();
  const current = await get(db, "SELECT * FROM salon_staff WHERE id = $1 AND salon_user_id = $2", [id, salonUserId]);
  if (!current) return null;
  if (current.is_owner) {
    // The manager's own row: name/specialty go through the same checks as joining the team.
    if (data.name != null || data.role != null) {
      const result = await upsertSalonOwnerStaff(salonUserId, { name: data.name ?? current.name, role: data.role ?? current.role });
      if (!result.ok) return { error: result.error };
    }
    if (data.state != null || data.phone != null) {
      await run(db, `
        UPDATE salon_staff SET state = $1, phone = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3
      `, [data.state ?? current.state, data.phone ?? current.phone, current.id]);
    }
    return getSalonOwnerStaff(salonUserId, db);
  }
  // A member linked to a real artist account owns their own identity and field of
  // activity (name, phone, bio, specialty come from the artist's profile); the salon
  // may only change what is genuinely the salon's: state, access level, booking tally.
  const linked = Boolean(current.artist_user_id);
  const nextDraft = {
    artist_user_id: linked ? current.artist_user_id : (data.artistUserId ?? data.artist_user_id ?? current.artist_user_id),
    name: linked ? current.name : (data.name ?? current.name),
    phone: linked ? current.phone : (data.phone ?? current.phone),
    role: linked ? current.role : (data.role ?? current.role),
    bio: linked ? current.bio : (data.bio ?? current.bio),
    booked: data.booked ?? current.booked,
    state: data.state ?? current.state,
    access_level: data.accessLevel ?? data.access_level ?? current.access_level
  };
  const resolvedArtist = await resolveArtistUserForStaff(nextDraft, db);
  const artistUserId = nextDraft.artist_user_id || resolvedArtist?.id || null;
  await run(db, `
    UPDATE salon_staff SET
      artist_user_id = $1, name = $2, phone = $3, role = $4, bio = $5, booked = $6, state = $7, access_level = $8, updated_at = CURRENT_TIMESTAMP
    WHERE id = $9 AND salon_user_id = $10
  `, [
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
  ]);
  const updated = await get(db, "SELECT * FROM salon_staff WHERE id = $1", [id]);
  const artist = await resolveArtistUserForStaff(updated, db);
  return {
    ...updated,
    role: artist?.service || updated.role,
    artist_user_id: artist?.id || updated.artist_user_id || null,
    avatar: artistAvatarUrl(artist),
    staff_avatar: artistAvatarUrl(artist),
    artist_name: artist?.name || updated.name || "",
    artist_area: artist?.area || "",
    artist_bio: artist?.bio || updated.bio || "",
    artist_service: artist?.service || "",
    artist_phone: artist?.phone || updated.phone || "",
    has_artist_profile: Boolean(artist?.id)
  };
}

export async function deleteSalonStaff(id, salonUserId) {
  const db = await getDb();
  const current = await get(db, "SELECT * FROM salon_staff WHERE id = $1 AND salon_user_id = $2", [id, salonUserId]);
  if (!current) return { ok: false, person: null };
  const result = await run(db, "DELETE FROM salon_staff WHERE id = $1 AND salon_user_id = $2", [id, salonUserId]);
  const ok = result.rowCount > 0;
  // An accepted invite would otherwise block inviting this artist again.
  if (ok && current.artist_user_id) {
    await run(db, `
      UPDATE salon_artist_invites
      SET status = 'لغو شد', updated_at = CURRENT_TIMESTAMP
      WHERE salon_user_id = $1 AND artist_user_id = $2 AND status = 'تایید شد'
    `, [salonUserId, current.artist_user_id]);
  }
  return { ok, person: ok ? current : null };
}
