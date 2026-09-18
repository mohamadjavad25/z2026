import { notFound } from "next/navigation";
import { ensureDb } from "../../lib/db/connection.js";
import * as shops from "../../lib/db/repos/shops.js";
import { ShopPublicPageClient } from "./ShopPublicPageClient";

export const runtime = "nodejs";

// Same single source of truth as app/sitemap.js, app/robots.js and
// app/layout.jsx's metadataBase — never hardcode the domain a second time.
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://zibaban.example.com";

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
  const canonicalUrl = `${SITE_URL}/shops/${shop.id}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      images: shop.avatar ? [{ url: shop.avatar }] : undefined
    }
  };
}

// Builds Store JSON-LD from real shop fields only. shop.reviewCount/rating
// (app/lib/db/repos/shops.js mapShop()) are a real COUNT/AVG over the
// reviews table — not a static fallback column — so aggregateRating is
// trustworthy here whenever reviewCount > 0.
//
// Deliberately NOT emitting per-product Offer price/priceCurrency here: this
// task's scope excludes wallet/shell-currency logic, and shop prices in this
// codebase are formatted strings whose currency unit (rial vs. toman) is
// exactly the kind of ambiguity that area owns — stating a currency in
// structured data would risk asserting something we can't verify. Product
// names/images (real catalog data, no pricing) are included instead so the
// real product count still shows up to crawlers.
function buildShopJsonLd(shop, canonicalUrl) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: shop.name,
    url: canonicalUrl
  };
  if (shop.avatar) jsonLd.image = shop.avatar;
  if (shop.bio) jsonLd.description = shop.bio;
  // Deliberately NOT emitting telephone: shop.phone is the users.phone
  // column, which is this account's LOGIN credential (see getUserByPhone in
  // app/lib/db/repos/users.js) — not a business contact number the owner
  // chose to publish. It isn't shown anywhere on ShopPublicPageClient
  // either, so putting it in crawlable, Google-cached JSON-LD would leak
  // private auth data the visible page itself never exposes. Re-add this
  // only once the data model has a distinct "public business phone" field
  // the owner explicitly opts into.
  if (shop.area) {
    jsonLd.address = {
      "@type": "PostalAddress",
      addressLocality: shop.area,
      addressCountry: "IR"
    };
  }
  const reviewCount = Number(shop.reviewCount || 0);
  const ratingValue = Number(shop.rating);
  if (reviewCount > 0 && Number.isFinite(ratingValue) && ratingValue > 0) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue,
      reviewCount
    };
  }
  const products = Array.isArray(shop.products) ? shop.products : [];
  if (products.length > 0) {
    jsonLd.hasOfferCatalog = {
      "@type": "OfferCatalog",
      name: `محصولات ${shop.name}`,
      itemListElement: products.map((product) => {
        const item = { "@type": "Product", name: product.name };
        if (product.image) item.image = product.image;
        return item;
      })
    };
  }
  return jsonLd;
}

export default async function ShopPublicPage({ params }) {
  const { id } = await params;
  const shop = loadShop(id);
  if (!shop) {
    notFound();
  }
  const canonicalUrl = `${SITE_URL}/shops/${shop.id}`;
  const jsonLd = buildShopJsonLd(shop, canonicalUrl);

  return (
    <>
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      <ShopPublicPageClient shop={shop} />
    </>
  );
}
