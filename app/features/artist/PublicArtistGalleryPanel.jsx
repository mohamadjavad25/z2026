"use client";

import { thumbUrl } from "../../shared/lib/mediaUrl";
import { Mascot } from "../../components/Mascot";

export function PublicArtistGalleryPanel({
  tags,
  activeTag,
  featured,
  rest,
  getCardStyle,
  onTagChange,
  onOpenWork
}) {
  const safeTags = Array.isArray(tags) ? tags : [];
  const safeRest = Array.isArray(rest) ? rest : [];

  function handleKeyOpen(event, item) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpenWork(item);
    }
  }

  return (
    <section className="artistPublicGallery" aria-label="گالری نمونه‌کار">
      {safeTags.length > 2 && (
        <div className="artistPublicGalleryFilters" role="tablist" aria-label="فیلتر گالری">
          {safeTags.map((tag) => (
            <button
              type="button"
              role="tab"
              key={tag}
              aria-selected={activeTag === tag}
              className={activeTag === tag ? "active" : ""}
              onClick={() => onTagChange(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {featured || safeRest.length ? (
        <div className={`artistPublicGrid ${(featured ? 1 : 0) + safeRest.length === 1 ? "is-single" : ""}`}>
          {featured ? (
            <article
              className="artistPublicCard"
              role="button"
              tabIndex={0}
              onClick={() => onOpenWork(featured)}
              onKeyDown={(event) => handleKeyOpen(event, featured)}
            >
              {featured.image ? (
                <img src={thumbUrl(featured.image, 720)} alt={featured.title} fetchPriority="high" />
              ) : (
                <div className="artistPublicCardFallback" style={getCardStyle(featured)} />
              )}
              <div className="artistPublicCardShade" aria-hidden="true" />
              <div className="artistPublicCardCopy">
                <span className="artistPublicWorkTag">{featured.tag}</span>
                <h3>{featured.title}</h3>
              </div>
            </article>
          ) : null}
          {safeRest.map((item) => (
            <article
              className="artistPublicCard"
              key={item.id || item.title}
              role="button"
              tabIndex={0}
              onClick={() => onOpenWork(item)}
              onKeyDown={(event) => handleKeyOpen(event, item)}
            >
              {item.image ? (
                <img src={thumbUrl(item.image, 480)} alt={item.title} loading="eager" />
              ) : (
                <div className="artistPublicCardFallback" style={getCardStyle(item)} />
              )}
              <div className="artistPublicCardShade" aria-hidden="true" />
              <div className="artistPublicCardCopy">
                <h3>{item.title}</h3>
                <small>{item.tag}</small>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="artistPublicEmpty">
          <Mascot pose="makeup" size={150} />
          <b>هنوز نمونه‌کاری نیست</b>
          <span>به‌زودی کارهای این آرتیست اینجا می‌آید.</span>
        </div>
      )}
    </section>
  );
}
