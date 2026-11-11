/** Joining a salon's team through its own link or QR: the secret in the link, the public preview, and the join itself. */
import { randomBytes, timingSafeEqual } from "node:crypto";
import { getDb, get, run, withTransaction } from "../../connection.js";
import { getJoinTerms, joinTermsReady } from "./joinTerms.js";
import { ACCEPTED, lockTeamPair, writeAgreedTerms } from "./membership.js";
import { SAME_NAME_IN_TEAM, addSalonStaff, nameTakenInTeam } from "./staff.js";

/**
 * Self-service join via the salon's QR/link (app/join-salon/[id]) — the
 * artist is the one acting (scanned the code themselves), so unlike
 * createSalonArtistInvite this skips the PENDING step entirely and lands
 * straight on ACCEPTED + a real salon_staff row. The trust signal is `code`:
 * a per-salon secret embedded in the QR/link's URL (see
 * getOrCreateSalonJoinSecret), checked in constant time below — the salon's
 * user id alone is a small, public, sequential number (same /salons/<id> as
 * its public profile) and proves nothing on its own. The salon can still
 * remove the person from پرسنل afterward like any other staff row if this
 * was a mistake, and can invalidate the link for good by regenerating its
 * join code from the invite sheet.
 */
export async function joinSalonByArtist(salonUserId, artistUserId, code, { termsVersion } = {}) {
  const db = await getDb();
  const salon = await get(db, `
    SELECT s.name, s.area, us.settings ->> 'salonJoinCode' AS join_secret
    FROM salons s
    LEFT JOIN user_settings us ON us.user_id = s.user_id
    WHERE s.user_id = $1
  `, [salonUserId]);
  if (!salon) {
    return { ok: false, error: "این سالن رو پیدا نکردیم.", code: "SALON_NOT_FOUND" };
  }
  if (!secretsMatch(salon.join_secret, code)) {
    return { ok: false, error: "این کد کار نمی‌کنه؛ از سالن بخواه دوباره نشونت بده.", code: "INVALID_CODE" };
  }

  const artist = await get(db, `
    SELECT id, name, phone, area, service FROM users WHERE id = $1 AND type = 'artist' LIMIT 1
  `, [artistUserId]);
  if (!artist) {
    return { ok: false, error: "این آرتیست رو پیدا نکردیم.", code: "ARTIST_NOT_FOUND" };
  }

  const role = artist.service || "آرتیست";
  const bio = "پیوستن با اسکن کد QR سالن";

  // Everything below is one transaction behind a lock on the pair: two taps (or two phones) of the same artist cannot both
  // pass «not on the team yet» and add her twice, and the terms she agrees to are read under a share lock, so a salon
  // saving new numbers at that moment waits and the artist either agrees to the old ones (still her version) or is refused.
  return withTransaction(null, async (tx) => {
    await lockTeamPair(tx, salonUserId, artistUserId);

    const alreadyStaff = await get(tx, `
      SELECT id FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2 LIMIT 1
    `, [salonUserId, artistUserId]);
    if (alreadyStaff) {
      return { ok: false, error: "تو همین الان توی تیم این سالنی.", code: "ALREADY_STAFF" };
    }

    if (await nameTakenInTeam(salonUserId, artist.name, artistUserId, tx)) {
      return { ok: false, error: SAME_NAME_IN_TEAM, code: "SAME_NAME" };
    }

    const terms = await getJoinTerms(salonUserId, tx, { lock: true });
    if (!joinTermsReady(terms)) {
      return { ok: false, error: "این لینک هنوز آماده نیست؛ از سالن بخواه شرایط همکاری رو بذاره.", code: "TERMS_NOT_READY" };
    }
    if (Number(termsVersion) !== terms.version) {
      return { ok: false, error: "سالن شرایط رو عوض کرده؛ یه بار دیگه ببین و بعد بپیوند.", code: "TERMS_CHANGED", terms };
    }

    const existingInvite = await get(tx, `
      SELECT id FROM salon_artist_invites WHERE salon_user_id = $1 AND artist_user_id = $2 LIMIT 1
    `, [salonUserId, artistUserId]);

    if (existingInvite) {
      await run(tx, `
        UPDATE salon_artist_invites
        SET role = $1, bio = $2, status = $3, days = $5, from_time = $6, to_time = $7, share_percent = $8, updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `, [role, bio, ACCEPTED, existingInvite.id, terms.days, terms.from, terms.to, String(terms.share)]);
    } else {
      await run(tx, `
        INSERT INTO salon_artist_invites
          (salon_user_id, artist_user_id, role, bio, access_level, status, days, from_time, to_time, share_percent)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      `, [salonUserId, artistUserId, role, bio, "همکار", ACCEPTED, terms.days, terms.from, terms.to, String(terms.share)]);
    }

    // Joining answers any proposal this artist had pending with the same salon.
    await run(tx, `
      UPDATE artist_collabs
      SET status = 'تایید شد', updated_at = CURRENT_TIMESTAMP
      WHERE salon_user_id = $1 AND artist_user_id = $2 AND status = 'آماده ارسال'
    `, [salonUserId, artistUserId]);

    const staffPerson = await addSalonStaff(salonUserId, {
      artist_user_id: artistUserId,
      name: artist.name,
      phone: artist.phone || "",
      role,
      bio,
      booked: "۰ وقت",
      state: "فعال",
      access_level: "همکار"
    }, tx);

    await writeAgreedTerms(tx, { salonUserId, artistUserId, terms, source: "join_page" });

    return {
      ok: true,
      staffPerson,
      terms,
      salon: { id: salonUserId, name: salon.name || "سالن", area: salon.area || "" }
    };
  });
}

