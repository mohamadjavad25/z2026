import { parseId, withErrorHandling } from "../../../../lib/http.js";
import { ensureDb } from "../../../../lib/db/connection.js";
import { getUserFromRequest } from "../../../../lib/auth.js";
import { requireAdmin } from "../../../../lib/admin.js";
import * as support from "../../../../lib/db/repos/support.js";
import { attachmentResponse } from "../../../../lib/supportMedia.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET: a picture or voice note from a support conversation, for the person whose ticket it is or an admin. Anyone else gets a plain 404. */
async function _GET(request, { params }) {
  await ensureDb();
  const id = parseId((await params).id);
  if (!id) return new Response(null, { status: 404 });
  const user = await getUserFromRequest(request);
  let row = user ? await support.getAttachment(id, { userId: user.id }) : null;
  if (!row && (await requireAdmin(request)).ok) row = await support.getAttachment(id);
  if (!row) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return attachmentResponse(request, row);
}

export const GET = withErrorHandling(_GET);
