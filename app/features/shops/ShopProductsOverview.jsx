"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, BadgeCheck, Bell, Check, Eye, MoreVertical, Plus, Settings, Star, Store, Trash2 } from "lucide-react";
import { SkeletonList } from "../../components/Skeleton";
import { toPersianDigits } from "../../shared/lib/digits";
import { ProfileStoryCreator } from "../../components/ProfileStoryCreator";
import { StudioPromoCard } from "./StudioPromoCard";

function ProductRowCard({ product, onOpen }) {
  return (
    <article
      className="studioCard studioRowCard"
      role="button"
      tabIndex={0}
      aria-label={`مشاهده ${product.name}`}
      onClick={() => onOpen?.(product)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen?.(product);
        }
      }}
    >
      <div className={`studioCardMedia ${product.image ? "" : "is-empty"}`}>
        {product.image ? <img src={product.image} alt="" aria-hidden="true" /> : <Store size={20} />}
        {product.featured ? (
          <span className="studioCardFeatured"><Star size={11} fill="currentColor" /></span>
        ) : null}
      </div>
      <div className="studioCardBody">
        <b>{product.name}</b>
        <span>موجودی {toPersianDigits(product.stock)}</span>
        <div className="studioCardMeta">
          <b>{product.price}</b>
          <small>{toPersianDigits(product.sold)} فروش</small>
        </div>
      </div>
    </article>
  );
}

/** Inline rename + reorder + delete panel for one real category row. */
function CategoryManagePanel({ category, isFirst, isLast, busy, onRename, onMove, onDelete, onClose }) {
  const [name, setName] = useState(category.name);
  return (
    <div className="studioCategoryManage">
      <form
        className="studioCategoryManageRename"
        onSubmit={(event) => {
          event.preventDefault();
          const trimmed = name.trim();
          if (trimmed && trimmed !== category.name) onRename(trimmed);
        }}
      >
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={busy}
          aria-label="نام دسته"
        />
        <button type="submit" className="studioGhostIcon" disabled={busy || !name.trim()} aria-label="ذخیره نام">
          <Check size={14} />
        </button>
      </form>
      <div className="studioCategoryManageActions">
        <button type="button" className="studioGhostIcon" disabled={busy || isFirst} onClick={() => onMove("up")} aria-label="جابه‌جایی به بالا">
          <ArrowUp size={14} />
        </button>
        <button type="button" className="studioGhostIcon" disabled={busy || isLast} onClick={() => onMove("down")} aria-label="جابه‌جایی به پایین">
          <ArrowDown size={14} />
        </button>
        <button type="button" className="studioGhostIcon is-danger" disabled={busy} onClick={onDelete} aria-label="حذف دسته">
          <Trash2 size={14} />
        </button>
        <button type="button" className="studioLinkButton is-muted" onClick={onClose}>بستن</button>
      </div>
    </div>
  );
}

/** One horizontally-scrolling product row — featured, or one real category. */
function ProductRow({
  title,
  items,
  onOpenProduct,
  onAddProduct,
  category = null,
  isFirst = false,
  isLast = false,
  categoryBusy = false,
  onRenameCategory,
  onMoveCategory,
  onDeleteCategory
}) {
  const [managing, setManaging] = useState(false);
  return (
    <section className="studioSection" aria-label={title}>
      <div className="studioSectionHead">
        <div className="studioSectionTitleRow">
          <h3>{title}</h3>
          {category ? (
            <button
              type="button"
              className={`studioCategoryMenuButton ${managing ? "is-active" : ""}`}
              aria-label={`مدیریت دسته ${title}`}
              onClick={() => setManaging((current) => !current)}
            >
              <MoreVertical size={15} />
            </button>
          ) : null}
        </div>
        <span className="studioEyebrow">{toPersianDigits(items.length)} آیتم</span>
      </div>
      {managing && category ? (
        <CategoryManagePanel
          category={category}
          isFirst={isFirst}
          isLast={isLast}
          busy={categoryBusy}
          onRename={(name) => onRenameCategory?.(category.id, name)}
          onMove={(direction) => onMoveCategory?.(category.id, direction)}
          onDelete={async () => {
            const ok = await onDeleteCategory?.(category.id);
            if (ok) setManaging(false);
          }}
          onClose={() => setManaging(false)}
        />
      ) : null}
      <div className="studioRow">
        <button type="button" className="studioCard studioCardGhost studioRowCard" onClick={onAddProduct}>
          <Plus size={18} />
          <span>افزودن محصول</span>
        </button>
        {items.map((product) => (
          <ProductRowCard key={product.id} product={product} onOpen={onOpenProduct} />
        ))}
      </div>
    </section>
  );
}

