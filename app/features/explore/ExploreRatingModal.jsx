"use client";

import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";

function CleanStar({ filled = false, size = 30 }) {
  return (
    <Star
      size={size}
      strokeWidth={1.6}
      className={`exploreRatingCleanStar ${filled ? "is-filled" : "is-empty"}`}
      fill={filled ? "currentColor" : "none"}
      aria-hidden="true"
    />
  );
}

export function ExploreRatingModal({ picker, onClose, onHover, onConfirm }) {
  const [selected, setSelected] = useState(0);
  const [comment, setComment] = useState("");

  useEffect(() => {
    setSelected(picker?.current || 0);
    setComment("");
  }, [picker?.postId]);

  if (!picker) return null;

  const level = picker.hover || selected || 0;
  const canSubmit = level >= 1;

  return (
    <div
      className="exploreRatingModal"
      role="dialog"
      aria-modal="true"
      aria-label="ثبت امتیاز و نظر"
      onClick={onClose}
    >
      <article className="exploreRatingSheet" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="exploreRatingClose" onClick={onClose} aria-label="بستن">
          <X size={18} strokeWidth={2.4} />
        </button>
        <span className="exploreRatingKicker">امتیاز به مدل</span>
        <b className="exploreRatingTitle">{picker.title}</b>
        <div
          className="exploreRatingStarsPick"
          onMouseLeave={() => onHover(0)}
        >
          {[1, 2, 3, 4, 5].map((stars) => {
            const isOn = level >= stars;
            return (
              <button
                type="button"
                key={stars}
                className={`exploreRatingStarBtn ${isOn ? "is-on" : ""}`}
                aria-label={`${stars} ستاره`}
                aria-pressed={isOn}
                onMouseEnter={() => onHover(stars)}
                onFocus={() => onHover(stars)}
                onClick={() => setSelected(stars)}
              >
                <CleanStar filled={isOn} />
              </button>
            );
          })}
        </div>
        <small className="exploreRatingHint">
          {level
            ? `${toPersianDigits(level)} ستاره انتخاب شده`
            : "یکی از ستارهها را انتخاب کن"}
        </small>
        <label className="exploreRatingComment">
          <span>نظرت درباره این مدل</span>
          <textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="مثلاً: تاج خیلی تمیز و مرتب انجام شد ✨"
            maxLength={300}
            rows={3}
          />
          <small className="exploreRatingCount">{toPersianDigits(comment.length)}/۳۰۰</small>
        </label>
        <button
          type="button"
          className="exploreRatingSubmit"
          disabled={!canSubmit}
          onClick={() => onConfirm(level, comment)}
        >
          {canSubmit ? "ثبت امتیاز و نظر" : "اول یک ستاره انتخاب کن"}
        </button>
      </article>
    </div>
  );
}
