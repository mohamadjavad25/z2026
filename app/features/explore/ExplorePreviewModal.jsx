"use client";

import { Bookmark, ChevronLeft, Share2, X } from "lucide-react";

export function ExplorePreviewModal({
  post,
  exploreArtist,
  isSaved,
  beautyPassport,
  passportMatch,
  onClose,
  onToggleSaved,
  onShare,
  onOpenArtistProfile
}) {
  if (!post) return null;

  return (
    <div
      className="explorePreviewModal"
      role="dialog"
      aria-modal="true"
      aria-label="پیشنمایش مدل"
      onClick={onClose}
    >
      <article className="explorePreviewSheet" onClick={(event) => event.stopPropagation()}>
        {exploreArtist && (
          <header
            className="explorePreviewArtistHeader"
            onClick={onOpenArtistProfile}
            role="button"
            tabIndex={0}
            aria-label="مشاهده پروفایل"
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onOpenArtistProfile();
              }
            }}
          >
            <span className="exploreArtistAvatar" aria-hidden="true">
              {String(exploreArtist.name || "آ").slice(0, 1)}
            </span>
            <span className="exploreArtistMeta">
              <b>{exploreArtist.name}</b>
              <small>
                {exploreArtist.role}
                {exploreArtist.area ? ` · ${exploreArtist.area}` : ""}
              </small>
            </span>
            <ChevronLeft size={18} className="exploreArtistChevron" aria-hidden="true" />
          </header>
        )}
        <div className="explorePreviewHero">
          {post.image ? (
            <img src={post.image} alt={post.title} />
          ) : (
            <div className={`explorePreviewHeroFallback ${post.tile || "tile1"}`} aria-hidden="true" />
          )}
          <div className="explorePreviewHeroCopy">
            <span className="artistGalleryTag">{post.tag}</span>
            <h3>{post.title}</h3>
          </div>
        </div>
        <div className="explorePreviewBody">
          <div className="explorePreviewStats" role="group" aria-label="عملیات مدل">
            <button
              type="button"
              className={`exploreStatBtn ${isSaved ? "is-active is-save" : ""}`}
              aria-pressed={isSaved}
              aria-label={isSaved ? "ذخیره شد" : "ذخیره"}
              onClick={onToggleSaved}
            >
              <span className="exploreStatIcon">
                <Bookmark size={17} strokeWidth={2.2} fill={isSaved ? "currentColor" : "none"} />
              </span>
            </button>
            <button
              type="button"
              className="exploreStatBtn"
              aria-label="اشتراک"
              onClick={onShare}
            >
              <span className="exploreStatIcon">
                <Share2 size={17} strokeWidth={2.2} />
              </span>
            </button>
          </div>

          {post.meta ? (
            <p className="artistWorkPreviewCaption">{post.meta}</p>
          ) : null}

          {beautyPassport?.active && (
            <div className="passportFit">
              <b>{passportMatch} هماهنگی با شناسنامه تو</b>
              <small>{beautyPassport.summary}</small>
            </div>
          )}
        </div>
      </article>
      <button type="button" className="artistWorkClose" onClick={onClose} aria-label="بستن">
        <X size={20} strokeWidth={2.4} />
      </button>
    </div>
  );
}
