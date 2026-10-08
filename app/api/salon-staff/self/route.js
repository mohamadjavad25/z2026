import { json, requireUserRole, withErrorHandling } from "../../../lib/http.js";
import * as salons from "../../../lib/db/repos/salons.js";

export const runtime = "nodejs";

/**
 * The salon manager working on their own team.
 * POST { name?, role? } → { person, staff }: joins (or updates) the team as a member flagged
 * is_owner. From then on they are picked for services and bookings like any other member.
 * Leaving the team is the usual DELETE /api/salon-staff with that member's id.
 */
async function _POST(request) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const body = await request.json().catch(() => ({}));
  const name = String(body?.name || auth.user.manager_name || "").trim() || "مدیر سالن";
  const role = body?.role == null ? null : String(body.role).slice(0, 200);
  const result = await salons.upsertSalonOwnerStaff(auth.user.id, { name: name.slice(0, 80), role });
  if (!result.ok) return json({ error: result.error }, { status: 409 });
  return json({ data: { person: result.person, staff: await salons.listSalonStaff(auth.user.id) } });
}

export const POST = withErrorHandling(_POST);
