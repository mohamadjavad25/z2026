import { ensureDb } from "../../../lib/db/connection.js";
import { error, json, requireUserRole, withErrorHandling } from "../../../lib/http.js";
import * as connections from "../../../lib/db/repos/connections.js";
import { findClientService, offersClientService } from "../../../shared/constants/clientServices.js";
import { normalizeServiceText } from "../../../shared/lib/serviceText.js";

export const runtime = "nodejs";

// Which of the client's own salons and artists do one service the client picked (owner, 2026-11-12).
// GET ?service=gelish            -> a service of the full list (clientServices.js)
// GET ?name=<what the client typed> -> a service that is not on the list: matched by its name
// -> { matches: [{ ...card, services: [their own names for it] }] }; empty = nobody of theirs does it.
async function _GET(request) {
  await ensureDb();
  const auth = await requireUserRole(request, "client", "این بخش مال مشتری‌هاست.");
  if (!auth.ok) return auth.response;
  const params = new URL(request.url).searchParams;
  const service = findClientService(params.get("service"));
  const typed = normalizeServiceText(String(params.get("name") || "").slice(0, 80));
  if (!service && typed.length < 2) return error("چه کاری می‌خوای؟ یکی رو انتخاب کن.");
  const offers = service
    ? (own) => offersClientService(own, service)
    : (own) => {
      const name = normalizeServiceText(own.name);
      return name.length > 1 && (name.includes(typed) || typed.includes(name));
    };
  const matches = await connections.listConnectionsOffering(auth.user.id, offers);
  return json({ data: { matches } });
}

export const GET = withErrorHandling(_GET);
