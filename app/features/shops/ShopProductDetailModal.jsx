"use client";

import { ImagePlus, Package, ShieldCheck, ShoppingBag, Star } from "lucide-react";

/**
 * Shop owner — product detail modal.
 * Presentational: resolved product object + close/edit/delete callbacks.
 */
export function ShopProductDetailModal({ product, onClose, onEdit, onDelete }) {
  if (!product) return null;

  const stockLabel = product.stock === 0 ? "ناموجود" : `${product.stock} عدد در انبار`;

  return (
    <div className="shopProductDetailModal" role="dialog" aria-modal="true" aria-label={product.name} onClick={onClose}>
      <section className="shopProductDetailSheet" onClick={(event) => event.stopPropagation()}>
        <div
          className="shopProductDetailMedia"
          style={{
            backgroundImage: `linear-gradient(180deg, rgba(21,26,30,0.08), rgba(21,26,30,0.78)), url("${product.image}")`
          }}
        >
          <button type="button" className="shopProductDetailClose" onClick={onClose} aria-label="بستن">
            ×
          </button>
          <span className="shopProductDetailBadge">{product.badge}</span>
          <div className="shopProductDetailTitle">
            <small>{product.category}</small>
            <h3>{product.name}</h3>
          </div>
        </div>
        <div className="shopProductDetailBody">
          <div className="shopProductDetailPriceRow">
            <div>
              <span>قیمت فروش</span>
              <strong>{product.price}</strong>
            </div>
            <em className={`shopProductDetailStock is-${product.tone}`}>{stockLabel}</em>
          </div>
          <p className="shopProductDetailText">
            {product.description ||
              "توضیحی برای این محصول ثبت نشده است. با ویرایش می‌توانی جزئیات کامل را اضافه کنی."}
          </p>
          <div className="shopProductDetailStats">
            <article>
              <span>فروش</span>
              <b>{product.sold}</b>
            </article>
            <article>
              <span>موجودی</span>
              <b>{product.stock}</b>
            </article>
            <article>
              <span>وضعیت</span>
              <b>{product.tone === "ok" ? "فعال" : product.tone === "warn" ? "کم" : "ناموجود"}</b>
            </article>
          </div>
          <div className="shopProductDetailMetaList">
            <span>
              <Package size={14} /> کد: {product.id}
            </span>
            <span>
              <ShoppingBag size={14} /> دسته: {product.category}
            </span>
            <span>
              <ShieldCheck size={14} /> برچسب: {product.badge}
            </span>
            {product.featured ? (
              <span>
                <Star size={14} /> ویترین ویژه
              </span>
            ) : null}
          </div>
          <div className="shopProductDetailActions">
            <button type="button" className="primary" onClick={() => onEdit?.(product)}>
              <ImagePlus size={16} />
              ویرایش محصول
            </button>
            <button type="button" className="ghost" onClick={() => onDelete?.(product.id)}>
              حذف از کاتالوگ
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
