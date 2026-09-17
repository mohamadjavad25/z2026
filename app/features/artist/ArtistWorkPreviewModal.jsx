"use client";

import { Eye, Pencil, Star, X } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";

/**
 * Artist owner — portfolio work preview modal.
 * Presentational: viewing work + close/edit callbacks.
 */
export function ArtistWorkPreviewModal({ work, onClose, onEdit }) {
  if (!work) return null;

  return (
    <div
      className="artistWorkPreviewModal"
      role="dialog"
      aria-modal="true"
      aria-label="پیشنمایش نمونهکار"
      onClick={onClose}
    >
      <article className="artistWorkPreviewSheet" onClick={(event) => event.stopPropagation()}>
        <div className="artistWorkPreviewHero">
          <img src={work.image} alt={work.title || "نمونهکار"} />
          <div className="artistWorkPreviewHeroCopy">
            <span className="artistGalleryTag">{work.tag}</span>
            <h3>{work.title}</h3>
          </div>
        </div>
        <div className="artistWorkPreviewBody">
          <div className="artistWorkPreviewStats">
            <div>
              <Eye size={15} />
              <span>بازدید</span>
              <b>{toPersianDigits(work.views || "۰")}</b>
            </div>
            <div>
              <Star size={15} />
              <span>امتیاز</span>
              <b>{work.rating || "۴.۸"}</b>
            </div>
          </div>
          {work.caption ? (
            <p className="artistWorkPreviewCaption">{work.caption}</p>
          ) : null}
          {work.featured ? (
            <em className="artistWorkPreviewBadge">ویترین اصلی</em>
          ) : null}
          <button
            type="button"
            className="artistWorkPreviewEdit"
            onClick={() => onEdit?.(work)}
          >
            <Pencil size={16} /> ویرایش نمونهکار
          </button>
        </div>
      </article>
      <button type="button" className="artistWorkClose" onClick={onClose} aria-label="بستن">
        <X size={20} strokeWidth={2.4} />
      </button>
    </div>
  );
}
