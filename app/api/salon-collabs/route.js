import { NextResponse } from "next/server";
import { requireUser } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as artists from "../../lib/db/repos/artists.js";
import * as salons from "../../lib/db/repos/salons.js";

export const runtime = "nodejs";

function requireSalon(user) {
  if (user.type !== "salon") {
    return NextResponse.json({ error: "فقط سالن." }, { status: 403 });
  }
  return null;
}

export async function GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const forbidden = requireSalon(auth.user);
  if (forbidden) return forbidden;

  return NextResponse.json({
    collabs: await artists.listSalonCollabRequests(auth.user.id)
  });
}

export async function PATCH(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const forbidden = requireSalon(auth.user);
  if (forbidden) return forbidden;

  const body = await request.json();
  const collab = await artists.updateSalonCollabStatus(Number(body.id), auth.user.id, body.status);
  if (!collab) return NextResponse.json({ error: "پیشنهاد پیدا نشد." }, { status: 404 });
  const staffResult = body.status === "تایید شد"
    ? await salons.addSalonStaffFromCollab(auth.user.id, collab)
    : null;

  return NextResponse.json({
    collab,
    collabs: await artists.listSalonCollabRequests(auth.user.id),
    staff: await salons.listSalonStaff(auth.user.id),
    staffPerson: staffResult?.person || null,
    staffCreated: staffResult?.created || false
  });
}
