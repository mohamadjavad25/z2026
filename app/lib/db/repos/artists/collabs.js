/**
 * An artist asking to join a salon's team (artist_collabs): the old free-text proposal and the request from the join
 * page with her own numbers, and the salon's answers to it (accept, decline, answer with its own terms).
 */
import { getDb, withTransaction, all, get, run } from "../../connection.js";
import { checkTerms } from "../teamAgreements.js";
import { getJoinTerms, joinTermsReady } from "../salons/joinTerms.js";
import { addSalonStaffFromCollab, nameTakenInTeam } from "../salons/staff.js";
import { createSalonArtistInvite } from "../salons/invites.js";
import { verifySalonJoinCode } from "../salons/joinLink.js";
import { lockTeamPair, writeAgreedTerms } from "../salons/membership.js";
import { TEAM_URL, notifyConnection } from "../../../connectionNotify.js";

function mapArtistCollab(row) {
  if (!row) return null;
  return {
    id: row.id,
    salonId: row.salon_user_id,
    salonName: row.salon_name,
    salonAvatar: row.salon_avatar && row.salon_user_id ? `/api/media/avatar/${row.salon_user_id}` : "",
    area: row.area,
    service: row.service,
    days: row.days,
    from: row.from_time,
    to: row.to_time,
    share: row.share_percent,
    capacity: row.capacity,
    ownShare: row.own_share_percent ?? null,
    note: row.note || "",
    termsVersion: row.terms_version ?? null,
    expiresAt: row.expires_at || null,
    status: row.status,
    createdAt: row.created_at
  };
}

export async function listArtistCollabs(userId) {
  await expireJoinProposals({ artistUserId: userId });
  const db = await getDb();
  const rows = await all(db, `
    SELECT c.*, (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS salon_avatar
    FROM artist_collabs c
    LEFT JOIN users u ON u.id = c.salon_user_id
    WHERE c.artist_user_id = $1
    ORDER BY c.id DESC
  `, [userId]);
  return rows.map(mapArtistCollab).filter(Boolean);
}

export async function listSalonCollabRequests(salonUserId) {
  await expireJoinProposals({ salonUserId });
  const db = await getDb();
  const rows = await all(db, `
    SELECT
      c.*,
      u.name AS artist_name,
      (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS artist_avatar,
      u.service AS artist_service,
      u.area AS artist_area
    FROM artist_collabs c
    JOIN users u ON u.id = c.artist_user_id
    WHERE c.salon_user_id = $1
    ORDER BY c.id DESC
  `, [salonUserId]);
  // The numbers the salon stands on today (for the «قبل ← بعد» comparison); null until the salon saved its terms.
  const current = await getJoinTerms(salonUserId, db);
  return rows.map((row) => {
    const mapped = mapArtistCollab(row);
    // A request from the join page carries her numbers; `baseTerms` is what the salon stands on now (the card's «قبل»).
    // share_percent is a text column (older free-text proposals); a join-page request always stored a whole number, and
    // the card and the counter form need it as one (as text the card's «بعد» came out empty, 2026-10-30).
    const share = Number.isInteger(Number(mapped.share)) && String(mapped.share).trim() !== "" ? Number(mapped.share) : null;
    const terms = row.terms_version != null
      ? { days: mapped.days, from: mapped.from, to: mapped.to, share, ownShare: mapped.ownShare ?? null, note: mapped.note || "" }
      : null;
    return {
    ...mapped,
    terms,
    baseTerms: terms && current ? { days: current.days, from: current.from, to: current.to, share: current.share, ownShare: current.ownShare ?? null } : null,
    current: current && { days: current.days, from: current.from, to: current.to, share: current.share, ownShare: current.ownShare, version: current.version },
    artistId: row.artist_user_id,
    artistName: row.artist_name || "آرتیست frfro",
    artistAvatar: row.artist_avatar && row.artist_user_id ? `/api/media/avatar/${row.artist_user_id}` : "",
    artistService: row.artist_service || "",
    artistArea: row.artist_area || ""
    };
  });
}

const COLLAB_PENDING = "آماده ارسال";
const COLLAB_ACCEPTED = "تایید شد";
const COLLAB_REJECTED = "رد شد";
const COLLAB_ENDED = "پایان یافت";
const COLLAB_EXPIRED = "منقضی شد";
/** A request from the join page waits this long for the salon's answer, then lapses (owner's decision 2026-10-28). */
export const JOIN_PROPOSAL_DAYS = 7;
export const JOIN_NOTE_MAX = 120;

