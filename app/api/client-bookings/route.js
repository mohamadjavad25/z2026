import { NextResponse } from "next/server";
import { requireUser, withErrorHandling } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as salons from "../../lib/db/repos/salons.js";
import * as artists from "../../lib/db/repos/artists.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/client-bookings → client session only → { data: { salonBookings, artistBookings } }
 *
 * One request for everything the client's "فعالیت من" needs. The client app refreshes this every
 * few seconds, and it used to call /api/salon-bookings and /api/artist-bookings separately, so
 * each refresh cost two function invocations.
 */
async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (auth.user.type !== "client") {
    return NextResponse.json({ error: "فقط مشتری." }, { status: 403 });
  }
  const [salonBookings, artistBookings] = await Promise.all([
    salons.listClientSalonBookings(auth.user),
    artists.listClientArtistBookings(auth.user)
  ]);
  return NextResponse.json(
    { data: { salonBookings, artistBookings } },
    { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } }
  );
}

export const GET = withErrorHandling(_GET);
