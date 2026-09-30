import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../lib/auth.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as artists from "../../lib/db/repos/artists.js";
import { withErrorHandling } from "../../lib/http.js";

export const runtime = "nodejs";

async function _GET(request) {
  await ensureDb();
  return NextResponse.json({ data: { artists: await artists.listArtists() } });
}

export const GET = withErrorHandling(_GET);
