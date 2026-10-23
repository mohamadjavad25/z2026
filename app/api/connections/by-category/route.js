import { ensureDb } from "../../../lib/db/connection.js";
import { error, json, requireUserRole, withErrorHandling } from "../../../lib/http.js";
import * as connections from "../../../lib/db/repos/connections.js";
import { findClientCategory } from "../../../shared/constants/clientCategories.js";

export const runtime = "nodejs";

// Which of the client's own salons and artists do a kind of service.
// GET ?category=nails -> { category, matches: [{ ...card, services: [names] }] }
// Empty `matches` means the client has no one for it yet (the app then offers to connect someone).
async function _GET(request) {
  await ensureDb();
  const auth = await requireUserRole(request, "client", "این بخش مال مشتری‌هاست.");
  if (!auth.ok) return auth.response;
  const category = findClientCategory(new URL(request.url).searchParams.get("category"));
  if (!category) return error("این دسته رو پیدا نکردیم.");
  const matches = await connections.listConnectionsForCategory(auth.user.id, category);
  return json({ data: { category: category.id, matches } });
}

export const GET = withErrorHandling(_GET);
