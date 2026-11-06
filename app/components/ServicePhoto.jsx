"use client";

import { Camera } from "lucide-react";
import { toPersianDigits } from "../shared/lib/digits";

/** The cover of a service's sample photos, small (a list row). `photos` come from the server as [{ postId, image }]. */
export function ServiceCover({ photos, size = 56, count = true, className = "" }) {
  const list = Array.isArray(photos) ? photos : [];
  if (!list.length) return null;
  return (
    <span className={`svcCover ${className}`.trim()} style={{ "--cover": `${size}px` }} aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${list[0].image}&w=240`} alt="" loading="lazy" />
      {count && list.length > 1 ? <i>{toPersianDigits(list.length)} عکس</i> : null}
    </span>
  );
}

/** Owner side: the chip on a service card that opens the photo picker. */
export function ServicePhotoChip({ service, onClick }) {
  const count = Array.isArray(service?.photos) ? service.photos.length : 0;
  return (
    <button type="button" className={`svcChip svcPhotoChip${count ? " has-photos" : ""}`} onClick={onClick}>
      <Camera size={12} />
      {count ? `${toPersianDigits(count)} عکس نمونه` : "عکس نمونه بذار"}
    </button>
  );
}
