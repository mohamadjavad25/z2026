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
  if (!staff) return null;
  const db = runner || (await getDb());

  if (staff.artist_user_id) {
    const linked = await get(db, `
      SELECT id, name, phone, area, service, (avatar <> '') AS avatar, bio, type
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
      SELECT id, name, phone, area, service, (avatar <> '') AS avatar, bio, type
      FROM users
      WHERE type = 'artist' AND phone = $1
      LIMIT 1
    `, [phone]);
    if (byPhone) return byPhone;
  }

  const name = String(staff.name || "").trim();
  if (!name) return null;
  return get(db, `
    SELECT id, name, phone, area, service, (avatar <> '') AS avatar, bio, type
    FROM users
    WHERE type = 'artist' AND name = $1
    LIMIT 1
  `, [name]);
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
  const artistName = collab?.artistName || collab?.artist_name || "آرتیست زیبابان";
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
