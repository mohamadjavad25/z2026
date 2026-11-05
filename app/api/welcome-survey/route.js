import { z } from "zod";
import { json, readObjectBody, requireUser, validateBody, withErrorHandling } from "../../lib/http.js";
import { ensureDb } from "../../lib/db/connection.js";
import { putOff, saveAnswer, surveyFor } from "../../lib/db/repos/welcomeSurvey.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("later") }),
  z.object({
    action: z.literal("answer"),
    feel: z.number().int().min(0).max(4),
    parts: z.array(z.string().max(30)).max(12),
    idea: z.string().max(1000).optional()
  })
]);

/** GET: this person's survey, or null when it is not their time. */
async function _GET(request) {
  await ensureDb();
  const { user, response } = await requireUser(request);
  if (response) return response;
  return json({ data: { survey: await surveyFor(user.id) } });
}

/** POST { action: "answer", feel, parts, idea } or { action: "later" }. The account comes from the session. */
async function _POST(request) {
  await ensureDb();
  const { user, response } = await requireUser(request);
  if (response) return response;
  const parsed = validateBody(body, await readObjectBody(request));
  if (!parsed.ok) return parsed.response;
  if (parsed.data.action === "later") await putOff(user.id);
  else await saveAnswer(user.id, parsed.data);
  return json({ data: { ok: true } });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
