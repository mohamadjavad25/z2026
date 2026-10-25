import { ensureDb } from "../../lib/db/connection.js";
import { json, readObjectBody, requireUser, withErrorHandling } from "../../lib/http.js";
import { listUnseenTeamNotices, markTeamNoticesSeen } from "../../lib/db/repos/teamNotices.js";

export const runtime = "nodejs";

// «همکاری تموم شد» cards (lib/teamNotify.js): GET -> { notices } not closed yet; POST { ids } -> closes them («باشه»).
async function _GET(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (auth.user.type !== "salon" && auth.user.type !== "artist") return json({ data: { notices: [] } });
  return json({ data: { notices: await listUnseenTeamNotices(auth.user.id) } });
}

async function _POST(request) {
  await ensureDb();
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const body = await readObjectBody(request);
  await markTeamNoticesSeen(auth.user.id, body.ids);
  return json({ data: { ok: true } });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
