"use client";

import { useState } from "react";
import {
  BadgeCheck,
  ChevronRight,
  Heart,
  MessageCircle,
  Package,
  Plus,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Truck
} from "lucide-react";
import { SkeletonList } from "../../components/Skeleton";
import { ProfileEmptyState } from "../profile/ProfileEmptyState";
import { shopCategories } from "../../shared/constants/categories";
import { formatCount } from "../../shared/lib/rating";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatShopPrice } from "../../shared/lib/money";
import { PublicStoryBanner, usePublicStory } from "../../components/PublicStoryBanner";
import { StudioInfoCard } from "./StudioInfoCard";
import { getPromoCardIcon } from "./promoCardTypes";

/** Flat, single-accent star row — matches the artist public page's review stars. */
function CleanStars({ value = 0, max = 5, size = 13 }) {
  const filled = Math.max(0, Math.min(max, Math.round(Number(value) || 0)));
  return (
    <span
      className="shopStoreCleanStars"
      role="img"
      aria-label={`امتیاز ${toPersianDigits(String(value))} از ${toPersianDigits(String(max))}`}
    >
      {Array.from({ length: max }, (_, index) => (
        <Star
          key={index}
          size={size}
          strokeWidth={1.5}
          className={index < filled ? "is-filled" : "is-empty"}
          fill={index < filled ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

function ShopProductCard({ product, inCart, liked, acceptingOrders, onToggleLike, onAddToCart }) {
  return (
    <article className={`shopStoreProduct ${inCart ? "is-inCart" : ""}`}>
      <div className="shopStoreProductMedia">
        <img src={product.image} alt={product.name} loading="lazy" />
        {product.badge ? <span className={`shopStoreProductBadge badge-${product.badge}`}>{product.badge}</span> : null}
        {product.tone === "off" ? <span className="shopStoreProductSoldOut">ناموجود</span> : null}
        {inCart ? <small className="shopStoreProductQty">{inCart.qty}×</small> : null}
        <button
          type="button"
          className={`shopStoreProductLike ${liked ? "is-liked" : ""}`}
          aria-label={`ذخیره ${product.name}`}
          onClick={onToggleLike}
        >
          <Heart size={16} fill={liked ? "currentColor" : "none"} />
        </button>
      </div>
      <div className="shopStoreProductBody">
        <small>{product.category}</small>
        <h3>{product.name}</h3>
        {product.sold > 0 ? <p>{toPersianDigits(product.sold)} فروش</p> : null}
        <div className="shopStoreProductMeta">
          <div className="shopStorePrice">
            <b>{product.priceNum > 0 ? formatShopPrice(product.priceNum) : product.price}</b>
            {product.oldPrice ? <s>{product.oldPrice}</s> : null}
          </div>
          <button
            type="button"
            aria-label={`افزودن ${product.name} به سبد`}
            disabled={!acceptingOrders || product.stock <= 0}
            onClick={onAddToCart}
          >
            <Plus size={16} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function ShopStorefrontPage({
  active,
  selectedShop,
  visibleShops,
  shopCategory,
  catalog,
  cartItems,
  reviews,
  loading = false,
  productsRef,
  reviewsRef,
  followingShop,
  isOwnShop = false,
  onBack,
  onFollowShop,
  onAddToCart,
  onCategoryChange,
  onShopSelect,
  onNotice
}) {
  const cartCount = cartItems.reduce((sum, item) => sum + (item.qty || 1), 0);
  const hasRating = Boolean(selectedShop?.rating);
  const acceptingOrders = selectedShop?.acceptingOrders !== false;
  const [likedProducts, setLikedProducts] = useState(() => new Set());

  function handleAddToCart(product) {
    if (!acceptingOrders) {
      onNotice?.("این فروشگاه موقتاً سفارش جدید نمی‌پذیرد.");
      return;
    }
    onAddToCart(product);
  }


  const storyVideoSrc = selectedShop?.storyVideo || selectedShop?.story_video || selectedShop?.introVideo || selectedShop?.intro_video || "";
  const storyPosterSrc = selectedShop?.storyPoster || selectedShop?.story_poster || selectedShop?.introPoster || selectedShop?.intro_poster || selectedShop?.image || "/salon-public-hero.png";
  const story = usePublicStory({ storyVideoSrc, storyPosterSrc });

  function toggleLikedProduct(productId) {
    setLikedProducts((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  const featuredProducts = catalog.filter((product) => product.featured);

  // Real created categories (creation order) first, then any category
  // string still sitting on a product that isn't formally created yet —
  // same fallback shape as the owner dashboard's rows, so a product never
  // just vanishes from the public page.
  const knownCategoryNames = Array.isArray(selectedShop?.categories) ? selectedShop.categories : [];
  const categoryNameSet = new Set(knownCategoryNames);
  const categoryNames = [...knownCategoryNames];
  catalog.forEach((product) => {
    const name = String(product.category || "").trim();
    if (name && !categoryNameSet.has(name)) {
      categoryNameSet.add(name);
      categoryNames.push(name);
    }
  });
  const categoryRows = categoryNames
    .map((name) => ({ name, items: catalog.filter((product) => product.category === name) }))
    .filter((row) => row.items.length > 0);

  function copyShopLink(url) {
    if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
    navigator.clipboard.writeText(url)
      .then(() => onNotice?.(`لینک ${selectedShop.name} کپی شد.`))
      .catch(() => onNotice?.("کپی لینک انجام نشد؛ دوباره امتحان کن."));
  }

  function shareShop() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const payload = {
      title: selectedShop.name,
      text: `${selectedShop.name} · ${selectedShop.category} · زیبابان`,
      url
    };
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      navigator.share(payload).catch(() => copyShopLink(url));
      return;
    }
    copyShopLink(url);
  }

  return (
    <section className={`shopsPanel mobilePage page-shops ${active ? "is-active" : ""}`} id="shops" aria-label="فروشگاه‌های آرایشی">
      {selectedShop ? (
        <section className={`shopStorefront ${selectedShop.tone} ${story.storyStateClasses}`} aria-label={`صفحه فروش ${selectedShop.name}`}>
          {/* ── Hero ── */}
          <PublicStoryBanner
            story={story}
            heroClassName="shopStoreHero"
            heroImage={storyPosterSrc}
            topbar={(
              <div className="shopStoreTopbar">
                <button type="button" className="shopStoreRoundButton shopStoreBackButton" onClick={onBack} aria-label="بازگشت به فروشگاه‌ها">
                  <ChevronRight size={20} />
                </button>
                <button type="button" className="shopStoreRoundButton shopStoreShareButton" onClick={shareShop} aria-label="اشتراک‌گذاری">
                  <Share2 size={20} />
                </button>
              </div>
            )}
            emptyTitle="استوری معرفی هنوز آماده نیست"
            emptyText="وقتی فروشگاه ویدیوی معرفی اضافه کند، همین‌جا مثل یک استوری پخش می‌شود."
          />

          <section className="shopStoreIdentityCard">
            <div className="shopStoreLogoBlock">
              <div
                className="shopStoreLogo publicStoryLogo"
                role={story.logoHandlers.role}
                tabIndex={story.logoHandlers.tabIndex}
                aria-label="مشاهده استوری فروشگاه"
                onPointerDown={story.logoHandlers.onPointerDown}
                onPointerMove={story.logoHandlers.onPointerMove}
                onPointerUp={story.logoHandlers.onPointerUp}
                onPointerCancel={story.logoHandlers.onPointerCancel}
                onClick={story.logoHandlers.onClick}
                onDoubleClick={story.logoHandlers.onDoubleClick}
                onKeyDown={story.logoHandlers.onKeyDown}
              >
                {selectedShop.image ? (
                  <img className="shopStoreLogoImage" src={selectedShop.image} alt="" aria-hidden="true" />
                ) : (
                  <Store size={34} />
                )}
              </div>
              <b className="shopStoreLogoRating">
                {hasRating ? (
                  <>
                    {toPersianDigits(selectedShop.rating)}
                    <Star size={10} fill="currentColor" aria-hidden="true" />
                  </>
                ) : (
                  "جدید"
                )}
              </b>
            </div>

            <div className="shopStoreTitle">
              <h2>
                {selectedShop.name}
                <BadgeCheck className="shopStoreVerifiedIcon" size={18} />
              </h2>
              <span>{selectedShop.area}</span>
            </div>
            <div className="shopStoreStatsRow" aria-label="آمار فروشگاه">
              <span><b>{formatCount(selectedShop.followers)}</b> دنبالکننده</span>
              <span><b>{toPersianDigits(selectedShop.orders || 0)}</b> سفارش</span>
            </div>
            <div className="shopStoreActions">
              {!isOwnShop && (
                <button
                  type="button"
                  className={`shopStoreFollow ${followingShop ? "is-following" : ""}`}
                  onClick={() => onFollowShop(selectedShop)}
                >
                  <Heart size={16} />
                  {followingShop ? "دنبال میکنی" : "فالو"}
                </button>
              )}
            </div>
          </section>

          {selectedShop.promoCard ? (
            <div className="shopStorePromoCard">
              <StudioInfoCard
                icon={getPromoCardIcon(selectedShop.promoCard.icon)}
                tone={selectedShop.promoCard.tone}
                value={selectedShop.promoCard.primary}
                label={selectedShop.promoCard.secondary || ""}
              />
            </div>
          ) : null}

          {!acceptingOrders && (
            <div className="shopStoreClosedBanner" role="status">
              <Truck size={16} />
              <span>{isOwnShop ? "فروشگاهت موقتاً سفارش جدید نمی‌پذیرد — از تنظیمات «آمادگی ارسال» را فعال کن." : "این فروشگاه موقتاً سفارش جدید نمی‌پذیرد."}</span>
            </div>
          )}

          {/* ── Featured showcase — the product editor promises featured items show up here ── */}
          {!loading && featuredProducts.length > 0 && (
            <section className="shopStoreCard shopStoreProductsCard shopStoreFeaturedSection" aria-label="ویترین ویژه فروشگاه">
              <div className="shopStoreSectionHead">
                <h3>ویترین ویژه</h3>
                <div className="shopStoreHeadActions">
                  <button type="button">{toPersianDigits(featuredProducts.length)} آیتم</button>
                </div>
              </div>
              <div className="shopStoreFeaturedRail">
                {featuredProducts.map((product) => (
                  <article className="shopStoreFeaturedCardItem" key={product.id}>
                    <div className="shopStoreFeaturedMedia">
                      <img src={product.image} alt={product.name} loading="lazy" />
                      {product.tone === "off" ? <span className="shopStoreProductSoldOut">ناموجود</span> : null}
                    </div>
                    <div className="shopStoreFeaturedBody">
                      <small>{product.category}</small>
                      <b>{product.name}</b>
                      <div className="shopStoreFeaturedMeta">
                        <span>{product.priceNum > 0 ? formatShopPrice(product.priceNum) : product.price}</span>
                        <button
                          type="button"
                          aria-label={`افزودن ${product.name} به سبد`}
                          disabled={!acceptingOrders || product.stock <= 0}
                          onClick={() => handleAddToCart(product)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* ── Products, as one horizontally-scrolling row per category ── */}
          <div ref={productsRef}>
            {loading ? (
              <section className="shopStoreCard shopStoreProductsCard">
                <div className="shopStoreSectionHead"><h3>محصولات</h3></div>
                <SkeletonList rows={4} variant="card" className="shopStoreCatalogSkeleton" label="در حال بارگذاری محصولات فروشگاه" />
              </section>
            ) : catalog.length === 0 ? (
              <section className="shopStoreCard shopStoreProductsCard">
                <div className="shopStoreSectionHead"><h3>محصولات</h3></div>
                <ProfileEmptyState
                  className="shopStoreEmptyState"
                  role="status"
                  icon={Package}
                  title="هنوز محصولی در ویترین نیست"
                  description={
                    isOwnShop
                      ? "از پنل فروشگاه، اولین محصولت را اضافه کن تا ویترین آماده شود."
                      : "با دنبال کردن، از محصولات جدید این فروشگاه خبردار می‌شوی"
                  }
                />
              </section>
            ) : (
              categoryRows.map((row) => (
                <section className="shopStoreCard shopStoreProductsCard" key={row.name} aria-label={row.name}>
                  <div className="shopStoreSectionHead">
                    <h3>{row.name}</h3>
                    <div className="shopStoreHeadActions">
                      <button type="button">{toPersianDigits(row.items.length)} آیتم</button>
                    </div>
                  </div>
                  <div className="shopStoreCategoryRail">
                    {row.items.map((product) => (
                      <ShopProductCard
                        key={product.id}
                        product={product}
                        inCart={cartItems.find((item) => item.id === product.id)}
                        liked={likedProducts.has(product.id)}
                        acceptingOrders={acceptingOrders}
                        onToggleLike={() => toggleLikedProduct(product.id)}
                        onAddToCart={() => handleAddToCart(product)}
                      />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>

          {/* ── Reviews ── */}
          <section className="shopStoreReviewsSection" aria-label="نظرات مشتریان">
            <div className="shopStoreSectionHead">
              <h3>نظر مشتریان</h3>
            </div>

            {selectedShop.reviewCount > 0 ? (
              <div className="shopStoreReviewSummary">
                <div className="shopStoreReviewSummaryScore">
                  <b>{toPersianDigits(selectedShop.rating || "۰")}</b>
                  <CleanStars value={selectedShop.rating || 0} />
                </div>
                <span className="shopStoreReviewSummaryCount">
                  {toPersianDigits(selectedShop.reviewCount)} نظر ثبت‌شده
                </span>
              </div>
            ) : null}

            <div
              className="shopStoreReviewList"
              ref={reviewsRef}
              role="list"
              aria-label="نظرات مشتریان"
            >
              {loading ? (
                <SkeletonList rows={2} variant="list" label="در حال بارگذاری نظرات" />
              ) : reviews.length === 0 ? (
                <ProfileEmptyState
                  className="shopStoreEmptyState shopStoreEmptyReviews"
                  role="status"
                  icon={MessageCircle}
                  title="هنوز نظری ثبت نشده"
                  description="اولین خریداران می‌توانند تجربهٔ خود را اینجا بنویسند تا بقیه مطمئن‌تر انتخاب کنند."
                />
              ) : (
                reviews.map((review, index) => (
                  <article className="shopStoreReviewCard" key={`${review.name}-${review.rating}-${index}`} role="listitem">
                    <span className="shopStoreReviewAvatar">{review.name?.[0] || "م"}</span>
                    <div className="shopStoreReviewMain">
                      <div className="shopStoreReviewTop">
                        <b>{review.name}</b>
                        {review.service ? (
                          <small className="shopStoreReviewService">{review.service}</small>
                        ) : null}
                      </div>
                      <div className="shopStoreReviewMetaRow">
                        <CleanStars value={review.rating} size={12} />
                        <span className="shopStoreReviewRate">{toPersianDigits(String(review.rating))}</span>
                      </div>
                      {review.text ? <p>{review.text}</p> : null}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

        </section>
      ) : (
        <>
          <div className="exploreHead">
            <div>
              <span>خرید آنلاین</span>
              <strong>فروشگاه‌های آرایشی</strong>
            </div>
            <b>{visibleShops.length} فروشگاه</b>
          </div>
          <div className="categoryRail" role="tablist" aria-label="فیلتر دسته فروشگاه">
            {shopCategories.map((cat) => (
              <button
                type="button"
                role="tab"
                aria-selected={shopCategory === cat}
                className={shopCategory === cat ? "active" : ""}
                key={cat}
                onClick={() => onCategoryChange(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="shopCards">
            {visibleShops.length === 0 ? (
              <div className="emptyShopDirectory">
                <img src="/shops-empty-illustration.png" alt="" aria-hidden="true" />
                <div>
                  <b>فروشگاه‌ها اینجا نمایش داده می‌شوند</b>
                </div>
              </div>
            ) : null}
            {visibleShops.map((shop) => (
              <article
                className={`shopCard ${shop.tone}`}
                key={shop.id || shop.name}
                aria-label={shop.name}
                role="button"
                tabIndex={0}
                onClick={() => onShopSelect(shop, true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onShopSelect(shop, false);
                  }
                }}
              >
                <div className="shopCardMedia">
                  {shop.image ? (
                    <img className="shopCardImage" src={shop.image} alt="" aria-hidden="true" />
                  ) : (
                    <div
                      className="shopCardImage shopCardImagePlaceholder"
                      style={{ background: shop.placeholderColor }}
                      aria-hidden="true"
                    >
                      <Store size={26} />
                    </div>
                  )}
                  {shop.badge ? <span className="shopCardBadge">{shop.badge}</span> : null}
                </div>
                <div className="shopCardBody">
                  <div className="shopCardHead">
                    <span className="shopCardTag">{shop.category}</span>
                    {shop.rating ? (
                      <span className="shopCardRatingValue" aria-label={`امتیاز ${shop.rating}`}>
                        <Star size={12} fill="currentColor" />
                        {toPersianDigits(shop.rating)}
                      </span>
                    ) : (
                      <span className="shopCardNewTag">جدید</span>
                    )}
                  </div>
                  <h3>{shop.name}</h3>
                  <div className="shopCardMeta">
                    <span>{shop.area} · {shop.products} محصول</span>
                    <span>{shop.delivery}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onShopSelect(shop, false);
                    }}
                  >
                    <ShoppingBag size={15} />
                    مشاهده فروشگاه
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
