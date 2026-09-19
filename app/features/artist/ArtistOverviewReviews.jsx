"use client";

import { useState } from "react";
import { Heart, MessageCircle, Send, Star } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatPersianDayTitle } from "../../shared/lib/persianCalendar";
import { ProfileEmptyState } from "../profile/ProfileEmptyState";
import { ProfileGallery } from "../profile/ProfileGallery";

function commentDateLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatPersianDayTitle(date).full;
}

function commentInitial(name) {
  const text = String(name || "").trim();
  return text ? Array.from(text)[0] : "؟";
}

/**
 * Artist owner — overview gallery + customer reviews.
 * Presentational: gallery/review data + callbacks from useArtistWorkspace / HomeApp.
 */
export function ArtistOverviewReviews({
  galleryItems = [],
  galleryTags = [],
  galleryFilter = "همه",
  onGalleryFilterChange,
  onAddWork,
  onItemClick,
  composeValue,
  onComposeChange,
  onComposeClose,
  onComposeSubmit,
  onComposeDelete,
  onComposeImageUpload,
  onComposeImageClear,
  composeTagOptions = [],
  composeVisibleTagOptions = [],
  composeTagMenuOpen = false,
  onComposeTagMenuOpenChange,
  reviewSummary = { count: 0, rating: "۰" },
  reviews = [],
  replyingReviewId = "",
  replyDraft = "",
  onReplyDraftChange,
  replySubmitting = false,
  onOpenReply,
  onCloseReply,
  onSubmitReply,
  onOpenReviewer,
  artistAvatar = ""
}) {
  const [activeOverviewPane, setActiveOverviewPane] = useState("gallery");
  const showingReviews = activeOverviewPane === "reviews";

  return (
    <div className="artistDashboard">
      <ProfileGallery
        label="گالری نمونه‌کار آرتیست"
        items={galleryItems}
        filters={galleryTags}
        activeFilter={galleryFilter}
        onFilterChange={onGalleryFilterChange}
        onAdd={onAddWork}
        addLabel="افزودن کار"
        headExtra={
          <button
            type="button"
            className={`profileGalleryHeadTab ${showingReviews ? "active" : ""}`}
            onClick={() => setActiveOverviewPane((pane) => (pane === "reviews" ? "gallery" : "reviews"))}
          >
            <MessageCircle size={16} />
            نظرات
          </button>
        }
        hideBody={showingReviews}
        onItemClick={onItemClick}
        composeValue={composeValue}
        onComposeChange={onComposeChange}
        onComposeClose={onComposeClose}
        onComposeSubmit={onComposeSubmit}
        onComposeDelete={onComposeDelete}
        onComposeImageUpload={onComposeImageUpload}
        onComposeImageClear={onComposeImageClear}
        composeTagOptions={composeTagOptions}
        composeVisibleTagOptions={composeVisibleTagOptions}
        composeTagMenuOpen={composeTagMenuOpen}
        onComposeTagMenuOpenChange={onComposeTagMenuOpenChange}
        composeAriaLabel="ویرایش نمونه‌کار"
        composeShowFeaturedToggle={false}
      />

      {showingReviews && reviewSummary.count === 0 ? (
        <ProfileEmptyState
          className="artistReviewEmptyState"
          icon={Star}
          title="هنوز نظری ثبت نشده"
          description="بعد از اولین نوبتی که تکمیل بشه، نظر مشتری‌ها همین‌جا نمایش داده می‌شود."
        />
      ) : null}

      {showingReviews && reviewSummary.count > 0 && (
        <section className="artistReviewBoard">
          <div className="boardHead">
            <strong>نظر مشتریان</strong>
            <b>{reviewSummary.rating} / ۵</b>
          </div>
          <div className="igCommentList">
            {reviews.map((review) => {
              const reviewId = review.id || `${review.name}-${review.service}-${review.text}`;
              const isReplying = replyingReviewId && String(replyingReviewId) === String(review.id);
              const hasReply = Boolean(review.reply_text);

              return (
                <article className="igComment" key={reviewId}>
                  <button
                    type="button"
                    className="igCommentAvatarBtn"
                    onClick={() => onOpenReviewer?.(review)}
                    aria-label={`پروفایل ${review.name}`}
                  >
                    <span
                      className={`igCommentAvatar ${review.author_avatar ? "has-image" : ""}`}
                      aria-hidden="true"
                      style={review.author_avatar ? { backgroundImage: `url("${review.author_avatar}")` } : undefined}
                    >
                      {!review.author_avatar ? commentInitial(review.name) : null}
                    </span>
                  </button>
                  <div className="igCommentBody">
                    <p className="igCommentText">
                      <button type="button" className="igCommentNameBtn" onClick={() => onOpenReviewer?.(review)}>
                        {review.name}
                      </button>{" "}
                      {review.text}
                    </p>
                    <div className="igCommentMeta">
                      <Star size={13} className="igCommentStar" fill="currentColor" aria-label={`امتیاز ${review.rating}`} />
                      <span>{toPersianDigits(review.rating)}</span>
                      {commentDateLabel(review.created_at) ? (
                        <time>{commentDateLabel(review.created_at)}</time>
                      ) : null}
                      {review.service ? <span className="igCommentServiceTag">{review.service}</span> : null}
                      {Number(review.like_count) > 0 ? (
                        <span className="igCommentLikes" aria-label={`${toPersianDigits(review.like_count)} لایک`}>
                          <Heart size={12} fill="currentColor" />
                          {toPersianDigits(review.like_count)}
                        </span>
                      ) : null}
                      <button type="button" className="igReplyAction" onClick={() => onOpenReply?.(review)}>
                        پاسخ
                      </button>
                    </div>

                    {hasReply && !isReplying ? (
                      <div className="igComment igReply">
                        <span
                          className={`igCommentAvatar igReplyAvatar ${artistAvatar ? "has-image" : ""}`}
                          aria-hidden="true"
                          style={artistAvatar ? { backgroundImage: `url("${artistAvatar}")` } : undefined}
                        >
                          {!artistAvatar ? "من" : null}
                        </span>
                        <div className="igCommentBody">
                          <p className="igCommentText">
                            <b>شما</b> {review.reply_text}
                          </p>
                          <div className="igCommentMeta">
                            {commentDateLabel(review.replied_at) ? (
                              <time>{commentDateLabel(review.replied_at)}</time>
                            ) : null}
                            <button type="button" className="igReplyAction" onClick={() => onOpenReply?.(review)}>
                              ویرایش پاسخ
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : null}

                    {isReplying ? (
                      <form
                        className="igReplyComposer"
                        onSubmit={(event) => {
                          event.preventDefault();
                          onSubmitReply?.();
                        }}
                      >
                        <input
                          type="text"
                          value={replyDraft}
                          onChange={(event) => onReplyDraftChange?.(event.target.value)}
                          placeholder="پاسخی برای این نظر بنویس..."
                          autoFocus
                        />
                        <button type="button" className="igReplyCancel" onClick={() => onCloseReply?.()}>
                          انصراف
                        </button>
                        <button
                          type="submit"
                          className="igReplySubmit"
                          disabled={!replyDraft.trim() || replySubmitting}
                          aria-label="ارسال پاسخ"
                        >
                          <Send size={15} />
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
