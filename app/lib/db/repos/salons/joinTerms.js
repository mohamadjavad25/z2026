import { get, getDb, run } from "../../connection.js";
import { checkTerms } from "../teamAgreements.js";
import { ensureSalonHours } from "./hours.js";

/**
 * The salon's standing terms for artists who join through its link/QR («شرایط همکاری سالن», owner's decision 2026-10-28).
 * One row per salon (migration 063). No row = the link is not ready. `version` goes up whenever the numbers the artist
 * agrees to change (days, hours, shares, or the rules text), so a page read earlier cannot be agreed to by mistake.
 */

/** Longest rules text shown on the join page; the rest is «و N مورد دیگه». */
export const RULES_LINES_SHOWN = 4;

const view = (row) => row && {
  days: row.days,
  from: row.from_time,
  to: row.to_time,
  share: row.share_percent,
  ownShare: row.own_share_percent,
  allowProposals: row.allow_proposals !== false,
  version: row.version
};

/** → { days, from, to, share, ownShare, allowProposals, version } or null (not ready). */
export async function getJoinTerms(salonUserId, runner = null, { lock = false } = {}) {
  const db = runner || (await getDb());
  return view(await get(db, `SELECT * FROM salon_join_terms WHERE salon_user_id = $1${lock ? " FOR SHARE" : ""}`, [Number(salonUserId)]));
}

export const joinTermsReady = (terms) => Boolean(terms && terms.days && terms.from && terms.to && terms.share !== null && terms.share !== undefined);

/** The salon's rules text → { lines: up to 4 non-empty lines, more: how many were left out }. */
export function rulesLines(text) {
  const all = String(text || "").split("\n").map((line) => line.trim()).filter(Boolean);
  return { lines: all.slice(0, RULES_LINES_SHOWN), more: Math.max(0, all.length - RULES_LINES_SHOWN) };
}

/** The salon's live rules text (never copied: the join page and the agreed row's snapshot both read it from here). */
export async function getSalonRulesText(salonUserId, runner = null) {
  const db = runner || (await getDb());
  const row = await get(db, "SELECT rules FROM salons WHERE user_id = $1", [Number(salonUserId)]);
  return row?.rules || "";
}

/**
 * Saves the salon's terms (validated like every terms change: real days, hours inside the salon's open hours, a percent).
 * → { ok: true, terms } or { ok: false, error }. The version rises only when the agreed numbers changed, so saving the
 * same form twice (or flipping `allowProposals`) does not push artists who are reading the page into TERMS_CHANGED.
 */
export async function saveJoinTerms(salonUserId, input) {
  const db = await getDb();
  await ensureSalonHours(Number(salonUserId), db);
  const checked = await checkTerms(salonUserId, input, db);
  if (!checked.ok) return checked;
  const { days, from, to, share, ownShare } = checked.value;
  const allow = input.allowProposals === undefined || input.allowProposals === null ? null : Boolean(input.allowProposals);
  const row = await get(db, `
    INSERT INTO salon_join_terms (salon_user_id, days, from_time, to_time, share_percent, own_share_percent, allow_proposals)
    VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::boolean, TRUE))
    ON CONFLICT (salon_user_id) DO UPDATE SET
      version = CASE WHEN (salon_join_terms.days, salon_join_terms.from_time, salon_join_terms.to_time, salon_join_terms.share_percent, salon_join_terms.own_share_percent)
                       IS DISTINCT FROM (EXCLUDED.days, EXCLUDED.from_time, EXCLUDED.to_time, EXCLUDED.share_percent, EXCLUDED.own_share_percent)
                     THEN salon_join_terms.version + 1 ELSE salon_join_terms.version END,
      days = EXCLUDED.days, from_time = EXCLUDED.from_time, to_time = EXCLUDED.to_time,
      share_percent = EXCLUDED.share_percent, own_share_percent = EXCLUDED.own_share_percent,
      allow_proposals = COALESCE($7::boolean, salon_join_terms.allow_proposals),
      updated_at = CURRENT_TIMESTAMP
    RETURNING *
  `, [Number(salonUserId), days, from, to, share, ownShare, allow]);
  return { ok: true, terms: view(row) };
}

/** A change to the rules text counts as a change of what the artist agrees to: bump the version (only when a row exists). */
export async function bumpJoinTermsVersion(salonUserId, runner = null) {
  const db = runner || (await getDb());
  await run(db, "UPDATE salon_join_terms SET version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE salon_user_id = $1", [Number(salonUserId)]);
}
