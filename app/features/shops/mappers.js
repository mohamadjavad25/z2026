import { formatShopPrice } from "../../shared/lib/money";

export const shopProductBadges = ["جدید", "پرفروش", "ترند", "پیشنهادی", "تخفیف", "لوکس", "VIP", "کم‌موجودی", "ناموجود"];

export const shopProductEnhancePresets = [
  { id: "glow", label: "درخشان", filter: "contrast(1.12) saturate(1.18) brightness(1.06)" },
  { id: "crisp", label: "واضح", filter: "contrast(1.2) saturate(1.05) brightness(1.02)" },
  { id: "soft", label: "نرم", filter: "contrast(0.96) saturate(1.08) brightness(1.08)" },
  { id: "warm", label: "گرم", filter: "contrast(1.08) saturate(1.22) brightness(1.04) sepia(0.08)" }
];

export const shopProductAspectPresets = [
  { id: "1:1", label: "۱:۱ مربعی", value: 1 },
  { id: "4:5", label: "۴:۵ عمودی", value: 4 / 5 },
  { id: "16:9", label: "۱۶:۹ عریض", value: 16 / 9 },
  { id: "3:4", label: "۳:۴ ویترین", value: 3 / 4 }
];

export const shopChatQuickReplies = ["زمان ارسال چقدره؟", "محصول اصله؟", "تخفیف دارید؟", "پرداخت در محل"];

/** Single source of truth for order status — must match SHOP_ORDER_STATUSES in app/lib/db/repos/shops.js. */
export const shopOrderStatuses = ["جدید", "در حال آماده‌سازی", "ارسال شد", "تحویل شد", "لغو شده", "مرجوعی شد"];

/** Persian label per stock-movement reason, for the "تاریخچه انبار" list. */
export const shopStockMovementReasons = {
  sale: "فروش",
  cancel_restock: "بازگشت به انبار (لغو سفارش)",
  return_restock: "بازگشت به انبار (مرجوعی)",
  // Sweep-only reason (see expireStaleOrder in app/lib/db/repos/shops.js) —
  // the shop never acknowledged the order within 1 hour, so it auto-cancelled
  // and its stock came back, same as an active cancel but worded distinctly
  // in the audit trail so the shop can tell the two apart later.
  expire_restock: "بازگشت به انبار (سفارش دیده‌نشده منقضی شد)",
  manual_adjust: "ویرایش دستی",
  product_deleted: "حذف محصول"
};

export function mapShopOrder(order) {
  if (!order) return null;
  return {
    id: order.id,
    buyerName: order.buyer_name || order.buyerName || "مشتری",
    buyerPhone: order.buyer_phone || order.buyerPhone || "",
    status: order.status || "جدید",
    total: order.total || "",
    totalNum: Number(order.total_num ?? order.totalNum ?? 0),
    createdAt: order.created_at || order.createdAt || "",
    items: Array.isArray(order.items) ? order.items : []
  };
}

const shopPlaceholderPalette = [
  "#ff6a88",
  "#7f5cff",
  "#9708cc",
  "#fda085",
  "#2f80ed",
  "#f78ca0",
  "#30cfd0",
  "#4caf82"
];

/** Deterministic pseudo-random placeholder color per shop (stable across renders). */
export function pickShopPlaceholderColor(seed) {
  const text = String(seed ?? "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return shopPlaceholderPalette[hash % shopPlaceholderPalette.length];
}

export function getShopProductTone(stock) {
  const qty = Number(stock) || 0;
  if (qty <= 0) return "off";
  if (qty <= 5) return "warn";
  return "ok";
}

export function resolveShopProductBadge(badge, stock) {
  const qty = Number(stock) || 0;
  if (qty <= 0) return "ناموجود";
  if (qty <= 5 && (!badge || badge === "ناموجود")) return "کم‌موجودی";
  return badge || "جدید";
}


/** Story fields from any entity payload (server/mapper shape) — spreadable. */
export function pickStoryFields(entity = {}) {
  const video = entity.storyVideo || entity.story_video || entity.introVideo || entity.intro_video || "";
  const poster = entity.storyPoster || entity.story_poster || entity.introPoster || entity.intro_poster || "";
  if (!video && !poster) return {};
  return {
    ...(video ? {
      storyVideo: video,
      story_video: video,
      introVideo: video,
      intro_video: video
    } : {}),
    ...(poster ? {
      storyPoster: poster,
      story_poster: poster,
      introPoster: poster,
      intro_poster: poster
    } : {})
  };
}

export function mapShopCard(shop) {
  if (!shop) return null;
  return {
    id: shop.id,
    name: shop.name || "",
    area: shop.area || "",
    category: shop.category || "ترکیبی",
    rating: shop.rating || "",
    products: shop.productCount ? String(shop.productCount) : "۰",
    delivery: shop.delivery || "ارسال هماهنگ",
    badge: shop.badge || "",
    image: shop.avatar || shop.image || "",
    placeholderColor: pickShopPlaceholderColor(shop.id ?? shop.name),
    tone: shop.tone || "shopRose",
    about: shop.bio || shop.about || "",
    followers: shop.followers ?? shop.followerCount ?? 0,
    orders: shop.orders || "۰",
    eta: shop.eta || "",
    phone: shop.phone || "",
    email: shop.email || "",
    acceptingOrders: shop.acceptingOrders !== false,
    ...pickStoryFields(shop)
  };
}

export function mapShopProduct(product) {
  if (!product) return null;
  const stock = Number(product.stock || 0);
  return {
    id: product.id,
    name: product.name || "",
    category: product.category || "میکاپ",
    price: product.price || "",
    priceNum: Number(product.priceNum || 0),
    stock,
    sold: product.sold || 0,
    badge: product.badge || "",
    image: product.image || "",
    description: product.description || "",
    featured: Boolean(product.featured),
    tone: product.tone || getShopProductTone(stock)
  };
}

export { formatShopPrice };
