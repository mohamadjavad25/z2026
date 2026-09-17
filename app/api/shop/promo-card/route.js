import { ensureDb } from "../../../lib/db/connection.js";
import { error, json, requireUserRole } from "../../../lib/http.js";
import * as shopPromoCard from "../../../lib/db/repos/shopPromoCard.js";

export const runtime = "nodejs";

export async function GET(request) {
  ensureDb();
  const auth = requireUserRole(request, "shop", "فقط فروشگاه.");
  if (!auth.ok) return auth.response;
  return json({ data: { cards: shopPromoCard.listPromoCards(auth.user.id) } });
}

export async function POST(request) {
  ensureDb();
  const auth = requireUserRole(request, "shop", "فقط فروشگاه.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const result = shopPromoCard.createPromoCard(auth.user.id, {
    icon: body.icon,
    tone: body.tone,
    primary: body.primary,
    secondary: body.secondary
  });
  if (!result.ok) return error(result.error, 400);
  return json({ data: { card: result.card } }, { status: 201 });
}

/** Body: { id, active: true } to make a card the shop's active one. */
export async function PATCH(request) {
  ensureDb();
  const auth = requireUserRole(request, "shop", "فقط فروشگاه.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return error("شناسه کارت نامعتبر است.", 400);
  const result = shopPromoCard.activatePromoCard(id, auth.user.id);
  if (!result.ok) return error(result.error, result.code === "NOT_FOUND" ? 404 : 409);
  return json({ data: { cards: result.cards } });
}

export async function DELETE(request) {
  ensureDb();
  const auth = requireUserRole(request, "shop", "فقط فروشگاه.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const result = shopPromoCard.deletePromoCard(Number(body.id), auth.user.id);
  if (!result.ok) return error(result.error, result.code === "NOT_FOUND" ? 404 : 409);
  return json({ data: { ok: true } });
}
