"use client";

import { useRouter } from "next/navigation";
import { ShopStorefrontPage } from "../../features/shops/ShopStorefrontPage";
import { mapShopCard, mapShopProduct } from "../../features/shops/mappers";

// Standalone, unauthenticated rendering of a single shop's public storefront.
// This is the shop counterpart of app/salons/[id]/SalonPublicPageClient.jsx
// and app/artists/[id]/ArtistPublicPageClient.jsx — it reuses the same
// presentation component the in-app (client-state) shop flow uses, but none
// of the interactive actions here (follow/add-to-cart/checkout/chat) have a
// logged-in session or the app's cart/order state to act on. Rather than
// half-implement those without auth, we send the visitor into the SPA shell
// to actually log in and use them. The floating cart/chat dock (ShopStoreDock)
// is intentionally left out for the same reason — it has nothing real to do
// without a session either.
export function ShopPublicPageClient({ shop }) {
  const router = useRouter();
  const goToApp = () => router.push("/");

  // Mirrors the shape useShopWorkspace().selectShop() builds after fetching
  // GET /api/shops/[id]: the directory-card fields via mapShopCard, plus the
  // detail-only fields (categories/reviews/promoCard/productItems) that only
  // the single-shop endpoint returns.
  const card = mapShopCard(shop);
  const productItems = Array.isArray(shop?.products) ? shop.products : [];
  const reviews = Array.isArray(shop?.reviews) ? shop.reviews : [];
  const selectedShop = {
    ...card,
    productItems,
    products: card?.products || String(productItems.length),
    categories: Array.isArray(shop?.categories) ? shop.categories : [],
    reviews,
    promoCard: shop?.promoCard || null
  };
  const catalog = productItems.map(mapShopProduct).filter(Boolean);

  return (
    <ShopStorefrontPage
      active
      selectedShop={selectedShop}
      visibleShops={[]}
      shopCategory="همه"
      catalog={catalog}
      cartItems={[]}
      reviews={reviews}
      loading={false}
      followingShop={false}
      isOwnShop={false}
      onBack={goToApp}
      onFollowShop={goToApp}
      onAddToCart={goToApp}
      onCategoryChange={() => {}}
      onShopSelect={goToApp}
      onNotice={() => {}}
    />
  );
}
