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

/** Totals per source and kind for the last `days` days (newest day first inside `byDay`). */
export async function landingVisitTotals(days = 14) {
  const db = await getDb();
  return all(db, `
    SELECT day::text AS day, source, kind, n FROM landing_visits
    WHERE day >= (NOW() AT TIME ZONE 'Asia/Tehran')::date - $1::int ORDER BY day DESC, source, kind
  `, [Math.max(1, Math.min(Number(days) || 14, 90))]);
}
