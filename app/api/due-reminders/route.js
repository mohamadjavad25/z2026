import { error, json, readObjectBody, requireUser, withErrorHandling } from "../../lib/http.js";
import { confirmDuePlan, getDuePlan, saveDueRule } from "../../lib/db/repos/dueReminders.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * «وقتش شده» for a salon or artist (owner's decisions of 2026-10-25).
 * GET → { confirmed, services: [{ name, usualGap, gapDays, textId, customText, changed }] }
 * POST { confirm: true } («همه درسته») or { service, gapDays, textId, customText } (one service; also confirms).
 */
async function owner(request) {
  const auth = await requireUser(request);
  if (!auth.ok) return { response: auth.response };
  if (!["salon", "artist"].includes(auth.user.type)) return { response: error("این بخش مال سالن و آرتیسته.", 403) };
  return { user: auth.user };
}

async function _GET(request) {
  const { user, response } = await owner(request);
  if (response) return response;
  return json({ data: await getDuePlan(user.id, user.type) });
}

async function _POST(request) {
  const { user, response } = await owner(request);
  if (response) return response;
  const body = await readObjectBody(request);
  if (body.confirm === true) {
    await confirmDuePlan(user.id);
  } else {
    const saved = await saveDueRule(user.id, user.type, body);
    if (!saved.ok) return error(saved.error, 400);
  }
  return json({ data: await getDuePlan(user.id, user.type) });
}

export const GET = withErrorHandling(_GET);
export const POST = withErrorHandling(_POST);
