import { ensureDb } from "../../../lib/db/connection.js";
import { error, json, notFound, requireUser, requireUserRole } from "../../../lib/http.js";
import * as shops from "../../../lib/db/repos/shops.js";
import * as messages from "../../../lib/db/repos/messages.js";
import { publishChatEvent } from "../../../lib/chatEvents.js";
import { enrichOrderCards } from "../../../lib/chatOrderCards.js";
import { sendPushToUser } from "../../../lib/push.js";
// Side-effect only: guarantees the 1-hour unacknowledged-order auto-expiry
// sweep (see bookingExpirySweep.js) is running in this process, the same way
// /api/salon-bookings and /api/artist/bookings already guarantee it for
// bookings — without this, a server process that only ever serves shop
// traffic would never start the sweep interval.
import "../../../lib/bookingExpirySweep.js";

export const runtime = "nodejs";

/**
 * A logged-in user's own purchase history, as the buyer — across every shop,
 * not just one. Deliberately role-agnostic (any authenticated user can be a
 * buyer here, same as POST above), and scoped to auth.user.id only. This is
 * separate from GET /api/shop/me (shop-owner's own orders, scoped to their
 * shop) — the two never overlap and neither route changes the other's shape.
 */
export async function GET(request) {
  ensureDb();
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;
  return json({ data: { orders: shops.listOrdersByBuyer(auth.user.id) } });
}

export async function POST(request) {
  ensureDb();
  // Real identity only — a request body's buyerName/buyerPhone must never
  // override (or substitute for) who is actually logged in, or anyone could
  // place orders anonymously or under someone else's name.
  const auth = requireUser(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const shopUserId = Number(body.shopUserId || body.shopId);
  if (!shopUserId) return error("فروشگاه نامعتبر است.", 400);
  const shop = shops.getShop(shopUserId);
  if (!shop) return notFound("فروشگاه یافت نشد.");
  if (!shop.acceptingOrders) {
    return error("این فروشگاه موقتاً سفارش جدید نمی‌پذیرد.", 409);
  }

  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length) return error("سبد خرید خالی است.", 400);

  try {
    const order = shops.createOrder(shopUserId, {
      items,
      buyerUserId: auth.user.id,
      buyerName: auth.user.name || "",
      buyerPhone: auth.user.phone || "",
      idempotencyKey: body.idempotencyKey || ""
    });

    // A replayed (deduped) call already dropped its chat card and its order
    // the first time it went through — doing either again here would leave a
    // duplicate receipt bubble in the chat for a single real purchase.
    const replayed = Boolean(order.replayed);
    delete order.replayed;

    if (!replayed) {
      // Drop a receipt/tracking card into the buyer↔shop chat so "where's my
      // order" has a real, always-current answer instead of nothing at all.
      const conversation = messages.getOrCreateDirectConversation(auth.user.id, shopUserId);
      if (conversation) {
        const sendResult = messages.sendOrderCardMessage(conversation.id, auth.user.id, order.id);
        if (sendResult.ok) {
          enrichOrderCards([sendResult.message]);
          publishChatEvent({ type: "message", conversationId: conversation.id, message: sendResult.message, recipients: sendResult.recipients });
        }
      }
      void sendPushToUser(shopUserId, {
        title: "سفارش جدید",
        body: `${auth.user.name || "خریدار"} — ${order.total ? `${order.total} تومان` : ""}`.trim()
      });
    }

    return json({ data: { order } }, { status: replayed ? 200 : 201 });
  } catch (err) {
    if (err?.code === "insufficient_stock") {
      return error(`موجودی «${err.productName || "محصول"}» کافی نیست.`, 409);
    }
    if (err?.code === "invalid_item") {
      return error("یکی از محصولات سبد خرید معتبر نیست.", 400);
    }
    console.error(err);
    return error("ثبت سفارش انجام نشد.", 500);
  }
}

export async function PATCH(request) {
  const auth = requireUserRole(request, "shop", "فقط فروشگاه.");
  if (!auth.ok) return auth.response;
  const body = await request.json();
  const id = Number(body.id);
  if (!id) return error("شناسه سفارش نامعتبر است.", 400);
  if (!shops.SHOP_ORDER_STATUSES.includes(body.status)) {
    return error("وضعیت نامعتبر است.", 400);
  }
  let order;
  try {
    order = shops.updateOrderStatus(id, auth.user.id, body.status);
  } catch (err) {
    if (err?.code === "invalid_transition") {
      return error("این تغییر وضعیت برای سفارش مجاز نیست.", 409);
    }
    console.error(err);
    return error("تغییر وضعیت سفارش انجام نشد.", 500);
  }
  if (!order) return notFound();

  // Push the new status live to any open order-card bubble in the buyer's
  // or owner's chat — see useChat.js's "order-status" event handling.
  if (order.buyer_user_id) {
    publishChatEvent({
      type: "order-status",
      orderId: order.id,
      status: order.status,
      recipients: [order.buyer_user_id, auth.user.id]
    });
    void sendPushToUser(Number(order.buyer_user_id), {
      title: "وضعیت سفارش شما تغییر کرد",
      body: `سفارش شما — ${order.status}`
    });
  }

  return json({ data: { order } });
}
