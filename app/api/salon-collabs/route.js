import { NextResponse } from "next/server";
import { readObjectBody, requireUser, withErrorHandling } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import * as artists from "../../lib/db/repos/artists.js";
import * as salons from "../../lib/db/repos/salons.js";
import { notifyConnection } from "../../lib/connectionNotify.js";

export const runtime = "nodejs";

function requireSalon(user) {
  if (user.type !== "salon") {
    return NextResponse.json({ error: "این بخش مال سالن‌هاست." }, { status: 403 });
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

const REFUSAL_STATUS = { NOT_FOUND: 404, INVALID: 400 };

/**
 * PATCH /api/salon-collabs (salon). Body { id, action: "accept" | "reject" | "counter", ...terms } (or the older
 * { id, status: "تایید شد" | "رد شد" | "پایان یافت" }). `counter` takes { days, from, to, share, ownShare? } flat or inside `terms`: the request is
 * closed as rejected and an invite with the salon's numbers goes to the artist. Answers { data: { collab, collabs, staff, ... } };
 * refusals { error, code }: NOT_FOUND 404, INVALID 400, EXPIRED / ALREADY_STAFF / TERMS_INVALID / INVALID_TRANSITION 409.
 */
async function _PATCH(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const forbidden = requireSalon(auth.user);
  if (forbidden) return forbidden;

  const body = await readObjectBody(request);
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "درخواست پیدا نشد.", code: "NOT_FOUND" }, { status: 400 });
  const salonName = auth.user.name || "سالن";
  const action = ["accept", "reject", "counter"].includes(body.action)
    ? body.action
    : body.status === "تایید شد" ? "accept" : body.status === "رد شد" ? "reject" : "";

  let result;
  if (action === "accept") result = await artists.acceptSalonCollab(id, auth.user.id);
  else if (action === "reject") result = await artists.rejectSalonCollab(id, auth.user.id);
  else if (action === "counter") {
    // The numbers may come flat or inside `terms`.
    const terms = body.terms && typeof body.terms === "object" ? body.terms : body;
    const days = Array.isArray(terms.days) ? terms.days.join("،") : terms.days;
    result = await artists.counterSalonCollab(id, auth.user.id, { ...terms, days });
  } else result = await artists.updateSalonCollabStatus(id, auth.user.id, body.status);

  if (!result.ok) {
    return NextResponse.json({ error: result.error, code: result.code }, { status: REFUSAL_STATUS[result.code] || 409 });
  }
  const collab = result.collab;
  const artistId = collab?.artistId || result.artistUserId;
  if (action === "accept") {
    notifyConnection(artistId, { title: "سالن پیشنهادت رو قبول کرد", body: `${salonName} پیشنهادت رو قبول کرد؛ حالا توی تیمشی.`, url: "/" });
  } else if (action === "reject") {
    notifyConnection(artistId, { title: "سالن فعلاً پیشنهادت رو نخواست", body: `${salonName} فعلاً پیشنهادت رو نخواست.`, url: "/" });
  } else if (action === "counter") {
    notifyConnection(artistId, { title: "سالن شرایط خودش رو پیشنهاد داد", body: `${salonName} با شرایط دیگه‌ای جواب داد؛ از «دعوت‌ها» ببین و جواب بده.`, url: "/" });
  }

  return NextResponse.json({
    data: {
      collab,
      collabs: await artists.listSalonCollabRequests(auth.user.id),
      staff: await salons.listSalonStaff(auth.user.id),
      staffPerson: result.staffResult?.person || null,
      staffCreated: result.staffResult?.created || false,
      invite: result.invite || null
    }
  });
}

export const GET = withErrorHandling(_GET);
export const PATCH = withErrorHandling(_PATCH);
