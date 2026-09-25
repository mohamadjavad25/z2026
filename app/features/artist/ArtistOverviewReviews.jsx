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
  onComposeImageUpload,
  onComposeImageClear,
  composeTagOptions = [],
  composeVisibleTagOptions = [],
  composeTagMenuOpen = false,
  onComposeTagMenuOpenChange
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
        addLabel="افزودن کار"
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
    </div>
  );
}
