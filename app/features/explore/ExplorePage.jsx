"use client";

import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { SkeletonList } from "../../components/Skeleton";
import { categories } from "../../shared/constants/categories";

export function ExplorePage({
  active,
  exploreCategory,
  posts,
  loading = false,
  onCategoryChange,
  onPostSelect
}) {
  const [query, setQuery] = useState("");
  const safePosts = Array.isArray(posts) ? posts : [];
  const normalizedQuery = query.trim();
  const visiblePosts = normalizedQuery
    ? safePosts.filter((item) =>
        [item.title, item.salon, item.area, item.tag]
          .filter(Boolean)
          .some((field) => field.includes(normalizedQuery))
      )
    : safePosts;

  return (
    <div className={`feedPanel mobilePage page-feed ${active ? "is-active" : ""}`} id="feed">
      <div className="exploreHead">
        <div>
          <span>اکسپلور زیبایی</span>
          <strong>مدل‌ها و ترندهای روز</strong>
        </div>
        <b>{loading ? "…" : `${visiblePosts.length} مدل`}</b>
      </div>
      <label className="exploreSearch">
        <Search size={16} />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="جستجوی مدل، سالن یا محدوده..."
          aria-label="جستجو در اکسپلور"
        />
      </label>
      <div className="categoryRail" role="tablist" aria-label="فیلتر دسته‌ها">
        {categories.map((cat) => (
          <button
            type="button"
            role="tab"
            aria-selected={exploreCategory === cat}
            className={exploreCategory === cat ? "active" : ""}
            key={cat}
            onClick={() => onCategoryChange(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
      <div className="feedCards">
        {loading ? (
          <SkeletonList rows={4} variant="feed" className="exploreFeedSkeleton" label="در حال بارگذاری اکسپلور" />
        ) : safePosts.length === 0 ? (
          <div className="emptySalonDirectory">
            <Sparkles size={22} />
            <b>هنوز پستی در اکسپلور نیست</b>
            <p>با ثبت‌نام آرتیست و انتشار نمونه‌کار، اینجا پر می‌شود.</p>
          </div>
        ) : visiblePosts.length === 0 ? (
          <div className="emptySalonDirectory">
            <Search size={22} />
            <b>نتیجه‌ای پیدا نشد</b>
            <p>عبارت دیگری را امتحان کن.</p>
          </div>
        ) : null}
        {!loading && visiblePosts.map((item) => (
          <article
            className={`feedCard ${item.color}${item.image ? " hasImage" : ` ${item.tile}`}`}
            key={item.id || item.title}
            onClick={() => onPostSelect(item)}
            aria-label={item.title}
          >
            {item.image && <img className="feedCardImage" src={item.image} alt="" aria-hidden="true" />}
            <div className="feedCardBody">
              <span className="feedCardTag">{item.tag}</span>
              <h3>{item.title}</h3>
              <p>{item.salon} · {item.area}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
