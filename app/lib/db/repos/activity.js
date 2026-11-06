import { getDb, all, get, run, withTransaction } from "../connection.js";
import { normalizePhone } from "../../../shared/lib/phone.js";

/**
 * The footprint (migrations/069_activity.sql, docs/PROJECT_NOTES.md «رد پا»): visits and what happened in them, for the
 * admin panel only. Writing is one statement and best effort: nothing here may ever cost a booking.
 */

// A real visit is far below this; past it the visit's time still moves but no more rows are kept.
const MAX_EVENTS_PER_VISIT = 2000;
const REPORT_TIMEOUT_MS = 8000;
// Each deleted account's visits share the id «gone»; each such visit counts as its own person.
const PERSON = "CASE WHEN v.visitor_id = 'gone' THEN v.id ELSE v.visitor_id END";

/** The owner's own test numbers (FRFRO_TEST_PHONES, server env: the repo is public). Left out of every total. */
export function testPhones() {
  return String(process.env.FRFRO_TEST_PHONES || "").split(",").map((phone) => normalizePhone(phone.trim())).filter(Boolean);
}

/** The phone-level kind of device, from the browser's own description. The full description is not kept. */
export function deviceOf(userAgent = "") {
  const ua = String(userAgent);
  if (/frfro-app/i.test(ua)) return /iphone|ipad/i.test(ua) ? "ios-app" : "android-app";
  if (/iphone|ipad/i.test(ua)) return "ios-web";
  if (/android/i.test(ua)) return "android-web";
  return "desktop";
}

/**
 * One batch from a phone. `events` are { k, n, p, ago }, ago = milliseconds before now. The account comes from the
 * session (userId), never from the batch. A visit id that belongs to another phone is ignored whole.
 */
export async function recordActivity({ visitId, visitorId, userId = null, device = "", source = "", events = [] }) {
  const db = await getDb();
  const longest = events.reduce((most, event) => Math.max(most, event.ago || 0), 0);
  await run(db, `
    WITH visit AS (
      INSERT INTO activity_visits AS v (id, visitor_id, user_id, device, source, event_count, started_at, last_at)
      VALUES ($1, $2, $3::int, $4, $5, cardinality($7::text[]), NOW() - $6::int * INTERVAL '1 millisecond', NOW())
      ON CONFLICT (id) DO UPDATE SET last_at = NOW(), user_id = COALESCE(v.user_id, EXCLUDED.user_id), event_count = v.event_count + cardinality($7::text[])
      WHERE v.visitor_id = EXCLUDED.visitor_id AND (v.user_id IS NULL OR EXCLUDED.user_id IS NULL OR v.user_id = EXCLUDED.user_id)
      RETURNING id, event_count
    ), added AS (
      INSERT INTO activity_events (visit_id, kind, name, profile_user_id, created_at)
      SELECT visit.id, e.kind, e.name, u.id, NOW() - e.ago * INTERVAL '1 millisecond'
      FROM visit
      CROSS JOIN unnest($7::text[], $8::text[], $9::int[], $10::int[]) AS e(kind, name, profile, ago)
      LEFT JOIN users u ON u.id = e.profile
      WHERE visit.event_count <= ${MAX_EVENTS_PER_VISIT}
    ), claimed AS (
      UPDATE activity_visits SET user_id = $3::int
      WHERE $3::int IS NOT NULL AND visitor_id = $2 AND user_id IS NULL AND id <> $1 AND EXISTS (SELECT 1 FROM visit)
    ), seen AS (
      -- A new visit (the last sign of life is over 30 minutes old) remembers when the previous one ended: the come-back
      -- nudge asks how long they were away before this visit, which last_seen_at no longer tells once it is refreshed.
      UPDATE users SET
        prev_seen_at = CASE WHEN last_seen_at < NOW() - INTERVAL '30 minutes' THEN last_seen_at ELSE prev_seen_at END,
        last_seen_at = NOW()
      WHERE id = (
        SELECT id FROM users WHERE id = $3::int AND (last_seen_at IS NULL OR last_seen_at < NOW() - INTERVAL '1 minute')
        FOR NO KEY UPDATE SKIP LOCKED
      )
    )
    SELECT 1
  `, [
    visitId, visitorId, userId, device, source, longest,
    events.map((event) => event.k), events.map((event) => event.n),
    events.map((event) => event.p ?? null), events.map((event) => event.ago || 0)
  ]);
}

