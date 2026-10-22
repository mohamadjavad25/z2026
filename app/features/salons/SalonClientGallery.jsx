"use client";

import { thumbUrl } from "../../shared/lib/mediaUrl";
import { useState } from "react";
import { RotateCw } from "lucide-react";
import { Mascot } from "../../components/Mascot";
import { PostViewer } from "../posts/PostViewer";

// Small enough for a phone's 3G (the full picture opens only in the viewer).
const TILE_WIDTH = 360;

const withRetry = (url, attempt) => (attempt && url ? `${url}${url.includes("?") ? "&" : "?"}r=${attempt}` : url);

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
  // On a slow connection the pictures come last: each tile is a grey block until its small copy has arrived, and a
  // picture that did not arrive is said so once, with «دوباره» to ask again (a new ?r= so the browser does not reuse the failure).
  const [loaded, setLoaded] = useState({});
  const [failed, setFailed] = useState({});
  const [attempt, setAttempt] = useState(0);
  const anyFailed = Object.values(failed).some(Boolean);
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
        <Mascot pose="camera" size={130} />
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
              className={`salonClientMosaicTile ${shape} ${item.image ? "hasImage" : ""}${item.image && !loaded[key] ? " is-loading" : ""}`}
              key={key}
              style={item.image ? undefined : getFallbackStyle(item)}
              onClick={() => openItem(item)}
              aria-label={`مشاهده جزئیات ${item.title || "نمونه‌کار"}`}
            >
              {item.image ? (
                <img
                  ref={(node) => { if (node?.complete && node.naturalWidth && !loaded[key]) setLoaded((current) => ({ ...current, [key]: true })); }}
                  src={withRetry(thumbUrl(item.image, TILE_WIDTH), attempt)}
                  alt={item.title || `نمونه‌کار ${salon?.name || "سالن"}`}
                  loading="lazy"
                  fetchPriority="low"
                  decoding="async"
                  onLoad={(event) => { setLoaded((current) => ({ ...current, [key]: true })); setFailed((current) => (current[key] ? { ...current, [key]: false } : current)); rememberImageRatio(key, event); }}
                  onError={() => setFailed((current) => ({ ...current, [key]: true }))}
                />
              ) : null}
            </button>
          );
        })}
      </div>
      {anyFailed ? (
        <p className="salonGalleryRetry" role="alert">
          اینترنتت کند است. دوباره تلاش کن
          <button type="button" onClick={() => { setFailed({}); setAttempt((count) => count + 1); }}>
            <RotateCw size={14} aria-hidden="true" /> دوباره
          </button>
        </p>
      ) : null}

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
