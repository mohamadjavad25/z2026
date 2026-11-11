/** A salon inviting an artist to its team (salon_artist_invites), and the artist's answer. */
import { getDb, all, get, run, withTransaction } from "../../connection.js";
import { checkTerms } from "../teamAgreements.js";
import { toLatinDigits } from "../../../../shared/lib/digits.js";
import { ACCEPTED, CANCELLED, PENDING, REJECTED, lockTeamPair, writeAgreedTerms } from "./membership.js";
import { SAME_NAME_IN_TEAM, addSalonStaff, nameTakenInTeam } from "./staff.js";

function mapSalonInvite(row) {
  if (!row) return null;
  return {
    id: row.id,
    salonId: row.salon_user_id,
    salonName: row.salon_name || "",
    salonAvatar: row.salon_avatar && row.salon_user_id ? `/api/media/avatar/${row.salon_user_id}` : "",
    salonPoster: row.salon_poster && row.salon_user_id ? `/api/media/poster/${row.salon_user_id}` : "",
    salonPosterPosition: row.salon_poster_position || "",
    salonArea: row.salon_area || "",
    salonRules: row.salon_rules || "",
    artistId: row.artist_user_id,
    artistName: row.artist_name || "آرتیست frfro",
    artistAvatar: row.artist_avatar && row.artist_user_id ? `/api/media/avatar/${row.artist_user_id}` : "",
    artistService: row.artist_service || "",
    artistArea: row.artist_area || "",
    artistPhone: row.artist_phone || "",
    role: row.role || "",
    bio: row.bio || "",
    accessLevel: row.access_level || "همکار",
    days: row.days || "",
    from: row.from_time || "",
    to: row.to_time || "",
    share: row.share_percent || "",
    capacity: row.capacity || "",
    status: row.status || PENDING,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function listSalonArtistInvites(salonUserId, { status } = {}) {
  const db = await getDb();
  const rows = status
    ? await all(db, `
        SELECT
          i.*,
          u.name AS artist_name,
          (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS artist_avatar,
          u.service AS artist_service,
          u.area AS artist_area,
          u.phone AS artist_phone,
          s.name AS salon_name,
          (salon_user.avatar <> '' OR salon_user.avatar_url IS NOT NULL) AS salon_avatar,
          (salon_user.poster <> '' OR salon_user.poster_url IS NOT NULL) AS salon_poster, salon_user.poster_position AS salon_poster_position,
          s.area AS salon_area,
          s.rules AS salon_rules
        FROM salon_artist_invites i
        JOIN users u ON u.id = i.artist_user_id
        LEFT JOIN salons s ON s.user_id = i.salon_user_id
        LEFT JOIN users salon_user ON salon_user.id = i.salon_user_id
        WHERE i.salon_user_id = $1 AND i.status = $2
        ORDER BY i.id DESC
      `, [salonUserId, status])
    : await all(db, `
        SELECT
          i.*,
          u.name AS artist_name,
          (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS artist_avatar,
          u.service AS artist_service,
          u.area AS artist_area,
          u.phone AS artist_phone,
          s.name AS salon_name,
          (salon_user.avatar <> '' OR salon_user.avatar_url IS NOT NULL) AS salon_avatar,
          (salon_user.poster <> '' OR salon_user.poster_url IS NOT NULL) AS salon_poster, salon_user.poster_position AS salon_poster_position,
          s.area AS salon_area,
          s.rules AS salon_rules
        FROM salon_artist_invites i
        JOIN users u ON u.id = i.artist_user_id
        LEFT JOIN salons s ON s.user_id = i.salon_user_id
        LEFT JOIN users salon_user ON salon_user.id = i.salon_user_id
        WHERE i.salon_user_id = $1
        ORDER BY i.id DESC
      `, [salonUserId]);
  return rows.map(mapSalonInvite).filter(Boolean);
}

export async function listArtistSalonInvites(artistUserId, { status } = {}) {
  const db = await getDb();
  const rows = status
    ? await all(db, `
        SELECT
          i.*,
          u.name AS artist_name,
          (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS artist_avatar,
          u.service AS artist_service,
          u.area AS artist_area,
          u.phone AS artist_phone,
          s.name AS salon_name,
          (salon_user.avatar <> '' OR salon_user.avatar_url IS NOT NULL) AS salon_avatar,
          (salon_user.poster <> '' OR salon_user.poster_url IS NOT NULL) AS salon_poster, salon_user.poster_position AS salon_poster_position,
          s.area AS salon_area,
          s.rules AS salon_rules
        FROM salon_artist_invites i
        JOIN users u ON u.id = i.artist_user_id
        LEFT JOIN salons s ON s.user_id = i.salon_user_id
        LEFT JOIN users salon_user ON salon_user.id = i.salon_user_id
        WHERE i.artist_user_id = $1 AND i.status = $2
        ORDER BY i.id DESC
      `, [artistUserId, status])
    : await all(db, `
        SELECT
          i.*,
          u.name AS artist_name,
          (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS artist_avatar,
          u.service AS artist_service,
          u.area AS artist_area,
          u.phone AS artist_phone,
          s.name AS salon_name,
          (salon_user.avatar <> '' OR salon_user.avatar_url IS NOT NULL) AS salon_avatar,
          (salon_user.poster <> '' OR salon_user.poster_url IS NOT NULL) AS salon_poster, salon_user.poster_position AS salon_poster_position,
          s.area AS salon_area,
          s.rules AS salon_rules
        FROM salon_artist_invites i
        JOIN users u ON u.id = i.artist_user_id
        LEFT JOIN salons s ON s.user_id = i.salon_user_id
        LEFT JOIN users salon_user ON salon_user.id = i.salon_user_id
        WHERE i.artist_user_id = $1
        ORDER BY i.id DESC
      `, [artistUserId]);
  return rows.map(mapSalonInvite).filter(Boolean);
}

export async function countPendingArtistInvites(artistUserId) {
  const db = await getDb();
  const row = await get(db, `
    SELECT COUNT(*) AS count
    FROM salon_artist_invites
    WHERE artist_user_id = $1 AND status = $2
  `, [artistUserId, PENDING]);
  return Number(row?.count || 0);
}

async function getInviteRow(id, runner = null) {
  const db = runner || (await getDb());
  return get(db, `
    SELECT
      i.*,
      u.name AS artist_name,
      (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS artist_avatar,
      u.service AS artist_service,
      u.area AS artist_area,
      u.phone AS artist_phone,
      s.name AS salon_name,
      (salon_user.avatar <> '' OR salon_user.avatar_url IS NOT NULL) AS salon_avatar,
      (salon_user.poster <> '' OR salon_user.poster_url IS NOT NULL) AS salon_poster, salon_user.poster_position AS salon_poster_position,
      s.area AS salon_area,
          s.rules AS salon_rules
    FROM salon_artist_invites i
    JOIN users u ON u.id = i.artist_user_id
    LEFT JOIN salons s ON s.user_id = i.salon_user_id
    LEFT JOIN users salon_user ON salon_user.id = i.salon_user_id
    WHERE i.id = $1
  `, [id]);
}

export async function createSalonArtistInvite(salonUserId, data, runner = null) {
  const db = runner || (await getDb());
  const artistUserId = Number(data.artistUserId || data.artist_user_id || 0);
  if (!artistUserId) {
    return { ok: false, error: "این آرتیست رو پیدا نکردیم.", code: "INVALID_ARTIST" };
  }

  const artist = await get(db, `
    SELECT id, name, phone, area, service, avatar, type
    FROM users WHERE id = $1 AND type = 'artist' LIMIT 1
  `, [artistUserId]);
  if (!artist) {
    return { ok: false, error: "این آرتیست رو پیدا نکردیم.", code: "ARTIST_NOT_FOUND" };
  }

  const alreadyStaff = await get(db, `
    SELECT id FROM salon_staff
    WHERE salon_user_id = $1 AND artist_user_id = $2
    LIMIT 1
  `, [salonUserId, artistUserId]);
  if (alreadyStaff) {
    return { ok: false, error: "این آرتیست همین الان توی تیمته.", code: "ALREADY_STAFF" };
  }

  // The artist already proposed to this salon: answering that proposal is the
  // right move (otherwise the pair would have two live requests at once).
  const pendingProposal = await get(db, `
    SELECT id FROM artist_collabs
    WHERE salon_user_id = $1 AND artist_user_id = $2 AND status = 'آماده ارسال' LIMIT 1
  `, [salonUserId, artistUserId]);
  if (pendingProposal) {
    return {
      ok: false,
      error: "این آرتیست خودش پیشنهاد همکاری فرستاده؛ از «درخواست‌ها» جوابش رو بده.",
      code: "PROPOSAL_PENDING"
    };
  }

  const role = data.role || artist.service || "آرتیست";
  const bio = data.bio || artist.area || "دعوت‌شده از آرتیست‌های نزدیک";
  const accessLevel = data.accessLevel || data.access_level || "همکار";
  const days = data.days || "";
  const fromTime = data.from || data.fromTime || data.from_time || "";
  const toTime = data.to || data.toTime || data.to_time || "";
  const sharePercent = data.share || data.sharePercent || data.share_percent || "";
  const capacity = data.capacity || "";
  // An invite that carries terms (the salon changed them for this artist) is judged like every terms change:
  // real days, hours inside the salon's open hours, a percent between 0 and 100.
  if (days || fromTime || toTime || sharePercent !== "") {
    const checked = await checkTerms(salonUserId, { days, from: fromTime, to: toTime, share: sharePercent }, db);
    if (!checked.ok) return { ok: false, error: checked.error, code: "INVALID_TERMS" };
  }

  // Atomic insert-or-detect-conflict, same fix as toggleFollow/toggleSave
  // (app/lib/db/repos/social.js): the old code did SELECT existing, branch,
  // THEN INSERT -- so two truly concurrent requests for the same (salon,
  // artist) pair could both pass the "no existing row" check before
  // either committed, both attempt the INSERT, and the loser crash with a
  // raw, unhandled Postgres 23505 unique-violation instead of a
  // structured response. ON CONFLICT DO NOTHING means at most one
  // concurrent INSERT ever wins; salon_artist_invites' own
  // UNIQUE(salon_user_id, artist_user_id) constraint (migrations/001_baseline.sql)
  // is what backs this.
  const inserted = await run(db, `
    INSERT INTO salon_artist_invites
      (salon_user_id, artist_user_id, role, bio, access_level, days, from_time, to_time, share_percent, capacity, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (salon_user_id, artist_user_id) DO NOTHING
    RETURNING id
  `, [salonUserId, artistUserId, role, bio, accessLevel, days, fromTime, toTime, sharePercent, capacity, PENDING]);

  if (inserted.rows[0]) {
    return {
      ok: true,
      invite: mapSalonInvite(await getInviteRow(Number(inserted.rows[0].id), db)),
      created: true
    };
  }

  // Conflict happened -- a row already exists (from before, or from a
  // concurrent request that just won the race above). Re-fetch it now
  // that it's guaranteed to exist, and branch exactly as before.
  const existing = await get(db, `
    SELECT * FROM salon_artist_invites
    WHERE salon_user_id = $1 AND artist_user_id = $2
    LIMIT 1
  `, [salonUserId, artistUserId]);

  if (existing.status === PENDING) {
    return {
      ok: false,
      error: "آرتیست هنوز به دعوت قبلیت جواب نداده.",
      code: "PENDING_EXISTS",
      invite: mapSalonInvite(await getInviteRow(existing.id, db))
    };
  }
  if (existing.status === ACCEPTED) {
    return { ok: false, error: "این آرتیست قبلاً دعوتت رو قبول کرده.", code: "ALREADY_ACCEPTED" };
  }
  await run(db, `
    UPDATE salon_artist_invites
    SET role = $1, bio = $2, access_level = $3, days = $4, from_time = $5, to_time = $6, share_percent = $7, capacity = $8, status = $9, updated_at = CURRENT_TIMESTAMP
    WHERE id = $10
  `, [role, bio, accessLevel, days, fromTime, toTime, sharePercent, capacity, PENDING, existing.id]);
  return { ok: true, invite: mapSalonInvite(await getInviteRow(existing.id, db)), created: false };
}

export async function cancelSalonArtistInvite(id, salonUserId) {
  const db = await getDb();
  const current = await get(db, `
    SELECT * FROM salon_artist_invites
    WHERE id = $1 AND salon_user_id = $2
  `, [id, salonUserId]);
  if (!current) return null;
  if (current.status !== PENDING) {
    return mapSalonInvite(await getInviteRow(id, db));
  }
  await run(db, `
    UPDATE salon_artist_invites
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND salon_user_id = $3
  `, [CANCELLED, id, salonUserId]);
  return mapSalonInvite(await getInviteRow(id, db));
}

export async function respondArtistSalonInvite(id, artistUserId, status) {
  const db = await getDb();
  const allowed = new Set([ACCEPTED, REJECTED]);
  const nextStatus = allowed.has(status) ? status : null;
  if (!nextStatus) {
    return { ok: false, error: "این جواب رو نفهمیدیم؛ دوباره بزن.", code: "INVALID_STATUS" };
  }

  const found = await get(db, `
    SELECT salon_user_id FROM salon_artist_invites
    WHERE id = $1 AND artist_user_id = $2
  `, [id, artistUserId]);
  if (!found) {
    return { ok: false, error: "این دعوت رو پیدا نکردیم.", code: "NOT_FOUND" };
  }

  // One transaction behind the same pair lock as joining by the salon's link or QR (HEALTH debt 10, 2026-11-08): two
  // taps of «قبول», or a tap while the same artist scans the salon's code, cannot both see «still waiting» or «not on
  // the team yet» and add the artist twice. The answer is written only while the invite is still waiting.
  const outcome = await withTransaction(null, async (tx) => {
    await lockTeamPair(tx, found.salon_user_id, artistUserId);
    const current = await get(tx, `
      SELECT * FROM salon_artist_invites
      WHERE id = $1 AND artist_user_id = $2
      FOR UPDATE
    `, [id, artistUserId]);
    if (!current) return { notFound: true };
    if (current.status !== PENDING) return { notPending: true };
    if (nextStatus === ACCEPTED) {
      const joining = await get(tx, "SELECT name FROM users WHERE id = $1", [artistUserId]);
      if (await nameTakenInTeam(current.salon_user_id, joining?.name, artistUserId, tx)) return { sameName: true };
    }

    const answered = await run(tx, `
      UPDATE salon_artist_invites
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND artist_user_id = $3 AND status = $4
    `, [nextStatus, id, artistUserId, PENDING]);
    if (!answered.rowCount) return { notPending: true };

    if (nextStatus !== ACCEPTED) return { staffPerson: null, staffCreated: false };

    const invite = mapSalonInvite(await getInviteRow(id, tx));
    const termsBio = [
      current.bio || "دعوت تایید‌شده توسط آرتیست",
      current.days ? `روزها: ${current.days}` : "",
      current.from_time && current.to_time ? `ساعت: ${current.from_time} تا ${current.to_time}` : "",
      current.share_percent ? `سهم آرتیست: ${current.share_percent}٪` : "",
      current.capacity ? `ظرفیت روزانه: ${current.capacity}` : ""
    ].filter(Boolean).join(" · ");

    const existingStaff = await get(tx, `
      SELECT * FROM salon_staff
      WHERE salon_user_id = $1 AND artist_user_id = $2
      LIMIT 1
    `, [current.salon_user_id, current.artist_user_id]);

    let staffPerson;
    let staffCreated;
    if (existingStaff) {
      await run(tx, `
        UPDATE salon_staff
        SET state = $1, access_level = $2, role = COALESCE(NULLIF($3, ''), role), bio = $4, updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
      `, ["فعال", current.access_level || "همکار", current.role || "", termsBio, existingStaff.id]);
      staffPerson = await get(tx, "SELECT * FROM salon_staff WHERE id = $1", [existingStaff.id]);
      staffCreated = false;
    } else {
      staffPerson = await addSalonStaff(current.salon_user_id, {
        artist_user_id: current.artist_user_id,
        name: invite.artistName,
        phone: invite.artistPhone || "",
        role: current.role || invite.artistService || "آرتیست",
        bio: termsBio,
        booked: "۰ وقت",
        state: "فعال",
        access_level: current.access_level || "همکار"
      }, tx);
      staffCreated = true;
    }
    // The terms the salon put on this invite are what the artist agreed to: they are the team's first «agreed» row,
    // so a later change is proposed against them (same as joining by the salon's link). Older invites carry no terms.
    if (current.days && current.from_time && current.to_time && current.share_percent !== null && current.share_percent !== "") {
      await writeAgreedTerms(tx, {
        salonUserId: current.salon_user_id,
        artistUserId: current.artist_user_id,
        terms: { days: current.days, from: toLatinDigits(current.from_time), to: toLatinDigits(current.to_time), share: Number(toLatinDigits(String(current.share_percent))), ownShare: null },
        source: "invite"
      });
    }
    return { staffPerson, staffCreated };
  });

  if (outcome.sameName) return { ok: false, error: SAME_NAME_IN_TEAM, code: "SAME_NAME" };
  if (outcome.notFound) {
    return { ok: false, error: "این دعوت رو پیدا نکردیم.", code: "NOT_FOUND" };
  }
  if (outcome.notPending) {
    return {
      ok: false,
      error: "این دعوت دیگه جواب نمی‌گیره.",
      code: "NOT_PENDING",
      invite: mapSalonInvite(await getInviteRow(id, db))
    };
  }
  return {
    ok: true,
    invite: mapSalonInvite(await getInviteRow(id, db)),
    staffPerson: outcome.staffPerson,
    staffCreated: outcome.staffCreated,
    invites: await listArtistSalonInvites(artistUserId)
  };
}