/** One person, for the admin's «رد پا»: the last visits with what happened in each, and who saw their public page. */
export async function getUserFootprint(userId) {
  const db = await getDb();
  const id = Number(userId);
  const [totals, visits, page] = await Promise.all([
    get(db, `
      SELECT COUNT(*)::int AS visits, COALESCE(SUM(EXTRACT(EPOCH FROM last_at - started_at)), 0)::int AS seconds, MAX(last_at) AS last_at
      FROM activity_visits WHERE user_id = $1
    `, [id]),
    all(db, `
      SELECT v.id, v.device, v.source, v.started_at, v.last_at,
             COALESCE(json_agg(json_build_object('kind', e.kind, 'name', e.name, 'at', e.created_at) ORDER BY e.created_at, e.id) FILTER (WHERE e.id IS NOT NULL), '[]') AS events
      FROM (SELECT * FROM activity_visits WHERE user_id = $1 ORDER BY started_at DESC LIMIT 40) v
      LEFT JOIN activity_events e ON e.visit_id = v.id
      GROUP BY v.id, v.device, v.source, v.started_at, v.last_at
      ORDER BY v.started_at DESC
    `, [id]),
    get(db, `
      SELECT COUNT(DISTINCT ${PERSON}) FILTER (WHERE e.kind = 'screen')::int AS viewers,
             COUNT(DISTINCT ${PERSON}) FILTER (WHERE e.name = 'book_tap')::int AS book_taps
      FROM activity_events e JOIN activity_visits v ON v.id = e.visit_id
      WHERE e.profile_user_id = $1
    `, [id])
  ]);
  return { totals, visits, page };
}

/** Everyone, for the reports page: how many came, from where, the last screen before leaving, where each role stops. */
export async function getActivityReport(rangeDays = 30) {
  const days = [7, 30, 90].includes(Number(rangeDays)) ? Number(rangeDays) : 30;
  const db = await getDb();
  const phones = testPhones();
  // Visits of the test accounts, and of the phones those accounts used before signing in, are left out.
  const real = `
    SELECT v.* FROM activity_visits v
    WHERE v.started_at >= NOW() - ${days} * INTERVAL '1 day'
      AND v.visitor_id NOT IN (SELECT t.visitor_id FROM activity_visits t JOIN users u ON u.id = t.user_id WHERE u.phone = ANY($1::text[]))
  `;
  return withTransaction(db, async (client) => {
    // One connection, one query at a time, with a time limit: this page must never crowd out bookings.
    await client.query(`SET LOCAL statement_timeout = ${REPORT_TIMEOUT_MS}`);
    const summary = await get(client, `
      SELECT COUNT(*)::int AS visits, COUNT(DISTINCT CASE WHEN r.visitor_id = 'gone' THEN r.id ELSE r.visitor_id END)::int AS people, COUNT(DISTINCT user_id)::int AS accounts,
             COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM last_at - started_at))), 0)::int AS avg_seconds
      FROM (${real}) r
    `, [phones]);
    const sources = await all(client, `
      SELECT COALESCE(NULLIF(source, ''), 'direct') AS source, COUNT(*)::int AS count
      FROM (${real}) r GROUP BY 1 ORDER BY count DESC LIMIT 6
    `, [phones]);
    const lastScreens = await all(client, `
      SELECT last.name, COUNT(*)::int AS count FROM (
        SELECT DISTINCT ON (e.visit_id) e.name FROM activity_events e JOIN (${real}) r ON r.id = e.visit_id
        WHERE e.kind = 'screen' ORDER BY e.visit_id, e.created_at DESC, e.id DESC
      ) last GROUP BY last.name ORDER BY count DESC LIMIT 8
    `, [phones]);
    const funnels = await all(client, `
      SELECT u.type, COUNT(*)::int AS signed,
             COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM salon_services s WHERE s.salon_user_id = u.id) OR EXISTS (SELECT 1 FROM artist_services a WHERE a.user_id = u.id))::int AS services,
             COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM posts p WHERE p.owner_user_id = u.id))::int AS posts,
             COUNT(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM activity_visits v JOIN activity_events e ON e.visit_id = v.id
               WHERE v.user_id = u.id AND e.name = 'share_link' AND (e.profile_user_id IS NULL OR e.profile_user_id = u.id)
             ))::int AS shared,
             COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM salon_bookings b WHERE b.salon_user_id = u.id) OR EXISTS (SELECT 1 FROM artist_bookings b WHERE b.artist_user_id = u.id))::int AS booked
      FROM users u
      WHERE u.type IN ('artist', 'salon') AND u.created_at >= NOW() - ${days} * INTERVAL '1 day' AND NOT (u.phone = ANY($1::text[]))
      GROUP BY u.type
    `, [phones]);
    return { days, summary, sources, lastScreens, funnels };
  });
}

/** Disk used by the footprint, for the server watch. */
export async function activityBytes() {
  const db = await getDb();
  const row = await get(db, `
    SELECT COALESCE(pg_total_relation_size(to_regclass('activity_events')), 0)::bigint + COALESCE(pg_total_relation_size(to_regclass('activity_visits')), 0)::bigint AS bytes
  `);
  return Number(row?.bytes || 0);
}
