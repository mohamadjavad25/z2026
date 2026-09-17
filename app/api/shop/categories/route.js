import { ensureDb } from "../../../lib/db/connection.js";
import { error, json, notFound, requireUserRole } from "../../../lib/http.js";
import * as shopCategories from "../../../lib/db/repos/shopCategories.js";

export const runtime = "nodejs";

export async function GET(request) {
  ensureDb();
  const auth = requireUserRole(request, "shop", "فقط فروشگاه.");
  if (!auth.ok) return auth.response;
  return json({ data: { categories: shopCategories.listCategories(auth.user.id) } });
}

export async function POST(request) {
  ensureDb();
  const auth = requireUserRole(request, "shop", "فقط فروشگاه.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const result = shopCategories.createCategory(auth.user.id, body.name);
  if (!result.ok) return error(result.error, 409);
  return json({ data: { category: result.category } }, { status: 201 });
}

/** Body: { id, name } to rename, or { id, direction: "up"|"down" } to reorder. */
export async function PATCH(request) {
  ensureDb();
  const auth = requireUserRole(request, "shop", "فقط فروشگاه.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return error("شناسه دسته نامعتبر است.", 400);

  if (body.direction) {
    if (!["up", "down"].includes(body.direction)) return error("جهت نامعتبر است.", 400);
    const result = shopCategories.moveCategory(id, auth.user.id, body.direction);
    if (!result.ok) return error(result.error, result.code === "NOT_FOUND" ? 404 : 409);
    return json({ data: { categories: result.categories } });
  }

  const result = shopCategories.renameCategory(id, auth.user.id, body.name);
  if (!result.ok) return error(result.error, result.code === "NOT_FOUND" ? 404 : 409);
  return json({ data: { category: result.category } });
}

export async function DELETE(request) {
  ensureDb();
  const auth = requireUserRole(request, "shop", "فقط فروشگاه.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const result = shopCategories.deleteCategory(Number(body.id), auth.user.id);
  if (!result.ok) {
    if (result.code === "NOT_FOUND") return notFound();
    return error(result.error, 409);
  }
  return json({ data: { ok: true } });
}
