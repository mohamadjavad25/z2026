/** What every way into a team shares (the salon's invite, the salon's link or QR, the artist's own request). */
import { run } from "../../connection.js";
import { dateKeyAfter } from "../../../../shared/lib/artistPlace.js";
import { getSalonRulesText } from "./joinTerms.js";

/** The states of a salon's invite (salon_artist_invites.status). */
export const PENDING = "در انتظار تایید";
export const ACCEPTED = "تایید شد";
export const REJECTED = "رد شد";
export const CANCELLED = "لغو شد";

/** Serialises everything that adds or answers a membership for one salon+artist pair (salon_staff has no unique pair). */
export async function lockTeamPair(tx, salonUserId, artistUserId) {
  await run(tx, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [`team-pair:${Number(salonUserId)}:${Number(artistUserId)}`]);
  await run(tx, "SELECT 1 FROM salon_staff WHERE salon_user_id = $1 AND artist_user_id = $2 FOR UPDATE", [Number(salonUserId), Number(artistUserId)]);
}

/**
 * The «agreed» row of a new member: terms effective today, with the salon's rules text of this moment. Leftover rows that
 * start later (from an earlier membership) are dropped so they cannot override what was just agreed; past rows stay (the
 * ledger prices old visits with them).
 */
export async function writeAgreedTerms(tx, { salonUserId, artistUserId, terms, source }) {
  const today = dateKeyAfter(0);
  const rules = await getSalonRulesText(salonUserId, tx);
  await run(tx, "DELETE FROM team_terms WHERE salon_user_id = $1 AND artist_user_id = $2 AND effective_from > $3", [Number(salonUserId), Number(artistUserId), today]);
  await run(tx, `
    INSERT INTO team_terms (salon_user_id, artist_user_id, effective_from, days, from_time, to_time, share_percent, own_share_percent, rules_snapshot, source)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `, [Number(salonUserId), Number(artistUserId), today, terms.days, terms.from, terms.to, terms.share, terms.ownShare ?? null, rules, source]);
}
