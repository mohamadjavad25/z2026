"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bookmark, Calendar, ChevronLeft, ChevronRight, Eye, Flag, Lock, Pencil, Pin, Share2 } from "lucide-react";
import { SheetClose } from "../../components/SheetClose";
import { ReportSheet } from "../support";
import { formatPostAge, postCount } from "./postFormat";

/**
 * One viewer for every post, everywhere: the owner's gallery, an artist's public
 * gallery, the saved list and share links. Browses the surrounding list (arrows,
 * swipe, arrow keys), closes with Escape, and returns focus to what opened it.
 *
 * Owner-only controls (edit, visibility, pin) appear only when `canEdit`; the save
 * button only for other people's posts.
 */
export function PostViewer({
  post,
  posts = [],
  owner = null,
  isSaved = false,
  canEdit = false,
  extra = null,
  onClose,
  onNavigate,
  onToggleSaved,
  onShare,
  onEdit,
  onOpenOwner
}) {
  const sheetRef = useRef(null);
  const returnFocusRef = useRef(null);
  const touchRef = useRef(null);
  const [reporting, setReporting] = useState(false);

  const index = post ? posts.findIndex((item) => String(item.id) === String(post.id)) : -1;
  const prev = index > 0 ? posts[index - 1] : null;
  const next = index >= 0 && index < posts.length - 1 ? posts[index + 1] : null;

  useEffect(() => {
    if (!post) return undefined;
    returnFocusRef.current = document.activeElement;
    sheetRef.current?.focus();
    return () => returnFocusRef.current?.focus?.();
  }, [Boolean(post)]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!post) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") onClose?.();
      // RTL: the "next" post is to the left.
      else if (event.key === "ArrowLeft" && next) onNavigate?.(next);
      else if (event.key === "ArrowRight" && prev) onNavigate?.(prev);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [post, prev, next, onClose, onNavigate]);

  if (!post || typeof document === "undefined") return null;

  const isPrivate = post.isPublic === false;
  const age = formatPostAge(post.createdAt);

  function handleTouchEnd(event) {
    const start = touchRef.current;
    touchRef.current = null;
    if (!start) return;
    const dx = event.changedTouches[0].clientX - start.x;
    const dy = event.changedTouches[0].clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    // Swipe toward the left edge goes to the next post in RTL.
    if (dx < 0 && next) onNavigate?.(next);
    else if (dx > 0 && prev) onNavigate?.(prev);
  }

  return createPortal(
    <div className="pvOverlay" role="dialog" aria-modal="true" aria-label={post.title || "نمونه‌کار"} onClick={onClose}>
      <article
        className="pvSheet"
        ref={sheetRef}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => { touchRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }; }}
        onTouchEnd={handleTouchEnd}
      >
        <div className="pvMedia">
          {post.image ? (
            <img src={post.image} alt={post.title || "نمونه‌کار"} decoding="async" />
          ) : (
            <div className="pvMediaEmpty" aria-hidden="true" />
          )}
          {posts.length > 1 && index >= 0 ? (
            <>
              <span className="pvCounter">{postCount(index + 1)} از {postCount(posts.length)}</span>
              {prev ? (
                <button type="button" className="pvNav is-prev" onClick={() => onNavigate?.(prev)} aria-label="نمونه‌کار قبلی">
                  <ChevronRight size={20} />
                </button>
              ) : null}
              {next ? (
                <button type="button" className="pvNav is-next" onClick={() => onNavigate?.(next)} aria-label="نمونه‌کار بعدی">
                  <ChevronLeft size={20} />
                </button>
              ) : null}
            </>
          ) : null}
          {canEdit && (isPrivate || post.featured) ? (
            <div className="pvBadges">
              {isPrivate ? <span><Lock size={12} /> خصوصی</span> : null}
              {post.featured ? <span><Pin size={12} /> سنجاق‌شده</span> : null}
            </div>
          ) : null}
        </div>

        <div className="pvBody">
          {owner ? (
            <button type="button" className="pvOwner" onClick={onOpenOwner} disabled={!onOpenOwner}>
              <span className={`pvOwnerAvatar ${owner.avatar ? "hasImage" : ""}`} aria-hidden="true">
                {owner.avatar ? <img src={owner.avatar} alt="" /> : String(owner.name || "آ").slice(0, 1)}
              </span>
              <span className="pvOwnerMeta">
                <b>{owner.name}</b>
                {owner.role || owner.area ? <small>{[owner.role, owner.area].filter(Boolean).join(" • ")}</small> : null}
              </span>
              {onOpenOwner ? <ChevronLeft size={16} aria-hidden="true" /> : null}
            </button>
          ) : null}

          <div className="pvTitleRow">
            <h3>{post.title}</h3>
            {post.tag ? <span className="pvTag">{post.tag}</span> : null}
          </div>
          {post.caption || post.meta ? <p className="pvCaption">{post.caption || post.meta}</p> : null}

          <div className="pvStats" role="group" aria-label="آمار">
            {age ? <span><Calendar size={14} />{age}</span> : null}
            <span><Eye size={14} />{postCount(post.views)} بازدید</span>
            <span><Bookmark size={14} />{postCount(post.saves)} ذخیره</span>
          </div>

          {extra}

          <div className="pvActions">
            {!canEdit ? (
              <button
                type="button"
                className={`pvAction ${isSaved ? "is-on" : ""}`}
                aria-pressed={isSaved}
                onClick={onToggleSaved}
              >
                <Bookmark size={17} fill={isSaved ? "currentColor" : "none"} />
                {isSaved ? "ذخیره شد" : "ذخیره"}
              </button>
            ) : null}
            {!isPrivate ? (
              <button type="button" className="pvAction" onClick={onShare}>
                <Share2 size={17} />
                اشتراک‌گذاری
              </button>
            ) : null}
            {!canEdit && post.id ? (
              <button type="button" className="pvAction" onClick={() => setReporting(true)}>
                <Flag size={16} />
                گزارش
              </button>
            ) : null}
            {canEdit ? (
              <button type="button" className="pvAction is-primary" onClick={() => onEdit?.(post)}>
                <Pencil size={16} />
                ویرایش
              </button>
            ) : null}
          </div>
        </div>
        <SheetClose onClick={onClose} />
        {reporting ? <ReportSheet targetType="post" targetId={post.id} title={post.title} above onClose={() => setReporting(false)} /> : null}
      </article>
    </div>,
    document.body
  );
}
