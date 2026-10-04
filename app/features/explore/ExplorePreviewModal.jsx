"use client";

import { PostViewer } from "../posts/PostViewer";

/**
 * Any visitor opening someone else's post (public gallery, saved list, share link).
 * Thin wrapper over the shared PostViewer.
 */
export function ExplorePreviewModal({
  post,
  posts = [],
  exploreArtist,
  isSaved,
  beautyPassport,
  passportMatch,
  onClose,
  onNavigate,
  onToggleSaved,
  onShare,
  onOpenArtistProfile
}) {
  const passport = beautyPassport?.active ? (
    <div className="passportFit">
      <b>{passportMatch} هماهنگی با شناسنامه تو</b>
      <small>{beautyPassport.summary}</small>
    </div>
  ) : null;

  return (
    <PostViewer
      post={post}
      posts={posts}
      owner={exploreArtist ? {
        name: exploreArtist.name,
        role: exploreArtist.role,
        area: exploreArtist.area,
        avatar: exploreArtist.avatar || post?.ownerAvatar || ""
      } : null}
      isSaved={isSaved}
      extra={passport}
      onClose={onClose}
      onNavigate={onNavigate}
      onToggleSaved={onToggleSaved}
      onShare={onShare}
      onOpenOwner={exploreArtist ? onOpenArtistProfile : undefined}
    />
  );
}
