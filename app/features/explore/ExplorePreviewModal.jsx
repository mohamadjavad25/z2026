"use client";

import { Bookmark, ChevronLeft, Share2, Star, X } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";

function CleanStar({ filled = false, size = 17 }) {
  return (
    <Star
      size={size}
      strokeWidth={1.8}
      className={`exploreCleanStar ${filled ? "is-filled" : "is-empty"}`}
      fill={filled ? "currentColor" : "none"}
      aria-hidden="true"
    />
  );
}

function CommentStars({ rating }) {
  const level = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return (
    <span className="explorePreviewCommentStars" aria-label={`امتیاز ${toPersianDigits(level)} از ۵`}>
      {[1, 2, 3, 4, 5].map((index) => (
        <CleanStar key={index} filled={index <= level} size={11} />
      ))}
    </span>
  );
}

export function ExplorePreviewModal({
  post,
  exploreArtist,
  isSaved,
  userRating,
  comments,
  beautyPassport,
  passportMatch,
  onClose,
  onToggleSaved,
  onOpenRating,
  onShare,
  onOpenArtistProfile
}) {
  if (!post) return null;

  const ratingLabel = post.rating ? toPersianDigits(post.rating) : "امتیاز";
  const commentList = Array.isArray(comments) ? comments : [];

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
            <span className="exploreArtistRating">
              <CleanStar filled size={13} />
              <em>{exploreArtist.rating}</em>
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
              className={`exploreStatBtn exploreStatRate ${userRating ? "is-active is-rate" : ""}`}
              aria-pressed={Boolean(userRating)}
              aria-label={userRating ? "امتیاز دادی" : "امتیاز بده"}
              onClick={onOpenRating}
            >
              <span className="exploreStatIcon">
                <CleanStar filled={Boolean(userRating)} size={18} />
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

          {commentList.length > 0 && (
            <section className="explorePreviewComments" aria-label="نظرات">
              <h4>نظرات</h4>
              {commentList.map((item) => (
                <div className="explorePreviewComment" key={item.user_id}>
                  <span className="explorePreviewCommentAvatar" aria-hidden="true">
                    {String(item.name || "؟").slice(0, 1)}
                  </span>
                  <div className="explorePreviewCommentMain">
                    <div className="explorePreviewCommentTop">
                      <b>{item.name}</b>
                      <CommentStars rating={item.rating} />
                    </div>
                    <p>{item.comment}</p>
                  </div>
                </div>
              ))}
            </section>
          )}
        </div>
      </article>
      <button type="button" className="artistWorkClose" onClick={onClose} aria-label="بستن">
        <X size={20} strokeWidth={2.4} />
      </button>
    </div>
  );
}
