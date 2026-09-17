import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../lib/auth.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as artists from "../../lib/db/repos/artists.js";

export const runtime = "nodejs";

export async function GET(request) {
  ensureDb();
  return NextResponse.json({ data: { artists: artists.listArtists() } });
}
