import { ensureDb } from "../../../../lib/db/connection.js";
import { error, json, requireUser } from "../../../../lib/http.js";
import * as messages from "../../../../lib/db/repos/messages.js";

export const runtime = "nodejs";

// Marking read is its own explicit action (not a side effect of GET
// /messages) — a background prefetch or a hidden tab polling for new
// messages must never silently mark them read on the sender's behalf.
export async function POST(request, { params }) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const ok = messages.markConversationRead(Number(id), auth.user.id);
  if (!ok) return error("دسترسی به این گفتگو نداری.", 403);
  return json({ data: { ok: true } });
}
