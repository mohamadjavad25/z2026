import { NextResponse } from "next/server";
import { requireUser, withErrorHandling } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as artists from "../../lib/db/repos/artists.js";
import * as salons from "../../lib/db/repos/salons.js";
import { notifyConnection } from "../../lib/connectionNotify.js";

export const runtime = "nodejs";

function requireSalon(user) {
  if (user.type !== "salon") {
    return NextResponse.json({ error: "فقط سالن." }, { status: 403 });
  }
  return null;
}

async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const forbidden = requireSalon(auth.user);
  if (forbidden) return forbidden;

  return NextResponse.json({
    data: { collabs: await artists.listSalonCollabRequests(auth.user.id) }
  });
}

async function _PATCH(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const forbidden = requireSalon(auth.user);
  if (forbidden) return forbidden;

  const body = await request.json();
  const result = await artists.updateSalonCollabStatus(Number(body.id), auth.user.id, body.status);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, code: result.code },
      { status: result.code === "NOT_FOUND" ? 404 : 409 }
    );
  }
  const collab = result.collab;
  const staffResult = body.status === "تایید شد"
    ? await salons.addSalonStaffFromCollab(auth.user.id, collab)
    : null;
  if (body.status === "تایید شد" || body.status === "رد شد") {
    notifyConnection(collab?.artistId, {
      title: body.status === "تایید شد" ? "پیشنهادت پذیرفته شد" : "پیشنهادت رد شد",
      body: body.status === "تایید شد"
        ? `${auth.user.name || "سالن"} پیشنهاد همکاری‌ات را پذیرفت و حالا عضو تیم هستی.`
        : `${auth.user.name || "سالن"} پیشنهاد همکاری‌ات را نپذیرفت.`,
      url: "/"
    });
  }

  return NextResponse.json({
    data: {
      collab,
      collabs: await artists.listSalonCollabRequests(auth.user.id),
      staff: await salons.listSalonStaff(auth.user.id),
      staffPerson: staffResult?.person || null,
      staffCreated: staffResult?.created || false
    }
  });
}

export const GET = withErrorHandling(_GET);
export const PATCH = withErrorHandling(_PATCH);
