"use client";

import { Camera } from "lucide-react";
import { toPersianDigits } from "../shared/lib/digits";
import { ServiceIcon } from "./ServiceIcon";

/** The cover of a service's sample photos, small (a list row). `photos` come from the server as [{ postId, image }]. */
export function ServiceCover({ photos, size = 56, count = true, className = "" }) {
  const list = Array.isArray(photos) ? photos : [];
  if (!list.length) return null;
  return (
    <span className={`svcCover ${className}`.trim()} style={{ "--cover": `${size}px` }} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${list[0].image}&w=240`} alt="" loading="lazy" />
      {count && list.length > 1 ? <i>{toPersianDigits(list.length)} نمونه</i> : null}
    </span>
  );
}

/** True when the service's photos replace its icon in lists (linked photos, and the owner did not pick «آیکن بمونه»). */
export function showsPhotoAsCover(service) {
  return Boolean(service?.photos?.length) && service.photoAsCover !== false;
}

/** Client side: the small «۳ عکس» button on a row whose icon stays; opens the photos. */
export function ServicePhotoPill({ count, onClick, label }) {
  return (
    <span
      role="button"
      tabIndex={0}
      className="svcPhotoPill"
      aria-label={label}
      onClick={(event) => { event.stopPropagation(); onClick?.(); }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        event.stopPropagation();
        onClick?.();
      }}
    >
      <Camera size={11} />
      {toPersianDigits(count)} نمونه
    </span>
  );
}

/**
 * Owner side: the left of a service card. The cover (or the icon) with one small badge on its corner: a camera when
 * the service has no samples, the camera and a count when it has. Tapping the badge opens the sample picker; the rest
 * of the card still opens the service editor.
 */
export function ServiceLead({ service, onPhotos, size = 76 }) {
  const count = Array.isArray(service?.photos) ? service.photos.length : 0;
  return (
    <span className="svcLead">
      {showsPhotoAsCover(service)
        ? <ServiceCover photos={service.photos} size={size} count={false} />
        : <ServiceIcon emoji={service.emoji} name={service.name} size="xl" />}
      <button type="button" className={`svcPhotoBadge${count ? " has-count" : ""}`} onClick={onPhotos} aria-label={count ? `${toPersianDigits(count)} نمونه برای ${service.name}` : `نمونه بذار برای ${service.name}`}>
        <Camera size={13} />
        {count ? toPersianDigits(count) : null}
      </button>
    </span>
  );
}
