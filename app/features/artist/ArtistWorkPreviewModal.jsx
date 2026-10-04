"use client";

import { PostViewer } from "../posts/PostViewer";

/**
 * Artist owner -- opens one of their own gallery posts. Thin wrapper over the shared
 * PostViewer: edit/share for the owner, browse through the gallery.
 */
export function ArtistWorkPreviewModal({ work, works = [], owner = null, onClose, onEdit, onNavigate, onShare }) {
  return (
    <PostViewer
      post={work}
      posts={works}
      owner={owner}
      canEdit
      onClose={onClose}
      onNavigate={onNavigate}
      onEdit={onEdit}
      onShare={() => work && onShare?.(work)}
    />
  );
}
