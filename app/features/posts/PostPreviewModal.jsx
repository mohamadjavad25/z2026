"use client";

import { PostViewer } from "../posts/PostViewer";

/**
 * Any visitor opening someone else's post (public gallery, saved list, share link).
 * Thin wrapper over the shared PostViewer.
 */
export function PostPreviewModal({
  post,
  posts = [],
  postOwner,
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
      owner={postOwner ? {
        name: postOwner.name,
        role: postOwner.role,
        area: postOwner.area,
        avatar: postOwner.avatar || post?.ownerAvatar || ""
      } : null}
      isSaved={isSaved}
      extra={passport}
      onClose={onClose}
      onNavigate={onNavigate}
      onToggleSaved={onToggleSaved}
      onShare={onShare}
      onOpenOwner={postOwner ? onOpenArtistProfile : undefined}
    />
  );
}
