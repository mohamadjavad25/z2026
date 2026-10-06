import { NextResponse } from "next/server";
import { verifyCronSecret } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { migrateMediaToStorage, countPendingMedia } from "../../../lib/mediaMigration.js";
import { withErrorHandling } from "../../../lib/http.js";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Moves pictures that are still base64 in the database into Supabase Storage, a few seconds'
 * worth per call (see app/lib/mediaMigration.js). Safe to call as often as you like: with nothing
 * left it only runs a count. GET reports what is left without moving anything.
 */
async function _POST(request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 401 });
  }
  await ensureDb();
  return NextResponse.json({ data: await migrateMediaToStorage() });
}

async function _GET(request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "دسترسی مجاز نیست." }, { status: 401 });
  }
  await ensureDb();
  return NextResponse.json({ data: { pending: await countPendingMedia() } });
}

export const POST = withErrorHandling(_POST);
export const GET = withErrorHandling(_GET);
