import { all, get, getDb, run } from "../connection.js";
import { ALL_PART_IDS, NO_TROUBLE, surveySteps, unclearPrice } from "../../../shared/lib/welcomeSurvey.js";

/**
 * The welcome survey (owner, 2026-11-05). It comes once, to someone who has really started: a salon or artist with
 * three posts or three services, a client with a first booking, and never in their first two hours, so nobody is
 * stopped in the middle of setting up. «بعداً» brings it back after three days, and after the second «بعداً» never.
 */
const FIRST_WAIT = "2 hours";
const LATER_DAYS = 3;
const MAX_LATER = 2;
const STARTED = 3;
const MAX_IDEA = 1000;

const FACTS = `
  LEFT JOIN welcome_surveys s ON s.user_id = u.id
  CROSS JOIN LATERAL (
    SELECT (SELECT COUNT(*) FROM posts p WHERE p.owner_user_id = u.id AND p.in_portfolio)::int
             + (SELECT COUNT(*) FROM salon_portfolio sp WHERE sp.salon_user_id = u.id)::int AS posts,
           (SELECT COUNT(*) FROM artist_services a WHERE a.user_id = u.id)::int
             + (SELECT COUNT(*) FROM salon_services sv WHERE sv.salon_user_id = u.id)::int AS services,
           (SELECT COUNT(*) FROM salon_bookings b WHERE b.client_user_id = u.id)::int
             + (SELECT COUNT(*) FROM artist_bookings b WHERE b.client_user_id = u.id)::int AS bookings
  ) f`;

/** Away long enough to be asked (owner 2026-11-06): not seen for three days, or already pushed (they come back by tapping it). */
const AWAY_DAYS = 3;
const AWAY = `(s.pushed_at IS NOT NULL OR (u.last_seen_at IS NOT NULL AND u.last_seen_at <= NOW() - INTERVAL '${AWAY_DAYS} days'))`;

const DUE = `
  u.suspended_at IS NULL AND u.type IN ('artist', 'salon', 'client')
  AND u.created_at <= NOW() - INTERVAL '${FIRST_WAIT}'
  AND ${AWAY} AND s.answered_at IS NULL AND COALESCE(s.later_count, 0) < ${MAX_LATER}
  AND (s.next_at IS NULL OR s.next_at <= NOW())
  AND CASE WHEN u.type = 'client' THEN f.bookings >= 1 ELSE f.posts >= ${STARTED} OR f.services >= ${STARTED} END`;

const person = (row) => ({
  role: row.type,
  name: row.name,
  facts: { posts: row.posts, services: row.services, bookings: row.bookings }
});

/** This person's survey with their own name and numbers, or null when it is not their time. */
export async function surveyFor(userId) {
  const db = await getDb();
  const row = await get(db, `
    SELECT u.id, u.type, u.name, u.area, u.service, u.experience_years, f.posts, f.services, f.bookings,
           (u.avatar <> '' OR u.avatar_url IS NOT NULL) AS has_avatar, (u.poster <> '' OR u.poster_url IS NOT NULL) AS has_poster
    FROM users u ${FACTS} WHERE u.id = $1 AND ${DUE}
  `, [Number(userId)]);
  if (!row) return null;
  const prices = row.type === "client" ? [] : await all(db, `
    SELECT price FROM artist_services WHERE user_id = $1 UNION ALL SELECT price FROM salon_services WHERE salon_user_id = $1
  `, [row.id]);
  const has = {
    area: Boolean(String(row.area || "").trim()),
    avatar: Boolean(row.has_avatar),
    poster: Boolean(row.has_poster),
    specialty: Boolean(String(row.service || "").trim()),
    experience: Boolean(String(row.experience_years ?? "").trim()),
    unclearPrices: prices.some((item) => unclearPrice(item.price))
  };
  const base = person(row);
  return { ...base, steps: surveySteps({ ...base, has }) };
}

