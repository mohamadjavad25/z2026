import { json, notFound, parseId, requireUserRole, withErrorHandling } from "../../../../lib/http.js";
import * as salons from "../../../../lib/db/repos/salons.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/salon-bookings/:id/staff
 * → { parts: [{ service, start, end, staff, options: [{ name, free, skilled, away }] }], suggested: [name] }
 * The salon's artist pickers for one of its bookings: per service (in visit order, at its own
 * clock time) who on the team is free then, who is linked to that service, who is away, and the
 * split «تقسیم خودکار» would make (listBookingStaffOptions). PATCH still checks every change.
 */
async function _GET(request, { params }) {
  const auth = await requireUserRole(request, "salon", "فقط سالن.");
  if (!auth.ok) return auth.response;
  const id = parseId((await params).id);
  if (!id) return notFound();
  const result = await salons.listBookingStaffOptions(id, auth.user.id);
  if (!result) return notFound("رزرو یافت نشد.");
  return json({ data: result });
}

export const GET = withErrorHandling(_GET);
