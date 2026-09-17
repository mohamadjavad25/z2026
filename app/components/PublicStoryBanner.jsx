"use client";

import { useEffect, useRef, useState } from "react";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Shared story-player logic for public profiles (salon / shop / artist).
 * One source of truth: open/empty/drag/progress/aspect + logo handlers.
 */
export function usePublicStory({ storyVideoSrc = "", storyPosterSrc = "" }) {
  const [storyOpen, setStoryOpen] = useState(false);
  const [storyEmptyOpen, setStoryEmptyOpen] = useState(false);
  const [storyDrag, setStoryDrag] = useState(0);
  const [storyProgress, setStoryProgress] = useState(0);
  const [storyAspect, setStoryAspect] = useState("wide");
  const dragRef = useRef({ active: false, startX: 0 });
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (storyOpen && storyVideoSrc) {
      video.play().catch(() => {});
      return;
    }
    video.pause();
    video.currentTime = 0;
    setStoryProgress(0);
  }, [storyOpen, storyVideoSrc]);

  useEffect(() => {
    setStoryAspect("wide");
  }, [storyVideoSrc]);

  function openStoryExperience() {
    if (storyVideoSrc) {
      setStoryEmptyOpen(false);
      setStoryOpen((open) => !open);
      return;
    }
    setStoryOpen(false);
    setStoryEmptyOpen((open) => !open);
  }

  function startStoryDrag(event) {
    dragRef.current = { active: true, startX: event.clientX };
    setStoryDrag(0);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function moveStoryDrag(event) {
    if (!dragRef.current.active) return;
    const pullLeft = dragRef.current.startX - event.clientX;
    setStoryDrag(clamp(pullLeft, 0, 96));
  }

  function endStoryDrag(event) {
    if (!dragRef.current.active) return;
    const pullLeft = dragRef.current.startX - event.clientX;
    dragRef.current.active = false;
    setStoryDrag(0);
    if (pullLeft > 44) {
      if (storyVideoSrc) {
        setStoryEmptyOpen(false);
        setStoryOpen(true);
      } else {
        setStoryOpen(false);
        setStoryEmptyOpen(true);
      }
    } else if (pullLeft < -36) {
      setStoryOpen(false);
      setStoryEmptyOpen(false);
    }
  }

  function updateStoryProgress(event) {
    const video = event.currentTarget;
    const progress = video.duration ? (video.currentTime / video.duration) * 100 : 0;
    setStoryProgress(clamp(progress, 0, 100));
  }

  function updateStoryAspect(event) {
    const video = event.currentTarget;
    if (!video.videoWidth || !video.videoHeight) return;
    const ratio = video.videoHeight / video.videoWidth;
    if (ratio >= 1.22) {
      setStoryAspect("tall");
    } else if (ratio >= 0.92) {
      setStoryAspect("square");
    } else {
      setStoryAspect("wide");
    }
  }

  return {
    storyOpen,
    storyEmptyOpen,
    storyDrag,
    storyProgress,
    storyAspect,
    storyVideoSrc,
    storyPosterSrc,
    videoRef,
    storyStateClasses: `is-story-${storyAspect} ${storyOpen ? "is-story-open" : ""} ${storyEmptyOpen ? "is-story-empty" : ""} ${storyDrag ? "is-story-dragging" : ""}`,
    storyDragStyle: {
      "--story-drag": `${storyDrag}px`,
      "--story-drag-progress": `${clamp((storyDrag / 96) * 100, 0, 100)}%`,
      "--story-progress": `${storyProgress}%`
    },
    openStoryExperience,
    startStoryDrag,
    moveStoryDrag,
    endStoryDrag,
    updateStoryProgress,
    updateStoryAspect,
    logoHandlers: {
      role: "button",
      tabIndex: 0,
      "aria-label": "مشاهده استوری",
      onPointerDown: startStoryDrag,
      onPointerMove: moveStoryDrag,
      onPointerUp: endStoryDrag,
      onPointerCancel: endStoryDrag,
      onClick: openStoryExperience,
      onDoubleClick: openStoryExperience,
      onKeyDown: (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openStoryExperience();
        }
      }
    }
  };
}

/**
 * Shared public banner: hero image + story video/rail/empty layer.
 * State classes (is-story-*) must live on the page root (via storyStateClasses).
 * The draggable/clickable logo is rendered by the page itself with story.logoHandlers.
 */
export function PublicStoryBanner({
  story,
  heroClassName = "",
  heroImage = "",
  topbar = null,
  extra = null,
  emptyTitle = "استوری معرفی هنوز آماده نیست",
  emptyText = "وقتی ویدیوی معرفی اضافه شود، همین‌جا مثل یک استوری پخش می‌شود.",
  role = null,
  ariaLabel = ""
}) {
  const { storyVideoSrc, storyPosterSrc, storyEmptyOpen } = story;
  return (
    <header
      className={`${heroClassName} publicStoryBanner`}
      style={story.storyDragStyle}
      role={role}
      aria-label={ariaLabel || undefined}
    >
      <div
        className="publicStoryHeroImage"
        style={heroImage ? { backgroundImage: `url("${heroImage}")` } : undefined}
        aria-hidden="true"
      />
      {storyVideoSrc ? (
        <video
          ref={story.videoRef}
          className="publicStoryVideo"
          src={storyVideoSrc}
          poster={storyPosterSrc}
          muted
          playsInline
          loop
          preload="metadata"
          onLoadedMetadata={story.updateStoryAspect}
          onTimeUpdate={story.updateStoryProgress}
          aria-hidden={!story.storyOpen}
        />
      ) : null}
      {extra}
      {topbar}
      <div className="publicStoryRail" aria-hidden="true">
        <span />
      </div>
      {storyEmptyOpen ? (
        <div className="publicStoryEmpty" role="status" aria-live="polite">
          <b>{emptyTitle}</b>
          <span>{emptyText}</span>
        </div>
      ) : null}
    </header>
  );
}
