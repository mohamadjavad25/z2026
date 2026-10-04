"use client";

import { ProfileGallery } from "../profile/ProfileGallery";

/**
 * Artist owner — overview gallery (nomone-kar showcase).
 * Presentational: gallery data + callbacks from useArtistWorkspace / HomeApp.
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
  onComposeNotify,
  onComposeImageClear,
  composeTagOptions = [],
  composeTagMenuOpen = false,
  onComposeTagMenuOpenChange,
  loading = false
}) {
  return (
    <div className="artistDashboard">
      <ProfileGallery
        label="گالری نمونه‌کار آرتیست"
        items={galleryItems}
        filters={galleryTags}
        activeFilter={galleryFilter}
        onFilterChange={onGalleryFilterChange}
        onAdd={onAddWork}
        addLabel="ایجاد پست"
        onItemClick={onItemClick}
        composeValue={composeValue}
        onComposeChange={onComposeChange}
        onComposeClose={onComposeClose}
        onComposeSubmit={onComposeSubmit}
        onComposeDelete={onComposeDelete}
        onComposeNotify={onComposeNotify}
        onComposeImageClear={onComposeImageClear}
        composeTagOptions={composeTagOptions}
        composeTagMenuOpen={composeTagMenuOpen}
        onComposeTagMenuOpenChange={onComposeTagMenuOpenChange}
        composeAriaLabel="ویرایش نمونه‌کار"
        loading={loading}
      />
    </div>
  );
}
