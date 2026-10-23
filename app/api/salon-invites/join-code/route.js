import { ensureDb } from "../../../lib/db/connection.js";
import { json, requireUserRole, withErrorHandling } from "../../../lib/http.js";
import { getOrCreateSalonJoinSecret } from "../../../lib/db/repos/salons.js";

export const runtime = "nodejs";

// The secret embedded in the salon's own QR/link (app/join-salon/[id]?k=...),
// shown to the salon owner so they can build/share that link; see
// app/lib/db/repos/salons/invites.js for why the id alone isn't enough.
async function _GET(request) {
  await ensureDb();
  const auth = await requireUserRole(request, "salon", "این بخش مال سالن‌هاست.");
  if (!auth.ok) return auth.response;
  const code = await getOrCreateSalonJoinSecret(auth.user.id);
  return json({ data: { code } });
}

export const GET = withErrorHandling(_GET);