/** Saved once: a second answer from another tab changes nothing. Only known parts are kept. */
export async function saveAnswer(userId, { feel, parts, idea }) {
  const known = [...new Set(parts)].filter((part) => ALL_PART_IDS.includes(part));
  const kept = known.includes(NO_TROUBLE) ? [NO_TROUBLE] : known;
  const db = await getDb();
  await run(db, `
    INSERT INTO welcome_surveys (user_id, feel, parts, idea, answered_at) VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (user_id) DO UPDATE SET feel = $2, parts = $3, idea = $4, answered_at = NOW()
    WHERE welcome_surveys.answered_at IS NULL
  `, [Number(userId), feel, kept, String(idea || "").trim().slice(0, MAX_IDEA)]);
}

/** They sent their note through the support form: the nudge is done for good. */
export async function markDone(userId) {
  const db = await getDb();
  await run(db, `
    INSERT INTO welcome_surveys (user_id, answered_at) VALUES ($1, NOW())
    ON CONFLICT (user_id) DO UPDATE SET answered_at = NOW() WHERE welcome_surveys.answered_at IS NULL
  `, [Number(userId)]);
}

export async function putOff(userId) {
  const db = await getDb();
  await run(db, `
    INSERT INTO welcome_surveys (user_id, later_count, next_at) VALUES ($1, 1, NOW() + INTERVAL '${LATER_DAYS} days')
    ON CONFLICT (user_id) DO UPDATE SET later_count = welcome_surveys.later_count + 1, next_at = NOW() + INTERVAL '${LATER_DAYS} days'
    WHERE welcome_surveys.answered_at IS NULL
  `, [Number(userId)]);
}

/** Who can get its one push now: their time has come, it was never pushed, and they have a phone or browser to reach. */
export async function peopleToPush(limit = 100) {
  const db = await getDb();
  const rows = await all(db, `
    SELECT u.id, u.type, u.name, f.posts, f.services, f.bookings FROM users u ${FACTS}
    WHERE ${DUE} AND s.pushed_at IS NULL AND u.last_seen_at IS NOT NULL
      AND (EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.user_id = u.id) OR EXISTS (SELECT 1 FROM native_push_tokens n WHERE n.user_id = u.id))
    ORDER BY u.id LIMIT $1
  `, [limit]);
  return rows.map((row) => ({ id: row.id, ...person(row) }));
}

/** True for the one run that gets to send it, so two sweeps at once can never push twice. */
export async function claimPush(userId) {
  const db = await getDb();
  const result = await run(db, `
    INSERT INTO welcome_surveys (user_id, pushed_at) VALUES ($1, NOW())
    ON CONFLICT (user_id) DO UPDATE SET pushed_at = NOW() WHERE welcome_surveys.pushed_at IS NULL
  `, [Number(userId)]);
  return Boolean(result?.rowCount);
}

/** The admin's page: the counts, then the newest answers with who gave them. */
export async function surveyReport({ limit = 100 } = {}) {
  const db = await getDb();
  const [totals, feels, parts, answers] = await Promise.all([
    get(db, `SELECT COUNT(*) FILTER (WHERE answered_at IS NOT NULL)::int AS answered,
                    COUNT(*) FILTER (WHERE answered_at IS NULL AND later_count > 0)::int AS put_off,
                    COUNT(*) FILTER (WHERE pushed_at IS NOT NULL)::int AS pushed FROM welcome_surveys`),
    all(db, "SELECT feel, COUNT(*)::int AS count FROM welcome_surveys WHERE answered_at IS NOT NULL GROUP BY feel"),
    all(db, "SELECT part, COUNT(*)::int AS count FROM welcome_surveys, UNNEST(parts) AS part WHERE answered_at IS NOT NULL GROUP BY part ORDER BY count DESC"),
    all(db, `SELECT s.user_id, u.name, u.type, s.feel, s.parts, s.idea, s.answered_at
             FROM welcome_surveys s JOIN users u ON u.id = s.user_id
             WHERE s.answered_at IS NOT NULL ORDER BY s.answered_at DESC LIMIT $1`, [limit])
  ]);
  return { totals, feels, parts, answers };
}
