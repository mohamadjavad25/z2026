import { NextResponse } from "next/server";
import { getUserFromRequest } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import * as artists from "../../../lib/db/repos/artists.js";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  ensureDb();
  const { id } = await params;
  const viewer = getUserFromRequest(request);
  const artist = artists.getPublicArtist(Number(id), viewer?.id || null);
  if (!artist) return NextResponse.json({ error: "آرتیست یافت نشد." }, { status: 404 });
  return NextResponse.json({ data: { artist } });
}