/** True when `code` is the salon's join secret (constant time). */
export async function verifySalonJoinCode(salonUserId, code, runner = null) {
  const db = runner || (await getDb());
  const row = await get(db, "SELECT settings ->> 'salonJoinCode' AS secret FROM user_settings WHERE user_id = $1", [Number(salonUserId)]);
  return secretsMatch(row?.secret, code);
}

// Same shape as the client's personal connect secret (app/lib/db/repos/connections.js):
// stored in user_settings JSON under its own key, so no schema change is needed, created
// on first use (race-safe: the first writer wins), and compared in constant time so its
// length/content can't be inferred by timing a guess.
function newSecret() {
  return randomBytes(9).toString("base64url").replace(/[^A-Za-z0-9]/g, "").padEnd(12, "0").slice(0, 12);
}

function secretsMatch(expected, given) {
  const a = Buffer.from(String(expected || ""));
  const b = Buffer.from(String(given || ""));
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

/** The salon's own join-link secret (app/join-salon/[id]?k=<secret>), created on first use. */
export async function getOrCreateSalonJoinSecret(salonUserId) {
  const db = await getDb();
  const row = await get(db, `
    INSERT INTO user_settings (user_id, settings, updated_at)
    VALUES ($1, jsonb_build_object('salonJoinCode', $2::text), CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) DO UPDATE SET
      settings = CASE
        WHEN user_settings.settings ? 'salonJoinCode' THEN user_settings.settings
        ELSE COALESCE(user_settings.settings, '{}'::jsonb) || jsonb_build_object('salonJoinCode', $2::text)
      END
    RETURNING settings ->> 'salonJoinCode' AS secret
  `, [salonUserId, newSecret()]);
  return row.secret;
}

/** A new code for the salon's QR and link: the old one stops working at once (owner, 2026-11-09). */
export async function renewSalonJoinSecret(salonUserId) {
  const db = await getDb();
  const secret = newSecret();
  await run(db, `
    INSERT INTO user_settings (user_id, settings, updated_at)
    VALUES ($1, jsonb_build_object('salonJoinCode', $2::text), CURRENT_TIMESTAMP)
    ON CONFLICT (user_id) DO UPDATE SET
      settings = COALESCE(user_settings.settings, '{}'::jsonb) || jsonb_build_object('salonJoinCode', $2::text),
      updated_at = CURRENT_TIMESTAMP
  `, [salonUserId, secret]);
  return secret;
}

/** Minimal public preview for the QR-join landing page — no auth, so it
 *  deliberately exposes only name/area/avatar, nothing from getSalon()'s
 *  fuller (owner-facing) shape. Works even if the salon set its public
 *  showcase private — that toggle is about the client-facing storefront,
 *  unrelated to whether staff can join the team. */
export async function getSalonJoinPreview(salonUserId, code = "") {
  const db = await getDb();
  const row = await get(db, `
    SELECT s.user_id, s.name, s.area, s.rules, (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS avatar
    FROM salons s JOIN users u ON u.id = s.user_id
    WHERE s.user_id = $1
  `, [salonUserId]);
  if (!row) return null;
  const terms = await getJoinTerms(salonUserId, db);
  // The percentages are only for someone holding the link's code: the salon's id alone is public and guessable.
  const codeValid = await verifySalonJoinCode(salonUserId, code, db);
  // Every line goes to the page (it shows four and a «بقیه» tap for the rest), so the agreed snapshot is never more than she could read.
  const lines = String(row.rules || "").split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 60);
  const more = 0;
  return {
    id: row.user_id,
    name: row.name || "سالن",
    area: row.area || "",
    rules: codeValid ? row.rules || "" : "",
    rulesLines: codeValid ? lines : [],
    rulesMore: codeValid ? more : 0,
    avatar: row.avatar ? `/api/media/avatar/${row.user_id}` : "",
    ready: joinTermsReady(terms),
    codeValid,
    terms: codeValid && joinTermsReady(terms) ? terms : null
  };
}
