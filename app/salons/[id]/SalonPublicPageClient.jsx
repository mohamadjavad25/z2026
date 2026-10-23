"use client";

import { useRouter } from "next/navigation";
import { SalonClientPage } from "../../features/salons/SalonClientPage";
import { getVisibleSalonServiceItems } from "../../features/salons/useSalonDirectory";
import { FollowSheet, useFollowGate } from "../../features/follow";
import { goToAppFor, pickedServiceNames } from "../../shared/lib/appHandoff";

// Standalone, unauthenticated rendering of a single salon's public profile.
// This is the pilot Next.js route for SEO/shareable salon links — it reuses
// the same presentation component the in-app (client-state) salon flow uses,
// but none of the interactive actions here (follow/save/book) have a
// logged-in session or the app's socket/booking state to act on. Rather than
// half-implement those without auth, we send the visitor into the SPA shell
// to actually log in and use them. See backend report for the tradeoff note.
// Follow is the exception: it works right here (sign up or log in in a sheet,
// follow, thank-you), because a follow is the start of the relationship and a
// visitor from a QR code must not be sent away to finish it. Booking and saving open the app on this
// same salon (shared/lib/appHandoff.js), never on an empty home.
function getPortfolioCardStyle(item) {
  return item?.image
    ? { backgroundImage: `linear-gradient(180deg, rgba(12, 14, 16, 0.04) 0%, transparent 46%, rgba(12, 14, 16, 0.68) 100%), url("${item.image}")` }
    : { backgroundImage: `url("/gallery-tile-empty.webp")` };
}

export function SalonPublicPageClient({ salon }) {
  const router = useRouter();
  const goToApp = () => router.push("/");
  // `picked`: the service(s) the visitor ticked in the services menu; they are kept through sign-up so the booking form opens on them.
  const openHere = (picked = null) => goToAppFor(router, { type: "salon", id: salon.id, name: salon.name, services: pickedServiceNames(picked) });
  const followGate = useFollowGate({ targetId: salon.id, targetName: salon.name, targetType: "salon" });

  const handleShare = () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: salon.name, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  return (
    <>
    <SalonClientPage
      active
      selectedSalon={salon}
      isFollowing={followGate.following}
      isSaved={false}
      getVisibleServices={getVisibleSalonServiceItems}
      getPortfolioCardStyle={getPortfolioCardStyle}
      onBack={goToApp}
      onFollow={followGate.onFollowClick}
      onSave={() => openHere()}
      onShare={handleShare}
      onOpenBooking={openHere}
    />
    <FollowSheet gate={followGate} />
    </>
  );
}
