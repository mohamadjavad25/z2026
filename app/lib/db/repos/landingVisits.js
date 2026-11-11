import { getDb, all, run } from "../connection.js";

/** Counters for the reel link /go (migrations/067_landing_visits.sql). Counting never breaks the page: errors are swallowed. */
export const VISIT_KINDS = ["open", "enter", "apk", "bazaar"];

export async function countLandingVisit(source, kind) {
  if (!VISIT_KINDS.includes(kind)) return false;
  const tag = String(source || "go").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24) || "go";
  try {
    const db = await getDb();
    await run(db, `
      INSERT INTO landing_visits (day, source, kind, n) VALUES ((NOW() AT TIME ZONE 'Asia/Tehran')::date, $1, $2, 1)
      ON CONFLICT (day, source, kind) DO UPDATE SET n = landing_visits.n + 1
    `, [tag, kind]);
    return true;
  } catch {
    return false;
  }
}

/**
 * What the links brought, day by day (newest first), for the admin reports page: how many opened a link page (/go, /s),
 * how many tapped its start button, how many went on to the app download, with the opens split by link (`sources`), and
 * how many salons and artists signed up that day. A day with neither a visit nor a sign-up is left out.
 * The sign-ups are everyone's of that day, not only the link's visitors: a visit carries no account.
 */
export async function landingVisitDays(days = 30) {
  const span = Math.max(1, Math.min(Number(days) || 30, 90));
  const db = await getDb();
  const [visits, signups] = await Promise.all([
    all(db, `
      SELECT day::text AS day, source, kind, n FROM landing_visits
      WHERE day > (NOW() AT TIME ZONE 'Asia/Tehran')::date - $1::int ORDER BY day DESC, source, kind
    `, [span]),
    all(db, `
      SELECT (created_at AT TIME ZONE 'Asia/Tehran')::date::text AS day,
             COUNT(*) FILTER (WHERE type = 'salon')::int AS salons,
             COUNT(*) FILTER (WHERE type = 'artist')::int AS artists
      FROM users
      WHERE type IN ('salon', 'artist') AND (created_at AT TIME ZONE 'Asia/Tehran')::date > (NOW() AT TIME ZONE 'Asia/Tehran')::date - $1::int
      GROUP BY 1
    `, [span])
  ]);
  const byDay = new Map();
  const row = (day) => {
    if (!byDay.has(day)) byDay.set(day, { day, opened: 0, started: 0, app: 0, salons: 0, artists: 0, sources: [] });
    return byDay.get(day);
  };
  for (const visit of visits) {
    const item = row(visit.day);
    const n = Number(visit.n) || 0;
    if (visit.kind === "open") {
      item.opened += n;
      item.sources.push({ source: visit.source, opened: n });
    } else if (visit.kind === "enter") item.started += n;
    else item.app += n;
  }
  for (const signup of signups) Object.assign(row(signup.day), { salons: signup.salons, artists: signup.artists });
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
}
