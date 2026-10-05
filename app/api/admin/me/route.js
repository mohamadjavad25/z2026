import { json, withErrorHandling } from "../../../lib/http.js";
import { getUserFromRequest } from "../../../lib/auth.js";
import { ensureDb } from "../../../lib/db/connection.js";
import { isAdminPhone } from "../../../lib/admin.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lets the /admin page decide what to show. Safe for anyone: reveals only whether *you* are an admin. */
async function _GET(request) {
  await ensureDb();
  const user = await getUserFromRequest(request);
  return json({ data: { loggedIn: Boolean(user), isAdmin: Boolean(user && isAdminPhone(user.phone)), name: user?.name || "" } });
}

export const GET = withErrorHandling(_GET);