/**
 * Shop owner — products overview / seller home on profile overview.
 * Products are organized as horizontally-scrolling rows: "ویژه" (featured)
 * first, then one row per real category (shop_categories — an owned list,
 * not just whatever string happens to sit on a product), each row carrying
 * its own "add product" tile. A shop with nothing yet still gets the
 * classic single empty-state instead of a wall of empty rows.
 */
export function ShopProductsOverview({
  profile,
  products = [],
  categories = [],
  onCreateCategory,
  onRenameCategory,
  onMoveCategory,
  onDeleteCategory,
  categoryBusy = false,
  promoCards = [],
  promoCardBusy = false,
  onCreatePromoCard,
  onActivatePromoCard,
  onDeletePromoCard,
  orders = [],
  loading = false,
  onOpenProduct,
  onCreateProduct,
  onOpenOrders,
  onOpenInsights,
  onOpenSettings,
  onPreviewPublic,
  onStorySave,
  onStoryDelete
}) {
  const [storyCreatorOpen, setStoryCreatorOpen] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const shopName = profile?.data?.name || profile?.name || "فروشگاه من";
  const shopCategory = profile?.data?.service || profile?.data?.category || "فروشگاه آرایشی و بهداشتی";
  const shopAvatar = profile?.data?.avatar || profile?.avatar || "";
  const shopStoryVideo = profile?.data?.storyVideo || profile?.data?.story_video || profile?.data?.introVideo || profile?.data?.intro_video || "";
  const shopStoryPoster = profile?.data?.storyPoster || profile?.data?.story_poster || profile?.data?.introPoster || profile?.data?.intro_poster || "";

  const totalRevenue = orders.reduce((sum, order) => sum + (Number(order.totalNum) || 0), 0);
  const activeProductCount = products.filter((product) => Number(product.stock || 0) > 0).length;

  const featuredProducts = useMemo(
    () => products.filter((product) => product.featured && product.tone !== "off"),
    [products]
  );

  const categoryRows = useMemo(() => {
    const byName = new Map();
    categories.forEach((category) => byName.set(category.name, { id: category.id, name: category.name, items: [] }));
    products.forEach((product) => {
      const name = String(product.category || "").trim();
      if (!name) return;
      if (!byName.has(name)) byName.set(name, { id: null, name, items: [] });
      byName.get(name).items.push(product);
    });
    return Array.from(byName.values());
  }, [products, categories]);
  const realCategoryIds = categories.map((category) => category.id);

  async function handleCreateCategory() {
    const ok = await onCreateCategory?.(newCategoryName);
    if (ok) {
      setNewCategoryName("");
      setAddingCategory(false);
    }
  }

  const hasCatalog = products.length > 0 || categories.length > 0;

  return (
    <div className="shopRefDashboard shopOwnerMobileDashboard studioPage" aria-label="داشبورد فروشگاه">
      <div
        className={`shopHeroPoster ${shopStoryPoster ? "has-poster" : ""}`}
        style={shopStoryPoster ? { backgroundImage: `url("${shopStoryPoster}")` } : undefined}
      >
        <div className="studioHeroTopActions">
          <button type="button" className="studioHeroGlassIcon" aria-label="اعلان‌های فروشگاه">
            <Bell size={16} />
          </button>
          <button type="button" className="studioHeroGlassIcon" aria-label="تنظیمات فروشگاه" onClick={onOpenSettings}>
            <Settings size={16} />
          </button>
        </div>
      </div>
      <div className="studioTopBar">
        <span className="studioAvatar" onClick={() => setStoryCreatorOpen(true)}>
          {shopAvatar ? <img src={shopAvatar} alt="" aria-hidden="true" /> : <Store size={28} />}
          <ProfileStoryCreator
            profileType="shop"
            storyVideo={shopStoryVideo}
            storyPoster={shopStoryPoster}
            onSave={onStorySave}
            onDelete={onStoryDelete}
            open={storyCreatorOpen}
            onOpenChange={setStoryCreatorOpen}
          />
        </span>
        <div className="studioIdentity">
          <strong>
            <span className="studioIdentityNameText">{shopName}</span>
            <BadgeCheck className="studioVerifiedTick" size={15} aria-label="تایید شده" />
          </strong>
          <small>{shopCategory}</small>
        </div>
        <div className="studioTopBarIcons">
          <button type="button" className="studioGhostIcon" aria-label="پیش‌نمایش صفحه عمومی" title="پیش‌نمایش صفحه عمومی" onClick={onPreviewPublic}>
            <Eye size={15} />
          </button>
        </div>
      </div>

      <section className="studioHero">
        <div className="studioLedger studioHeroLedger" aria-label="خلاصه فروش">
          <div className="studioStat">
            <b className="studioNumeral">{loading ? "…" : toPersianDigits(totalRevenue.toLocaleString("en-US"))}</b>
            <span>فروش کل</span>
          </div>
          <button type="button" className="studioStat" onClick={onOpenOrders}>
            <b className="studioNumeral">{loading ? "…" : toPersianDigits(orders.length)}</b>
            <span>سفارش‌ها</span>
          </button>
          <button type="button" className="studioStat" onClick={onOpenInsights}>
            <b className="studioNumeral">{loading ? "…" : toPersianDigits(activeProductCount)}</b>
            <span>محصول فعال</span>
          </button>
        </div>

        <StudioPromoCard
          cards={promoCards}
          busy={promoCardBusy}
          onCreate={onCreatePromoCard}
          onActivate={onActivatePromoCard}
          onDelete={onDeletePromoCard}
        />
      </section>

      {loading ? (
        <section className="studioSection" aria-label="ویترین فروشگاه">
          <div className="studioSectionHead">
            <h3>ویترین فروشگاه</h3>
          </div>
          <SkeletonList rows={4} variant="card" label="در حال بارگذاری محصولات" />
        </section>
      ) : !hasCatalog ? (
        <section className="studioSection" aria-label="ویترین فروشگاه">
          <div className="studioEmpty">
            <Store size={22} />
            <b>هنوز محصولی اضافه نکردید</b>
            <span>اولین محصول فروشگاهت رو اضافه کن تا اینجا نمایش داده بشه.</span>
            <button type="button" className="studioButton" onClick={() => onCreateProduct?.()}>افزودن محصول</button>
          </div>
        </section>
      ) : (
        <>
          <ProductRow
            title="ویژه"
            items={featuredProducts}
            onOpenProduct={onOpenProduct}
            onAddProduct={() => onCreateProduct?.()}
          />
          {categoryRows.map((row) => (
            <ProductRow
              key={row.name}
              title={row.name}
              items={row.items}
              onOpenProduct={onOpenProduct}
              onAddProduct={() => onCreateProduct?.(row.name)}
              category={row.id != null ? { id: row.id, name: row.name } : null}
              isFirst={realCategoryIds[0] === row.id}
              isLast={realCategoryIds[realCategoryIds.length - 1] === row.id}
              categoryBusy={categoryBusy}
              onRenameCategory={onRenameCategory}
              onMoveCategory={onMoveCategory}
              onDeleteCategory={onDeleteCategory}
            />
          ))}
          <section className="studioSection" aria-label="دسته جدید">
            {addingCategory ? (
              <form
                className="studioNewCategoryForm"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleCreateCategory();
                }}
              >
                <input
                  autoFocus
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="نام دسته جدید"
                  disabled={categoryBusy}
                />
                <button type="submit" className="studioButton" disabled={categoryBusy || !newCategoryName.trim()}>
                  {categoryBusy ? "…" : "ایجاد"}
                </button>
                <button
                  type="button"
                  className="studioLinkButton is-muted"
                  onClick={() => {
                    setAddingCategory(false);
                    setNewCategoryName("");
                  }}
                >
                  انصراف
                </button>
              </form>
            ) : (
              <button type="button" className="studioLinkButton studioNewCategoryButton" onClick={() => setAddingCategory(true)}>
                <Plus size={14} />
                دسته جدید
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
