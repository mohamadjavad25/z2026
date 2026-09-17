"use client";

import { useEffect, useState } from "react";
import { Heart, Star } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatPersianDayTitle } from "../../shared/lib/persianCalendar";

/** Flat, single-accent star row — clean minimal alternative to marble stars. */
function CleanStars({ value = 0, max = 5, size = 13, className = "" }) {
  const filled = Math.max(0, Math.min(max, Math.round(Number(value) || 0)));
  return (
    <span
      className={`artistPublicCleanStars ${className}`}
      role="img"
      aria-label={`امتیاز ${toPersianDigits(String(value))} از ${toPersianDigits(String(max))}`}
    >
      {Array.from({ length: max }, (_, index) => (
        <Star
          key={index}
          size={size}
          strokeWidth={1.5}
          className={index < filled ? "is-filled" : "is-empty"}
          fill={index < filled ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

function reviewDateLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return formatPersianDayTitle(date).full;
}

function reviewInitial(name) {
  const text = String(name || "").trim();
  return text ? Array.from(text)[0] : "؟";
}

/** Write-a-review composer: tap-to-pick stars + optional text, single submit. */
function ReviewComposer({ userRating = 0, onSubmit }) {
  const [stars, setStars] = useState(userRating || 0);
  const [hoverStars, setHoverStars] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setStars(userRating || 0);
  }, [userRating]);

  const activeLevel = hoverStars || stars;

  async function handleSubmit(event) {
    event.preventDefault();
    if (!stars || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit?.(stars, text.trim());
      setText("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="artistPublicReviewComposer" onSubmit={handleSubmit}>
      <b className="artistPublicReviewComposerLabel">
        {userRating ? "نظرت رو ویرایش کن" : "تجربه‌ت رو ثبت کن"}
      </b>
      <div className="artistPublicReviewComposerStars" onMouseLeave={() => setHoverStars(0)}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            type="button"
            key={value}
            aria-label={`امتیاز ${value} ستاره`}
            className={value <= activeLevel ? "is-active" : ""}
            onMouseEnter={() => setHoverStars(value)}
            onFocus={() => setHoverStars(value)}
            onClick={() => setStars(value)}
          >
            <Star size={20} strokeWidth={1.6} fill={value <= activeLevel ? "currentColor" : "none"} />
          </button>
        ))}
      </div>
      <div className="artistPublicReviewComposerRow">
        <input
          type="text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="تجربه‌ت رو با بقیه به اشتراک بذار..."
          maxLength={280}
        />
        <button type="submit" disabled={!stars || submitting}>
          {submitting ? "..." : "ثبت نظر"}
        </button>
      </div>
    </form>
  );
}

export function PublicArtistReviewsPanel({
  artist,
  reviews,
  viewerUserId,
  userRating = 0,
  onSubmitReview,
  onToggleLike
}) {
  const safeReviews = Array.isArray(reviews) ? reviews : [];
  const reviewCount = Number(artist?.reviewCount || safeReviews.length || 0);
  const isOwnProfile = Boolean(
    viewerUserId && artist?.id && Number(viewerUserId) === Number(artist.id)
  );

  return (
    <section className="artistPublicReviews" aria-label="نظرات مشتریان">
      {reviewCount > 0 ? (
        <div className="artistPublicReviewSummary">
          <div className="artistPublicReviewSummaryScore">
            <b>{toPersianDigits(artist.rating || "۰")}</b>
            <CleanStars value={artist.rating || 0} />
          </div>
          <span className="artistPublicReviewSummaryCount">
            {toPersianDigits(reviewCount)} نظر ثبت‌شده
          </span>
        </div>
      ) : null}

      {!isOwnProfile && typeof onSubmitReview === "function" ? (
        <ReviewComposer userRating={userRating} onSubmit={onSubmitReview} />
      ) : null}

      {safeReviews.length > 0 ? (
        <div className="artistPublicReviewRail">
          {safeReviews.map((review) => {
            const dateLabel = reviewDateLabel(review.created_at);
            const replyDateLabel = reviewDateLabel(review.replied_at);
            const likeCount = Number(review.like_count || 0);
            return (
              <article
                className="artistPublicReviewCard"
                key={review.id || `${review.name}-${review.rating}-${review.service}`}
              >
                <span
                  className={`artistPublicReviewAvatar ${review.author_avatar ? "has-image" : ""}`}
                  style={review.author_avatar ? { backgroundImage: `url("${review.author_avatar}")` } : undefined}
                >
                  {!review.author_avatar ? reviewInitial(review.name) : null}
                </span>
                <div className="artistPublicReviewMain">
                  <div className="artistPublicReviewTop">
                    <b>{review.name || "مشتری"}</b>
                    {review.service ? (
                      <small className="artistPublicReviewService">{review.service}</small>
                    ) : null}
                  </div>
                  <div className="artistPublicReviewMeta">
                    <CleanStars value={review.rating} size={12} />
                    <span className="artistPublicReviewRate">
                      {toPersianDigits(String(review.rating))}
                    </span>
                    {dateLabel ? <time className="artistPublicReviewDate">{dateLabel}</time> : null}
                  </div>
                  {review.text ? <p>{review.text}</p> : null}

                  <button
                    type="button"
                    className={`artistPublicReviewLike ${review.liked_by_me ? "is-liked" : ""}`}
                    aria-pressed={Boolean(review.liked_by_me)}
                    aria-label={review.liked_by_me ? "لغو لایک" : "لایک این نظر"}
                    onClick={() => onToggleLike?.(review.id)}
                  >
                    <Heart size={13} strokeWidth={2.2} fill={review.liked_by_me ? "currentColor" : "none"} />
                    {likeCount > 0 ? <span>{toPersianDigits(likeCount)}</span> : null}
                  </button>

                  {review.reply_text ? (
                    <div className="artistPublicReviewReply">
                      <span
                        className={`artistPublicReviewReplyAvatar ${artist?.avatar ? "has-image" : ""}`}
                        aria-hidden="true"
                        style={artist?.avatar ? { backgroundImage: `url("${artist.avatar}")` } : undefined}
                      >
                        {!artist?.avatar ? reviewInitial(artist?.name) : null}
                      </span>
                      <div className="artistPublicReviewReplyBody">
                        <div className="artistPublicReviewReplyTop">
                          <b>{artist?.name || "آرتیست"}</b>
                          {replyDateLabel ? (
                            <time className="artistPublicReviewReplyDate">{replyDateLabel}</time>
                          ) : null}
                        </div>
                        <p>{review.reply_text}</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="artistPublicEmpty artistPublicReviewEmpty">
          <span className="artistPublicEmptyIcon">
            <Star size={19} strokeWidth={1.6} />
          </span>
          <b>هنوز نظری ثبت نشده</b>
          <span>اولین نظر برای این آرتیست را بعد از رزرو بگذار.</span>
        </div>
      )}
    </section>
  );
}
