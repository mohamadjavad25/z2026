"use client";

import { useState } from "react";
import { ImagePlus, UserRound, X } from "lucide-react";

function getItemKey(item, index) {
  return String(item.id || item.image || item.title || index);
}

function getItemArtist(item, salon) {
  const direct = item.artist_name || item.staff_name || item.artist || "";
  if (direct) return direct;
  const staff = Array.isArray(salon?.staff) ? salon.staff : [];
  return staff[0]?.artist_name || staff[0]?.name || "تیم سالن";
}

function getMosaicShape(ratio, index) {
  if (ratio >= 1.55) return "is-wide";
  if (ratio <= 0.72) return "is-tall";
  if (ratio >= 1.16) return "is-landscape";
  if (ratio <= 0.9) return "is-portrait";
  return index % 5 === 0 ? "is-featured" : "is-square";
}

export function SalonClientGallery({ salon, items, getFallbackStyle }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const [imageRatios, setImageRatios] = useState({});

  function rememberImageRatio(key, event) {
    const image = event.currentTarget;
    const ratio = image.naturalWidth && image.naturalHeight
      ? image.naturalWidth / image.naturalHeight
      : 1;
    setImageRatios((items) => (items[key] === ratio ? items : { ...items, [key]: ratio }));
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
      <div className="salonClientMosaicGallery" aria-label="گالری موزاییکی سالن">
        {items.map((item, index) => {
          const key = getItemKey(item, index);
          const shape = getMosaicShape(imageRatios[key], index);
          return (
            <button
              type="button"
              className={`salonClientMosaicTile ${shape} ${item.image ? "hasImage" : ""}`}
              key={key}
              style={item.image ? undefined : getFallbackStyle(item)}
              onClick={() => setSelectedItem(item)}
              aria-label={`مشاهده جزئیات ${item.title || "نمونه‌کار"}`}
            >
              {item.image ? <img src={item.image} alt="" onLoad={(event) => rememberImageRatio(key, event)} /> : null}
            </button>
          );
        })}
      </div>

      {selectedItem && (
        <div className="salonGalleryDetailBackdrop" role="dialog" aria-modal="true" aria-label="جزئیات نمونه‌کار" onClick={() => setSelectedItem(null)}>
          <article className="salonGalleryDetailPanel" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="salonGalleryDetailClose" onClick={() => setSelectedItem(null)} aria-label="بستن">
              <X size={18} />
            </button>
            <div
              className={`salonGalleryDetailImage ${selectedItem.image ? "hasImage" : ""}`}
              style={selectedItem.image ? { "--mosaic-image": `url("${selectedItem.image}")` } : getFallbackStyle(selectedItem)}
            >
              {selectedItem.image ? <img src={selectedItem.image} alt="" /> : null}
            </div>
            <div className="salonGalleryDetailBody">
              <div className="salonGalleryDetailTitle">
                <span>{selectedItem.tag || "نمونه‌کار"}</span>
                <h3>{selectedItem.title || "نمونه‌کار سالن"}</h3>
                {selectedItem.caption ? <p>{selectedItem.caption}</p> : null}
              </div>
              <div className="salonGalleryArtistInfo">
                <UserRound size={17} />
                <div>
                  <small>آرتیست اجراکننده</small>
                  <b>{getItemArtist(selectedItem, salon)}</b>
                </div>
              </div>
            </div>
          </article>
        </div>
      )}
    </>
  );
}
