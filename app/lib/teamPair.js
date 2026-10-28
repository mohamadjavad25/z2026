import { requireUser } from "./http.js";
import { assertPair } from "./db/repos/teamAgreements.js";

/**
 * Who is asking about which team pair (a salon and one of its artists). The salon names the artist (`artistUserId`), the
 * artist names the salon (`salonUserId`); nobody else gets in, and the pair must be a real team. →
 * { ok: true, user, side: "salon" | "artist", salonUserId, artistUserId, staff } or { ok: false, response }.
 */
export async function requireTeamPair(request, source) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth;
  const user = auth.user;
  const fail = (status, message) => ({ ok: false, response: Response.json({ error: message }, { status }) });
  if (user.type !== "salon" && user.type !== "artist") return fail(403, "این بخش مال سالن‌ها و آرتیست‌هاست.");
  const salonUserId = user.type === "salon" ? Number(user.id) : Number(source?.salonUserId || 0);
  const artistUserId = user.type === "artist" ? Number(user.id) : Number(source?.artistUserId || 0);
  if (!salonUserId || !artistUserId) return fail(400, "درخواست درست نرسید؛ دوباره بزن.");
  const staff = await assertPair(salonUserId, artistUserId);
  if (!staff) return fail(404, "این آرتیست توی تیم این سالن نیست.");
  return { ok: true, user, side: user.type, salonUserId, artistUserId, staff };
}
