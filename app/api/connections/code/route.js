import { ensureDb } from "../../../lib/db/connection.js";
import { json, requireUserRole, withErrorHandling } from "../../../lib/http.js";
import * as connections from "../../../lib/db/repos/connections.js";
import { buildClientCode } from "../../../shared/lib/connectCodes.js";

export const runtime = "nodejs";

// The client's personal QR content ("اسکن شو"). A salon or artist scans it to
// add the client; see /api/connections/scan.
async function _GET(request) {
  await ensureDb();
  const auth = await requireUserRole(request, "client");
  if (!auth.ok) return auth.response;
  const secret = await connections.getOrCreateConnectSecret(auth.user.id);
  return json({ data: { code: buildClientCode(auth.user.id, secret) } });
}

export const GET = withErrorHandling(_GET);
