"use client";

import { thumbUrl } from "../../shared/lib/mediaUrl";
import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { PostViewer } from "../posts/PostViewer";

function getItemKey(item, index) {
  return String(item.id || item.image || item.title || index);
}

function getMosaicShape(ratio, index) {
  if (ratio >= 1.55) return "is-wide";
  if (ratio <= 0.72) return "is-tall";
  if (ratio >= 1.16) return "is-landscape";
  if (ratio <= 0.9) return "is-portrait";
  return index % 5 === 0 ? "is-featured" : "is-square";
}

/**
 * Public salon portfolio strip. Tapping a work opens the shared PostViewer (browse, save,
 * share); opening one counts a view via `postActions.view`.
 *
 * postActions: { isSaved(post), toggleSave(post), share(post), view(post) }
 */
export function SalonClientGallery({ salon, items, getFallbackStyle, postActions = null, allItems = null }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [imageRatios, setImageRatios] = useState({});
  const browseList = allItems?.length ? allItems : items;

  function rememberImageRatio(key, event) {
    const image = event.currentTarget;
    const ratio = image.naturalWidth && image.naturalHeight
      ? image.naturalWidth / image.naturalHeight
      : 1;
    setImageRatios((items) => (items[key] === ratio ? items : { ...items, [key]: ratio }));
  }

  function openItem(item) {
    setSelectedItem(item);
    postActions?.view?.(item);
  }

  if (!items?.length) {
    return (
      <div className="salonClientEmptyGallery">
        <ImagePlus size={22} />
        <b>هنوز نمونه‌کاری ثبت نشده</b>
      </div>
    );
  }

  return (
    <>
      <div className="salonClientMosaicGallery" aria-label="گالری سالن">
        {items.map((item, index) => {
          const key = getItemKey(item, index);
          const shape = getMosaicShape(imageRatios[key], index);
          return (
            <button
              type="button"
              className={`salonClientMosaicTile ${shape} ${item.image ? "hasImage" : ""}`}
              key={key}
              style={item.image ? undefined : getFallbackStyle(item)}
              onClick={() => openItem(item)}
              aria-label={`مشاهده جزئیات ${item.title || "نمونه‌کار"}`}
            >
              {item.image ? (
                <img
                  src={thumbUrl(item.image, 720)}
                  alt={item.title || `نمونه‌کار ${salon?.name || "سالن"}`}
                  loading={index < 6 ? "eager" : "lazy"}
                  decoding="async"
                  onLoad={(event) => rememberImageRatio(key, event)}
                />
              ) : null}
            </button>
          );
        })}
      </div>

      <PostViewer
        post={selectedItem}
        posts={browseList}
        owner={selectedItem ? { name: salon?.name || "سالن", role: "سالن", area: salon?.area || "", avatar: salon?.avatar || "" } : null}
        isSaved={selectedItem ? Boolean(postActions?.isSaved?.(selectedItem)) : false}
        onClose={() => setSelectedItem(null)}
        onNavigate={openItem}
        onToggleSaved={() => selectedItem && postActions?.toggleSave?.(selectedItem)}
        onShare={() => selectedItem && postActions?.share?.(selectedItem)}
      />
    </>
  );
}
