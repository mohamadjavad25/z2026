"use client";

import { useMemo, useState } from "react";
import { Eye, Pencil, Plus, Search, Star, Store } from "lucide-react";
import { SkeletonList } from "../../components/Skeleton";
import { toPersianDigits } from "../../shared/lib/digits";

export function ShopCatalogPanel({
  products = [],
  loading = false,
  onOpenProduct,
  onCreateProduct,
  onEditProduct
}) {
  const [category, setCategory] = useState("همه");
  const [query, setQuery] = useState("");
  const categories = useMemo(
    () => ["همه", ...Array.from(new Set(products.map((item) => item.category).filter(Boolean)))],
    [products]
  );
  const visibleProducts = useMemo(() => {
    const normalizedQuery = query.trim();
    return products.filter((product) => {
      const matchesCategory = category === "همه" || product.category === category;
      const matchesQuery = !normalizedQuery || `${product.name} ${product.category} ${product.badge}`.includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [products, category, query]);
  const lowStockCount = products.filter((product) => Number(product.stock || 0) <= 5 && Number(product.stock || 0) > 0).length;
  const outOfStockCount = products.filter((product) => Number(product.stock || 0) <= 0).length;

  return (
    <div className="shopCatalogPage studioPage">
      <div className="studioToolbar">
        <div className="studioToolbarTop">
          <div className="studioLedger">
            <div className="studioStat">
              <b className="studioNumeral">{toPersianDigits(products.length)}</b>
              <span>فعال</span>
            </div>
            <div className={`studioStat ${lowStockCount ? "is-alert" : ""}`}>
              <b className="studioNumeral">{toPersianDigits(lowStockCount)}</b>
              <span>کم‌موجودی</span>
            </div>
            <div className={`studioStat ${outOfStockCount ? "is-alert" : ""}`}>
              <b className="studioNumeral">{toPersianDigits(outOfStockCount)}</b>
              <span>ناموجود</span>
            </div>
          </div>
          <button type="button" className="studioButton" onClick={onCreateProduct}>
            <Plus size={16} />
            محصول جدید
          </button>
        </div>
        <label className="studioSearch">
          <Search size={14} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجوی محصول" />
        </label>
        {products.length > 0 && (
          <div className="studioTabs" role="tablist" aria-label="دسته‌بندی محصولات">
            {categories.map((item) => (
              <button
                type="button"
                key={item}
                role="tab"
                aria-selected={category === item}
                className={category === item ? "active" : ""}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="studioList">
        {loading ? (
          <SkeletonList rows={4} variant="row" label="در حال بارگذاری محصولات" />
        ) : products.length === 0 ? (
          <div className="studioEmpty">
            <Store size={22} />
            <b>هنوز محصولی اضافه نکردید</b>
            <span>اولین محصول فروشگاهت رو اضافه کن تا مشتری‌ها بتونن ازت خرید کنن.</span>
            <button type="button" className="studioButton" onClick={onCreateProduct}>افزودن محصول</button>
          </div>
        ) : visibleProducts.length === 0 ? (
          <div className="studioEmptySmall">محصولی با این فیلتر پیدا نشد.</div>
        ) : visibleProducts.map((product) => (
          <article key={product.id} className="studioListRow">
            <div className="studioRowMedia">
              {product.image ? <img src={product.image} alt="" aria-hidden="true" /> : <Store size={19} />}
            </div>
            <div className="studioRowBody">
              <div className="studioRowTitle">
                <b>{product.name}</b>
                {product.featured ? <Star size={11} fill="currentColor" /> : null}
              </div>
              <span>{product.category} · موجودی {toPersianDigits(product.stock || 0)} · {toPersianDigits(product.sold || 0)} فروش</span>
              {product.description ? <small>{product.description}</small> : null}
            </div>
            <div className="studioRowSide">
              <strong className="studioNumeral">{product.price}</strong>
              <div className="studioRowActions">
                <button type="button" className="studioGhostIcon" onClick={() => onEditProduct?.(product)} aria-label={`ویرایش ${product.name}`}>
                  <Pencil size={14} />
                </button>
                <button type="button" className="studioGhostIcon" onClick={() => onOpenProduct?.(product)} aria-label={`مشاهده ${product.name}`}>
                  <Eye size={14} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
