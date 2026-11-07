"use client";

import { useEffect } from "react";
import { parseServiceDurationMinutes } from "../../../shared/lib/time";
import { trackScreen } from "../../../shared/lib/activity";
import { PublicArtistModal } from "../../artist";
import { useHome } from "../HomeContext";

export function PublicArtistHost() {
  const {
    selectedPublicArtist,
    publicArtistFromSalon,
    publicArtistView,
    publicArtistPortfolio,
    publicArtistServices,
    isFollowingPublicArtist,
    publicArtistGalleryTags,
    publicArtistGalleryFilter,
    publicArtistFeatured,
    publicArtistGalleryRest,
    publicArtistSelectedServiceId,
    publicArtistBookingDay,
    publicArtistBookingSlot,
    getPortfolioCardStyle,
    closePublicArtistProfile,
    shareArtistProfile,
    isSavedPublicArtist,
    setPublicArtistView,
    setPublicArtistGalleryFilter,
    openPublicArtistWork,
    selectPublicArtistService,
    setPublicArtistBookingDay,
    setPublicArtistBookingSlot,
    confirmPublicArtistBooking,
    publicArtistBookingBusy,
    createdProfile,
    openProfileEdit,
    toggleSavePublicArtist,
    toggleFollowPublicArtist
  } = useHome();

  useEffect(() => {
    if (selectedPublicArtist?.id) trackScreen("public_artist", Number(selectedPublicArtist.id));
  }, [selectedPublicArtist?.id]);

  return (
    <PublicArtistModal
          artist={selectedPublicArtist}
          view={publicArtistView}
          portfolio={publicArtistPortfolio}
          services={publicArtistServices}
          following={isFollowingPublicArtist}
          galleryTags={publicArtistGalleryTags}
          galleryFilter={publicArtistGalleryFilter}
          featuredWork={publicArtistFeatured}
          galleryRest={publicArtistGalleryRest}
          selectedServiceId={publicArtistSelectedServiceId}
          bookingDay={publicArtistBookingDay}
          bookingSlot={publicArtistBookingSlot}
          parseDuration={parseServiceDurationMinutes}
          getCardStyle={getPortfolioCardStyle}
          onClose={() => closePublicArtistProfile({ restoreSalon: true })}
          salonName={publicArtistFromSalon?.name || ""}
          onOpenSalon={() => closePublicArtistProfile({ restoreSalon: true })}
          onShare={shareArtistProfile}
          saved={isSavedPublicArtist}
          onSave={() => selectedPublicArtist && toggleSavePublicArtist(selectedPublicArtist)}
          onFollow={() => selectedPublicArtist && toggleFollowPublicArtist(selectedPublicArtist)}
          onViewChange={setPublicArtistView}
          onGalleryFilterChange={setPublicArtistGalleryFilter}
          onOpenWork={openPublicArtistWork}
          onSelectService={selectPublicArtistService}
          onBookingDayChange={setPublicArtistBookingDay}
          onBookingSlotChange={setPublicArtistBookingSlot}
          onConfirmBooking={confirmPublicArtistBooking}
          bookingBusy={publicArtistBookingBusy}
          clientPhone={createdProfile?.data?.phone || ""}
          onEditProfile={openProfileEdit}
        />
  );
}
