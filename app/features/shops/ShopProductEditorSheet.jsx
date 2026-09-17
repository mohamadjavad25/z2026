"use client";

import {
  Camera,
  Crop,
  ImagePlus,
  Plus,
  ShieldCheck,
  Upload,
  WandSparkles
} from "lucide-react";

/**
 * Shop owner — create/edit product sheet.
 * Presentational: all domain state/handlers come from useShopWorkspace via HomeApp props.
 */
export function ShopProductEditorSheet({
  open,
  editingProduct = null,
  image = "",
  enhanceBusy = false,
  enhanceTab = "",
  activeEnhance = "",
  activeAspect = "",
  enhancePresets = [],
  aspectPresets = [],
  categories = [],
  defaultCategory = "",
  badges = [],
  onClose,
  onSubmit,
  onImageUpload,
  onImageClear,
  onEnhanceTabChange,
  onApplyEnhance,
  onApplyAspect,
  onResetEdits,
  onDelete
}) {
  if (!open) return null;

  return (
    <div
      className="shopProductModal"
      role="dialog"
      aria-modal="true"
      aria-label={editingProduct ? "ویرایش محصول" : "ایجاد محصول جدید"}
      onClick={onClose}
    >
      <section className="shopProductSheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheetHandle" />
        <div className="sheetHead">
          <div>
            <span>{editingProduct ? "ویرایش کاتالوگ" : "ویترین فروشگاه"}</span>
            <h3>{editingProduct ? "به‌روزرسانی محصول" : "ایجاد محصول جدید"}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="بستن">
            ×
          </button>
        </div>
        <form className="shopProductForm" key={editingProduct?.id || `new-${defaultCategory}`} onSubmit={onSubmit}>
          <div className={`shopProductUploadHero ${image ? "has-image" : ""}`}>
            {image ? (
              <>
                <img src={image} alt="پیش‌نمایش محصول" />
                <div className="shopProductUploadOverlay">
                  <span>{enhanceBusy ? "در حال پردازش..." : "تصویر آپلود‌شده"}</span>
                  <div>
                    <label className="shopProductUploadBtn">
                      <ImagePlus size={15} />
                      تعویض
                      <input className="captureInput" type="file" accept="image/*" onChange={onImageUpload} />
                    </label>
                    <button type="button" onClick={onImageClear}>
                      حذف
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="shopProductUploadEmpty">
                <Upload size={28} />
                <b>تصویر محصول را آپلود کن</b>
                <span>عکس واضح از محصول، بهترین نتیجه فروش را می‌دهد.</span>
                <div className="shopProductUploadActions">
                  <label>
                    <Camera size={16} />
                    دوربین
                    <input
                      className="captureInput"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={onImageUpload}
                    />
                  </label>
                  <label>
                    <ImagePlus size={16} />
                    گالری
                    <input className="captureInput" type="file" accept="image/*" onChange={onImageUpload} />
                  </label>
                </div>
              </div>
            )}
          </div>

          {image ? (
            <div className="shopProductEnhancePanel">
              <div className="shopProductEnhanceTabs" role="tablist" aria-label="ابزار تصویر محصول">
                <button
                  type="button"
                  role="tab"
                  aria-selected={enhanceTab === "quality"}
                  className={enhanceTab === "quality" ? "active" : ""}
                  onClick={() => onEnhanceTabChange?.(enhanceTab === "quality" ? "" : "quality")}
                >
                  <WandSparkles size={15} />
                  بهبود کیفیت
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={enhanceTab === "size"}
                  className={enhanceTab === "size" ? "active" : ""}
                  onClick={() => onEnhanceTabChange?.(enhanceTab === "size" ? "" : "size")}
                >
                  <Crop size={15} />
                  ابعاد تصویر
                </button>
                {(activeEnhance || activeAspect) && (
                  <button type="button" className="ghost" onClick={onResetEdits} disabled={enhanceBusy}>
                    نسخه اصلی
                  </button>
                )}
              </div>

              {enhanceTab === "quality" && (
                <div className="shopProductEnhanceOptions" role="group" aria-label="حالت‌های بهبود کیفیت">
                  {enhancePresets.map((preset) => (
                    <button
                      type="button"
                      key={preset.id}
                      className={activeEnhance === preset.id ? "active" : ""}
                      disabled={enhanceBusy}
                      onClick={() => onApplyEnhance?.(preset.id)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}

              {enhanceTab === "size" && (
                <div className="shopProductEnhanceOptions" role="group" aria-label="نسبت ابعاد تصویر">
                  {aspectPresets.map((preset) => (
                    <button
                      type="button"
                      key={preset.id}
                      className={activeAspect === preset.id ? "active" : ""}
                      disabled={enhanceBusy}
                      onClick={() => onApplyAspect?.(preset.id)}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <label>
            نام محصول
            <input name="name" defaultValue={editingProduct?.name || ""} placeholder="مثلا سرم گلو شب" required />
          </label>
          <label>
            توضیح کوتاه
            <textarea
              name="description"
              defaultValue={editingProduct?.description || ""}
              placeholder="مزیت محصول، مناسب چه پوستی، حجم و جزئیات مهم..."
              rows={3}
            />
          </label>
          <div className="shopProductFormRow">
            <label>
              دسته
              <select name="category" defaultValue={editingProduct?.category || defaultCategory || categories[0] || "میکاپ"}>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </label>
            <label>
              قیمت
              <input name="price" defaultValue={editingProduct?.price || ""} placeholder="مثلا ۴۸۰ ه" required />
            </label>
          </div>
          <div className="shopProductFormRow">
            <label>
              موجودی
              <input
                name="stock"
                type="number"
                min="0"
                defaultValue={editingProduct?.stock ?? 10}
                inputMode="numeric"
              />
            </label>
            <label>
              برچسب
              <select name="badge" defaultValue={editingProduct?.badge || "جدید"}>
                {badges.map((badge) => (
                  <option key={badge} value={badge}>
                    {badge}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="shopProductFeaturedToggle">
            <input type="checkbox" name="featured" defaultChecked={Boolean(editingProduct?.featured)} />
            <span>
              <b>تایید برای ویترین ویژه</b>
              <small>اگر فعال باشد، این محصول در بخش ویترین ویژه صفحه فروشگاه نمایش داده می‌شود.</small>
            </span>
          </label>
          <div className={`shopProductFormHint ${!image ? "is-required" : ""}`} id="shopProductImageHint">
            <ShieldCheck size={16} />
            <span>
              {image
                ? "محصول با تصویر در ویترین فروشگاه و کاتالوگ نمایش داده می‌شود."
                : "برای فعال شدن دکمه ذخیره، اول یک تصویر برای محصول آپلود کن."}
            </span>
          </div>
          <button
            type="submit"
            disabled={!image}
            aria-describedby={!image ? "shopProductImageHint" : undefined}
            title={!image ? "برای ذخیره، تصویر محصول را آپلود کن" : undefined}
          >
            <Plus size={16} />
            {editingProduct ? "ذخیره تغییرات" : "انتشار در کاتالوگ"}
          </button>
          {editingProduct && (
            <button type="button" className="ghost" onClick={() => onDelete?.(editingProduct.id)}>
              حذف محصول
            </button>
          )}
        </form>
      </section>
    </div>
  );
}
