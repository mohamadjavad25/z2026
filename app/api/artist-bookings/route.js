import { json, requireUser, withErrorHandling } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as artists from "../../lib/db/repos/artists.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/artist-bookings → client session only → { bookings }
 *
 * A client's own bookings made directly with an independent artist
 * (artist_bookings table) — mirrors the client branch of GET
 * /api/salon-bookings (listClientSalonBookings), but for
 * listClientArtistBookings in app/lib/db/repos/artists.js.
 *
 * Fetched separately and merged client-side with salon bookings in
 * useSalonDirectory's refreshClientBookings, so a client's "فعالیت من"
 * shows every real booking (salon + direct artist) in one list. Kept as
 * its own endpoint instead of folding into /api/salon-bookings so that
 * route's existing owner/staff-availability branches stay untouched.
 */
async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (auth.user.type !== "client") {
    return json({ error: "فقط مشتری." }, { status: 403 });
  }
  return json({ data: { bookings: await artists.listClientArtistBookings(auth.user) } });
}

export const GET = withErrorHandling(_GET);
