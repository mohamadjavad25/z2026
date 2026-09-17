import { notFound } from "next/navigation";
import { ensureDb } from "../../lib/db/connection.js";
import * as shops from "../../lib/db/repos/shops.js";
import { ShopPublicPageClient } from "./ShopPublicPageClient";

export const runtime = "nodejs";

function loadShop(id) {
  const userId = Number(id);
  if (!Number.isFinite(userId)) return null;
  ensureDb();
  const shop = shops.getShop(userId);
  if (!shop) return null;
  // A shop switched to "خصوصی" in تنظیمات → ویترین عمومی فروشگاه must stay
  // hidden here too — GET /api/shops/[id] enforces the exact same rule for
  // any viewer who isn't the owner, and this standalone public route never
  // has a logged-in viewer to be the owner.
  if (!shop.isPublic) return null;
  // node:sqlite's .all()/.get() rows are null-prototype objects. That's fine
  // for JSON.stringify (used by the API routes), but React's RSC boundary
  // rejects null-prototype objects when passing this Server Component's data
  // down to the "use client" ShopPublicPageClient. Round-tripping through
  // JSON strips the prototype and gives plain objects/arrays throughout
  // (products/categories/reviews/promoCard), which is what the client
  // boundary needs.
  return JSON.parse(JSON.stringify(shop));
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const shop = loadShop(id);
  if (!shop) {
    return { title: "فروشگاه پیدا نشد | زیبابان" };
  }

  const productCount = Number(shop.productCount || 0);
  const ratingValue = Number(shop.rating);
  const facts = [];
  if (shop.category) facts.push(shop.category);
  if (shop.area) facts.push(`در ${shop.area}`);
  if (Number.isFinite(ratingValue) && ratingValue > 0) facts.push(`امتیاز ${ratingValue.toFixed(1)} از ۵`);
  if (productCount > 0) facts.push(`${productCount} محصول`);

  const description = facts.length
    ? `${shop.name} ${facts.join(" · ")} — خرید آنلاین از زیبابان.`
    : `ویترین آنلاین فروشگاه ${shop.name} در زیبابان.`;

  const title = `${shop.name} | زیبابان`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: shop.avatar ? [{ url: shop.avatar }] : undefined
    }
  };
}

export default async function ShopPublicPage({ params }) {
  const { id } = await params;
  const shop = loadShop(id);
  if (!shop) {
    notFound();
  }

  return <ShopPublicPageClient shop={shop} />;
}
