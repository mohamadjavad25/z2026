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
    SELECT (SELECT COUNT(*) FROM posts p WHERE p.owner_user_id = u.id)::int
             + (SELECT COUNT(*) FROM salon_portfolio sp WHERE sp.salon_user_id = u.id)::int AS posts,
           (SELECT COUNT(*) FROM artist_services a WHERE a.user_id = u.id)::int
             + (SELECT COUNT(*) FROM salon_services sv WHERE sv.salon_user_id = u.id)::int AS services,
           (SELECT COUNT(*) FROM salon_bookings b WHERE b.client_user_id = u.id)::int
             + (SELECT COUNT(*) FROM artist_bookings b WHERE b.client_user_id = u.id)::int AS bookings
  ) f`;

const DUE = `
  u.suspended_at IS NULL AND u.type IN ('artist', 'salon', 'client')
  AND u.created_at <= NOW() - INTERVAL '${FIRST_WAIT}'
  AND s.answered_at IS NULL AND COALESCE(s.later_count, 0) < ${MAX_LATER}
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
    WHERE ${DUE} AND s.pushed_at IS NULL
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

const ROLES = ["artist", "salon", "client"];
const REPORT_DAYS = [7, 30];
const MIN_ENOUGH = 10;
const MAX_NOTE = 300;
const MAX_ROWS = 5000;

/**
 * The admin's page. `role` ("artist", "salon", "client" or "") and `days` (7, 30 or 0 for all) narrow it; a row counts
 * in the period it was answered in, or, if never answered, in the one it first reached the person.
 * "reached" is everyone who has a row: pushed, put off or answered.
 */
export async function surveyReport({ role = "", days = 0, limit = 100 } = {}) {
  const db = await getDb();
  const wantRole = ROLES.includes(role) ? role : "";
  const wantDays = REPORT_DAYS.includes(Number(days)) ? Number(days) : 0;
  const rows = await all(db, `
    SELECT s.user_id, u.name, u.type, s.feel, s.parts, s.idea, s.answered_at, s.later_count, s.pushed_at, s.next_at,
           s.seen_at, s.admin_note, s.created_at
    FROM welcome_surveys s JOIN users u ON u.id = s.user_id
    WHERE ($1 = '' OR u.type = $1)
      AND ($2 = 0 OR COALESCE(s.answered_at, s.created_at) >= NOW() - ($2 || ' days')::interval)
    ORDER BY COALESCE(s.answered_at, s.created_at) DESC LIMIT ${MAX_ROWS}
  `, [wantRole, wantDays]);

  const answered = rows.filter((row) => row.answered_at);
  const waiting = rows.filter((row) => !row.answered_at);
  const feels = [];
  for (const row of answered) {
    if (row.feel === null || row.feel === undefined) continue;
    const found = feels.find((item) => item.feel === row.feel);
    if (found) found.count += 1;
    else feels.push({ feel: row.feel, count: 1 });
  }
  const rated = answered.filter((row) => row.feel !== null && row.feel !== undefined);
  const partCount = new Map();
  for (const row of answered) for (const part of row.parts || []) partCount.set(part, (partCount.get(part) || 0) + 1);

  // A hard answer nobody has marked yet comes first, then the newest.
  const hard = (row) => row.feel !== null && row.feel !== undefined && row.feel <= 1;
  const rank = (row) => (hard(row) && !row.seen_at ? 0 : row.seen_at ? 2 : 1);
  const sorted = [...answered].sort((a, b) => rank(a) - rank(b) || new Date(b.answered_at) - new Date(a.answered_at));

  return {
    filter: { role: wantRole, days: wantDays },
    totals: {
      reached: rows.length,
      answered: answered.length,
      put_off: waiting.filter((row) => row.later_count > 0).length,
      pushed: rows.filter((row) => row.pushed_at).length,
      unseen: answered.filter((row) => !row.seen_at).length,
      rate: rows.length ? Math.round((answered.length / rows.length) * 100) : null
    },
    average: rated.length ? Math.round((rated.reduce((sum, row) => sum + row.feel + 1, 0) / rated.length) * 10) / 10 : null,
    enough: answered.length >= MIN_ENOUGH,
    needed: Math.max(0, MIN_ENOUGH - answered.length),
    feels,
    parts: [...partCount].map(([part, count]) => ({ part, count })).sort((a, b) => b.count - a.count),
    waiting: waiting.slice(0, 50).map((row) => ({
      user_id: row.user_id, name: row.name, type: row.type,
      status: row.later_count > 0 ? "put_off" : "pushed",
      at: row.later_count > 0 ? row.next_at : row.pushed_at || row.created_at,
      later_count: row.later_count
    })),
    answers: sorted.slice(0, limit).map((row) => ({
      user_id: row.user_id, name: row.name, type: row.type, feel: row.feel, parts: row.parts || [], idea: row.idea,
      answered_at: row.answered_at, seen_at: row.seen_at, note: row.admin_note, attention: hard(row) && !row.seen_at
    }))
  };
}

/** The admin marks an answer seen (or not) and keeps a short note. False when that person never answered. */
export async function reviewAnswer(userId, { seen, note }) {
  const db = await getDb();
  const result = await run(db, `
    UPDATE welcome_surveys SET seen_at = CASE WHEN $2::boolean THEN COALESCE(seen_at, NOW()) ELSE NULL END, admin_note = $3
    WHERE user_id = $1 AND answered_at IS NOT NULL
  `, [Number(userId), Boolean(seen), String(note || "").trim().slice(0, MAX_NOTE)]);
  return Boolean(result?.rowCount);
}
