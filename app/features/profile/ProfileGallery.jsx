"use client";

import { ImagePlus, Lock, Pin } from "lucide-react";
import { SkeletonList } from "../../components/Skeleton";
import { ProfilePostComposer } from "./ProfilePostComposer";

const EMPTY_COLLAGE_SRC = "/artist-gallery-empty-collage.png";

/**
 * Shared profile portfolio gallery (artist + salon).
 * Visual language follows the artist gallery masonry cards.
 * Includes optional post composer (same sheet as artist profile).
 */
export function ProfileGallery({
  label,
  items = [],
  filters,
  activeFilter,
  onFilterChange,
  onAdd,
  addLabel = "افزودن کار",
  headExtra = null,
  hideBody = false,
  onItemClick,
  getFallbackStyle,
  renderActions,
  editingId,
  emptyTitle = "هنوز نمونه‌کاری نداری",
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  className = "",
  composeValue = null,
  onComposeChange,
  onComposeClose,
  onComposeSubmit,
  onComposeDelete,
  onComposeNotify,
  onComposeImageClear,
  composeTagOptions = [],
  composeTagMenuOpen = false,
  onComposeTagMenuOpenChange,
  composeSaving = false,
  composeAriaLabel,
  composeShowCaption = true,
  composeShowVisibility = true,
  composeShowPin = true,
  loading = false,
  composeSubmitLabel = "ذخیره"
}) {
  const showFilters = Array.isArray(filters) && filters.length > 2 && typeof onFilterChange === "function";
  const hasItems = items.length > 0;
  const mosaicClass = items.length === 1 ? "is-single" : items.length === 2 ? "is-pair" : "is-mosaic";

  function handleAddKeyDown(event) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      event.stopPropagation();
      onAdd?.();
    }
  }

  return (
    <>
      <section className={`profileGallery ${className}`.trim()} aria-label={label}>
        {onAdd ? (
          <div className="profileGalleryHead">
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onAdd?.();
              }}
              onKeyDown={handleAddKeyDown}
            >
              <ImagePlus size={16} />
              {addLabel}
            </button>
            {headExtra}
          </div>
        ) : null}

        {!hideBody && showFilters ? (
          <div className="profileGalleryFilters" role="tablist" aria-label="فیلتر گالری">
            {filters.map((tag) => (
              <button
                type="button"
                role="tab"
                key={tag}
                aria-selected={activeFilter === tag}
                className={activeFilter === tag ? "active" : ""}
                onClick={() => onFilterChange(tag)}
              >
                {tag}
              </button>
            ))}
          </div>
        ) : null}

        {!hideBody && loading && !hasItems ? (
          <SkeletonList rows={4} variant="card" label="در حال بارگذاری گالری" />
        ) : null}

        {!hideBody && hasItems ? (
          <div
            className={`profileGalleryGrid ${mosaicClass}`}
            aria-label={label}
          >
            {items.map((item) => {
              const key = item.id || item.title;
              const isEditing = editingId != null && editingId === item.id;
              const clickable = typeof onItemClick === "function";
              const actions = typeof renderActions === "function" ? renderActions(item) : null;

              return (
                <article
                  className={`profileGalleryCard ${item.featured ? "is-featured" : ""} ${isEditing ? "is-editing" : ""} ${clickable ? "is-clickable" : ""}`}
                  key={key}
                  role={clickable ? "button" : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onItemClick(item);
                  } : undefined}
                  onKeyDown={
                    clickable
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            onItemClick(item);
                          }
                        }
                      : undefined
                  }
                >
                  {item.image ? (
                    <img src={item.image} alt={item.title || "نمونه‌کار"} loading="lazy" decoding="async" />
                  ) : (
                    <div
                      className="profileGalleryCardFallback"
                      style={typeof getFallbackStyle === "function" ? getFallbackStyle(item) : undefined}
                      aria-hidden="true"
                    />
                  )}
                  <div className="profileGalleryCardShade" aria-hidden="true" />
                  <div className="profileGalleryCardCopy">
                    {item.tag ? <span className="profileGalleryTag">{item.tag}</span> : null}
                    {item.title ? <h3>{item.title}</h3> : null}
                  </div>
                  {item.featured || item.inExplore === false ? (
                    <div className="profileGalleryFlags">
                      {item.inExplore === false ? <span title="فقط خودت می‌بینی"><Lock size={12} /></span> : null}
                      {item.featured ? <span title="سنجاق‌شده"><Pin size={12} /></span> : null}
                    </div>
                  ) : null}
                  {actions ? <div className="profileGalleryCardActions">{actions}</div> : null}
                </article>
              );
            })}
          </div>
        ) : !hideBody && !loading ? (
          <div className="profileGalleryEmpty">
            <div className="profileGalleryEmptyVisual" aria-hidden="true">
              <img src={EMPTY_COLLAGE_SRC} alt="" />
            </div>
            <b>{emptyTitle}</b>
            {emptyDescription ? <span>{emptyDescription}</span> : null}
            {onEmptyAction && emptyActionLabel ? (
              <button type="button" onClick={onEmptyAction}>
                {emptyActionLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </section>

      {composeValue ? (
        <ProfilePostComposer
          value={composeValue}
          onChange={onComposeChange}
          onClose={onComposeClose}
          onSubmit={onComposeSubmit}
          onDelete={onComposeDelete}
          onNotify={onComposeNotify}
          onImageClear={onComposeImageClear}
          tagOptions={composeTagOptions}
          tagMenuOpen={composeTagMenuOpen}
          onTagMenuOpenChange={onComposeTagMenuOpenChange}
          saving={composeSaving}
          ariaLabel={composeAriaLabel}
          showCaption={composeShowCaption}
          showVisibility={composeShowVisibility}
          showPin={composeShowPin}
          pinnedCount={items.filter((item) => item.featured && String(item.id) !== String(composeValue.id)).length}
          submitLabel={composeSubmitLabel}
        />
      ) : null}
    </>
  );
}