function cleanText(value, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

/**
 * An artist's collaboration proposal to a salon. Validated server-side: the
 * salon must exist, the artist must not already be on its team, and there must
 * be no live invite or proposal for the same pair (the invite and proposal
 * flows are two doors into the same team, so each checks the other). The status
 * is always "pending" -- only the salon can move it (updateSalonCollabStatus).
 */
export async function addArtistCollab(userId, data) {
  const db = await getDb();
  const salonUserId = Number(data.salonId || data.salon_user_id || 0) || null;
  if (!salonUserId) {
    return { ok: false, error: "این سالن رو پیدا نکردیم.", code: "INVALID_SALON" };
  }
  const salon = await get(db, `
    SELECT u.id, COALESCE(NULLIF(s.name, ''), u.name) AS name, COALESCE(s.area, '') AS area
    FROM users u
    LEFT JOIN salons s ON s.user_id = u.id
    WHERE u.id = $1 AND u.type = 'salon'
  `, [salonUserId]);
  if (!salon) {
    return { ok: false, error: "این سالن رو پیدا نکردیم.", code: "SALON_NOT_FOUND" };
  }

  const alreadyStaff = await get(db, `
    SELECT id FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2 LIMIT 1
  `, [salonUserId, userId]);
  if (alreadyStaff) {
    return { ok: false, error: "تو همین الان توی تیم این سالنی.", code: "ALREADY_STAFF" };
  }

  const pendingInvite = await get(db, `
    SELECT id FROM salon_artist_invites
    WHERE salon_user_id = $1 AND artist_user_id = $2 AND status = 'در انتظار تایید' LIMIT 1
  `, [salonUserId, userId]);
  if (pendingInvite) {
    return {
      ok: false,
      error: "این سالن قبلاً دعوتت کرده؛ توی «همکاری» جوابش رو بده.",
      code: "INVITE_PENDING"
    };
  }

  const pendingProposal = await get(db, `
    SELECT id FROM artist_collabs
    WHERE artist_user_id = $1 AND salon_user_id = $2 AND status = $3 LIMIT 1
  `, [userId, salonUserId, COLLAB_PENDING]);
  if (pendingProposal) {
    return { ok: false, error: "سالن هنوز به پیشنهاد قبلیت جواب نداده.", code: "PENDING_EXISTS" };
  }

  const info = await run(db, `
    INSERT INTO artist_collabs
      (artist_user_id, salon_user_id, salon_name, area, service, days, from_time, to_time, share_percent, capacity, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id
  `, [
    userId,
    salonUserId,
    salon.name || "",
    salon.area || "",
    cleanText(data.service),
    cleanText(data.days, 200),
    cleanText(data.from || data.fromTime || data.from_time, 12),
    cleanText(data.to || data.toTime || data.to_time, 12),
    cleanText(data.share || data.sharePercent || data.share_percent, 12),
    cleanText(data.capacity, 12),
    COLLAB_PENDING
  ]);
  const row = await get(db, `
    SELECT c.*, (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS salon_avatar
    FROM artist_collabs c
    LEFT JOIN users u ON u.id = c.salon_user_id
    WHERE c.id = $1
  `, [Number(info.rows[0].id)]);
  return { ok: true, collab: mapArtistCollab(row) };
}

export async function deleteArtistCollab(id, userId) {
  const db = await getDb();
  const result = await run(db, "DELETE FROM artist_collabs WHERE id = $1 AND artist_user_id = $2", [id, userId]);
  return result.rowCount > 0;
}

// Only forward moves: a pending proposal is accepted or declined, an accepted
// collaboration can later be ended. Anything else (re-accepting a declined one,
// "accepting" an ended one) is refused so a stale screen can't resurrect it.
const COLLAB_TRANSITIONS = {
  [COLLAB_PENDING]: new Set([COLLAB_ACCEPTED, COLLAB_REJECTED]),
  [COLLAB_ACCEPTED]: new Set([COLLAB_ENDED])
};

export async function updateSalonCollabStatus(id, salonUserId, status) {
  const db = await getDb();
  await expireJoinProposals({ salonUserId });
  const current = await get(db, `
    SELECT status FROM artist_collabs WHERE id = $1 AND salon_user_id = $2
  `, [id, salonUserId]);
  if (!current) return { ok: false, code: "NOT_FOUND", error: "این پیشنهاد رو پیدا نکردیم." };
  if (current.status === COLLAB_EXPIRED) {
    return { ok: false, code: "EXPIRED", error: "این پیشنهاد منقضی شده؛ از آرتیست بخواه دوباره بفرسته." };
  }
  if (!COLLAB_TRANSITIONS[current.status]?.has(status)) {
    return { ok: false, code: "INVALID_TRANSITION", error: "این پیشنهاد دیگه عوض نمی‌شه." };
  }
  // Guarded by the status just read: if the artist joined (or another tap answered) in between, nothing is overwritten.
  const moved = await run(db, `
    UPDATE artist_collabs
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND salon_user_id = $3 AND status = $4
  `, [status, id, salonUserId, current.status]);
  if (!moved.rowCount) return { ok: false, code: "INVALID_TRANSITION", error: "این پیشنهاد دیگه عوض نمی‌شه." };
  const rows = await listSalonCollabRequests(salonUserId);
  return { ok: true, collab: rows.find((item) => Number(item.id) === Number(id)) || null };
}

/**
 * Lazy expiry (no background job): a request from the join page whose 7 days passed becomes «منقضی شد» the first time
 * anyone reads or answers it, and its artist is told once (the UPDATE returns each row exactly once). Old proposals
 * without `expires_at` never lapse. Call it outside a transaction, the push goes out straight away.
 */
export async function expireJoinProposals({ artistUserId = null, salonUserId = null } = {}) {
  const db = await getDb();
  const rows = (await run(db, `
    UPDATE artist_collabs SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE status = $2 AND expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP
      AND ($3::int IS NULL OR artist_user_id = $3) AND ($4::int IS NULL OR salon_user_id = $4)
    RETURNING artist_user_id, salon_name
  `, [COLLAB_EXPIRED, COLLAB_PENDING, artistUserId ? Number(artistUserId) : null, salonUserId ? Number(salonUserId) : null])).rows;
  for (const row of rows) {
    notifyConnection(row.artist_user_id, {
      title: "پیشنهادت بی‌جواب موند",
      body: `${row.salon_name || "سالن"} تا ${JOIN_PROPOSAL_DAYS} روز جواب نداد. اگه خواستی دوباره بفرست.`,
      url: TEAM_URL
    });
  }
  return rows.length;
}

/**
 * The artist's own request from the join page: the salon's terms with her numbers, a short note, expiring in 7 days.
 * Needs the join code (proof she holds the link), the salon's saved terms, and the terms version she read. →
 * { ok: true, collab, salonName } or { ok: false, code, error, terms? }.
 */
export async function createJoinProposal(artistUserId, input) {
  const salonUserId = Number(input.salonUserId || 0);
  if (!salonUserId) return { ok: false, code: "INVALID_SALON", error: "این سالن رو پیدا نکردیم." };
  const note = String(input.note ?? "").trim();
  if (note.length > JOIN_NOTE_MAX) return { ok: false, code: "NOTE_TOO_LONG", error: `یادداشت بلنده؛ تا ${JOIN_NOTE_MAX} حرف بنویس.` };
  await expireJoinProposals({ artistUserId, salonUserId });
  return withTransaction(null, async (tx) => {
    const salon = await get(tx, `
      SELECT u.id, COALESCE(NULLIF(s.name, ''), u.name) AS name, COALESCE(s.area, '') AS area
      FROM users u LEFT JOIN salons s ON s.user_id = u.id
      WHERE u.id = $1 AND u.type = 'salon'
    `, [salonUserId]);
    if (!salon) return { ok: false, code: "SALON_NOT_FOUND", error: "این سالن رو پیدا نکردیم." };
    if (!(await verifySalonJoinCode(salonUserId, input.code, tx))) {
      return { ok: false, code: "INVALID_CODE", error: "این کد کار نمی‌کنه؛ از سالن بخواه دوباره نشونت بده." };
    }
    const artist = await get(tx, "SELECT id, service FROM users WHERE id = $1 AND type = 'artist'", [Number(artistUserId)]);
    if (!artist) return { ok: false, code: "ARTIST_NOT_FOUND", error: "این آرتیست رو پیدا نکردیم." };

    await lockTeamPair(tx, salonUserId, artistUserId);
    if (await get(tx, "SELECT 1 FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2 LIMIT 1", [salonUserId, artistUserId])) {
      return { ok: false, code: "ALREADY_STAFF", error: "تو همین الان توی تیم این سالنی." };
    }
    const terms = await getJoinTerms(salonUserId, tx, { lock: true });
    if (!joinTermsReady(terms)) return { ok: false, code: "TERMS_NOT_READY", error: "این لینک هنوز آماده نیست؛ از سالن بخواه شرایط همکاری رو بذاره." };
    if (!terms.allowProposals) return { ok: false, code: "PROPOSALS_OFF", error: "این سالن پیشنهاد شرایط قبول نمی‌کنه؛ با همین شرایطش بیا توی تیم." };
    if (Number(input.termsVersion) !== terms.version) {
      return { ok: false, code: "TERMS_CHANGED", error: "سالن شرایط رو عوض کرده؛ یه بار دیگه ببین و بعد پیشنهادت رو بفرست.", terms };
    }
    if (await get(tx, "SELECT 1 FROM salon_artist_invites WHERE salon_user_id = $1 AND artist_user_id = $2 AND status = 'در انتظار تایید' LIMIT 1", [salonUserId, artistUserId])) {
      return { ok: false, code: "INVITE_PENDING", error: "این سالن قبلاً دعوتت کرده؛ توی «همکاری» جوابش رو بده." };
    }
    if (await get(tx, "SELECT 1 FROM artist_collabs WHERE salon_user_id = $1 AND artist_user_id = $2 AND status = $3 LIMIT 1", [salonUserId, artistUserId, COLLAB_PENDING])) {
      return { ok: false, code: "PENDING_EXISTS", error: "سالن هنوز به پیشنهاد قبلیت جواب نداده." };
    }
    const checked = await checkTerms(salonUserId, input, tx);
    if (!checked.ok) return { ok: false, code: "INVALID", error: checked.error };
    const { days, from, to, share, ownShare } = checked.value;
    const inserted = await get(tx, `
      INSERT INTO artist_collabs
        (artist_user_id, salon_user_id, salon_name, area, service, days, from_time, to_time, share_percent, own_share_percent, note, terms_version, expires_at, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP + ($13 || ' days')::interval, $14)
      RETURNING id
    `, [Number(artistUserId), salonUserId, salon.name || "", salon.area || "", cleanText(artist.service), days, from, to, String(share), ownShare, note, terms.version, String(JOIN_PROPOSAL_DAYS), COLLAB_PENDING]);
    const row = await get(tx, `
      SELECT c.*, (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS salon_avatar
      FROM artist_collabs c LEFT JOIN users u ON u.id = c.salon_user_id WHERE c.id = $1
    `, [inserted.id]);
    return { ok: true, collab: mapArtistCollab(row), salonName: salon.name || "" };
  });
}

class Refusal extends Error {
  constructor(result) { super(result.code); this.result = result; }
}

/** Runs `fn(tx)` in a transaction; a `throw new Refusal(result)` inside rolls everything back and returns that result. */
async function atomically(fn) {
  try {
    return await withTransaction(null, fn);
  } catch (error) {
    if (error instanceof Refusal) return error.result;
    throw error;
  }
}

/** Locks the pair and the waiting request; → the row, or throws a Refusal (not found / not waiting / lapsed / already on the team). */
async function lockOpenCollab(tx, id, salonUserId) {
  const found = await get(tx, "SELECT artist_user_id FROM artist_collabs WHERE id = $1 AND salon_user_id = $2", [Number(id), Number(salonUserId)]);
  if (!found) throw new Refusal({ ok: false, code: "NOT_FOUND", error: "این پیشنهاد رو پیدا نکردیم." });
  await lockTeamPair(tx, salonUserId, found.artist_user_id);
  const row = await get(tx, "SELECT *, (expires_at IS NOT NULL AND expires_at <= CURRENT_TIMESTAMP) AS lapsed FROM artist_collabs WHERE id = $1 AND salon_user_id = $2 FOR UPDATE", [Number(id), Number(salonUserId)]);
  if (row.status === COLLAB_EXPIRED || (row.status === COLLAB_PENDING && row.lapsed)) {
    throw new Refusal({ ok: false, code: "EXPIRED", error: "این پیشنهاد منقضی شده؛ از آرتیست بخواه دوباره بفرسته." });
  }
  if (row.status !== COLLAB_PENDING) throw new Refusal({ ok: false, code: "INVALID_TRANSITION", error: "این پیشنهاد دیگه عوض نمی‌شه." });
  if (await get(tx, "SELECT 1 FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2 LIMIT 1", [Number(salonUserId), row.artist_user_id])) {
    throw new Refusal({ ok: false, code: "ALREADY_STAFF", error: "این آرتیست همین الان توی تیمته." });
  }
  return row;
}

/**
 * The salon accepts a waiting request: she joins the team and, for a request from the join page, her numbers become the
 * agreed terms (source «proposal») with the rules of this moment. Old-style proposals (free text) only add her to the team.
 * One transaction, so a double tap or a join through the QR at the same moment cannot add her twice.
 */
export async function acceptSalonCollab(id, salonUserId) {
  await expireJoinProposals({ salonUserId });
  const outcome = await atomically(async (tx) => {
    const row = await lockOpenCollab(tx, id, salonUserId);
    const joining = await get(tx, "SELECT name FROM users WHERE id = $1", [row.artist_user_id]);
    if (await nameTakenInTeam(salonUserId, joining?.name, row.artist_user_id, tx)) throw new Refusal({ ok: false, code: "SAME_NAME", error: "یکی با همین اسم توی تیمت هست؛ بهش بگو اسمش رو یه کم فرق بده." });
    const fromJoinPage = row.terms_version !== null;
    let terms = null;
    if (fromJoinPage) {
      // The salon's opening hours may have changed since she asked: never agree to hours the salon is closed in.
      const checked = await checkTerms(salonUserId, { days: row.days, from: row.from_time, to: row.to_time, share: row.share_percent, ownShare: row.own_share_percent }, tx);
      if (!checked.ok) throw new Refusal({ ok: false, code: "TERMS_INVALID", error: `این پیشنهاد دیگه با ساعت سالن جور نیست: ${checked.error} شرایط خودت رو پیشنهاد بده.` });
      terms = checked.value;
    }
    await run(tx, "UPDATE artist_collabs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [COLLAB_ACCEPTED, row.id]);
    const user = await get(tx, "SELECT name, service FROM users WHERE id = $1", [row.artist_user_id]);
    const staffResult = await addSalonStaffFromCollab(salonUserId, {
      artistId: row.artist_user_id,
      artistName: user?.name,
      service: row.service,
      artistService: user?.service,
      days: row.days,
      from: row.from_time,
      to: row.to_time,
      share: row.share_percent
    }, tx);
    if (terms) await writeAgreedTerms(tx, { salonUserId, artistUserId: row.artist_user_id, terms, source: "proposal" });
    return { ok: true, artistUserId: row.artist_user_id, staffResult };
  });
  if (!outcome.ok) return outcome;
  const rows = await listSalonCollabRequests(salonUserId);
  return { ...outcome, collab: rows.find((item) => Number(item.id) === Number(id)) || null };
}

/** The salon says no to a waiting request. */
export async function rejectSalonCollab(id, salonUserId) {
  await expireJoinProposals({ salonUserId });
  const result = await updateSalonCollabStatus(id, salonUserId, COLLAB_REJECTED);
  return result.ok ? { ...result, artistUserId: result.collab?.artistId } : result;
}

/**
 * The salon answers with its own numbers: the request is closed as «رد شد» and a normal invite with the salon's terms goes
 * to the artist (she answers it in «دعوت‌ها»). One transaction: no half state with the request closed and no invite.
 * Note: an invite has no own-share field, so `ownShare` is kept only on the salon's saved terms, not on the invite.
 */
export async function counterSalonCollab(id, salonUserId, input) {
  await expireJoinProposals({ salonUserId });
  const outcome = await atomically(async (tx) => {
    const row = await lockOpenCollab(tx, id, salonUserId);
    const checked = await checkTerms(salonUserId, input, tx);
    if (!checked.ok) throw new Refusal({ ok: false, code: "INVALID", error: checked.error });
    await run(tx, "UPDATE artist_collabs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2", [COLLAB_REJECTED, row.id]);
    const made = await createSalonArtistInvite(salonUserId, {
      artistUserId: row.artist_user_id,
      days: checked.value.days,
      from: checked.value.from,
      to: checked.value.to,
      share: String(checked.value.share)
    }, tx);
    if (!made.ok) throw new Refusal({ ok: false, code: made.code, error: made.error });
    return { ok: true, artistUserId: row.artist_user_id, invite: made.invite };
  });
  if (!outcome.ok) return outcome;
  const rows = await listSalonCollabRequests(salonUserId);
  return { ...outcome, collab: rows.find((item) => Number(item.id) === Number(id)) || null };
}

export async function endSalonCollabsForArtist(salonUserId, artistUserId) {
  const artistId = Number(artistUserId || 0);
  if (!salonUserId || !artistId) return 0;
  const db = await getDb();
  const result = await run(db, `
    UPDATE artist_collabs
    SET status = 'پایان یافت', updated_at = CURRENT_TIMESTAMP
    WHERE salon_user_id = $1
      AND artist_user_id = $2
      AND status IN ('تایید شد', 'آماده ارسال')
  `, [salonUserId, artistId]);
  return result.rowCount;
}
