import { error, json, notFound, requireUserRole } from "../../../lib/http.js";
import * as shops from "../../../lib/db/repos/shops.js";

export const runtime = "nodejs";

export async function GET(request) {
  const auth = requireUserRole(request, "shop", "فقط فروشگاه.");
  if (!auth.ok) return auth.response;
  return json({
    data: {
      products: shops.listProducts(auth.user.id),
      orders: shops.listOrders(auth.user.id),
      stockMovements: shops.listStockMovements(auth.user.id, { limit: 50 })
    }
  });
}

export async function POST(request) {
  const auth = requireUserRole(request, "shop", "فقط فروشگاه.");
  if (!auth.ok) return auth.response;
  const body = await request.json();

  const name = String(body.name || "").trim();
  if (!name) return error("نام محصول لازم است.", 400);
  const priceNum = Number(body.priceNum);
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    return error("قیمت محصول نامعتبر است.", 400);
  }
  const stock = Number(body.stock);
  if (!Number.isFinite(stock) || stock < 0) {
    return error("موجودی محصول نامعتبر است.", 400);
  }
  if (typeof body.image === "string" && body.image.length > 4_000_000) {
    return error("حجم تصویر محصول خیلی زیاد است.", 400);
  }

  const product = shops.addProduct(auth.user.id, body);
  return json({ data: { product } }, { status: 201 });
}

export async function PATCH(request) {
  const auth = requireUserRole(request, "shop", "فقط فروشگاه.");
  if (!auth.ok) return auth.response;
  const body = await request.json();

  if (body.name != null && !String(body.name).trim()) {
    return error("نام محصول لازم است.", 400);
  }
  if (body.priceNum != null && (!Number.isFinite(Number(body.priceNum)) || Number(body.priceNum) < 0)) {
    return error("قیمت محصول نامعتبر است.", 400);
  }
  if (body.stock != null && (!Number.isFinite(Number(body.stock)) || Number(body.stock) < 0)) {
    return error("موجودی محصول نامعتبر است.", 400);
  }
  if (typeof body.image === "string" && body.image.length > 4_000_000) {
    return error("حجم تصویر محصول خیلی زیاد است.", 400);
  }

  const product = shops.updateProduct(Number(body.id), auth.user.id, body);
  if (!product) return notFound();
  return json({ data: { product } });
}

export async function DELETE(request) {
  const auth = requireUserRole(request, "shop", "فقط فروشگاه.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  let ok;
  try {
    ok = shops.deleteProduct(Number(body.id), auth.user.id);
  } catch (err) {
    if (err?.code === "has_active_orders") {
      return error("این محصول سفارش در حال پردازش دارد؛ ابتدا آن سفارش را تحویل بده یا لغو کن.", 409);
    }
    console.error(err);
    return error("حذف محصول انجام نشد.", 500);
  }
  if (!ok) return notFound();
  return json({ data: { ok: true } });
}
