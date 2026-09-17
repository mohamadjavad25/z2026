"use client";

import { useRouter } from "next/navigation";
import { SalonClientPage } from "../../features/salons/SalonClientPage";
import { getVisibleSalonServiceItems } from "../../features/salons/useSalonDirectory";

// Standalone, unauthenticated rendering of a single salon's public profile.
// This is the pilot Next.js route for SEO/shareable salon links — it reuses
// the same presentation component the in-app (client-state) salon flow uses,
// but none of the interactive actions here (follow/save/book/chat) have a
// logged-in session or the app's socket/booking state to act on. Rather than
// half-implement those without auth, we send the visitor into the SPA shell
// to actually log in and use them. See backend report for the tradeoff note.
function getPortfolioCardStyle(item) {
  return item?.image
    ? { backgroundImage: `linear-gradient(180deg, rgba(12, 14, 16, 0.04) 0%, transparent 46%, rgba(12, 14, 16, 0.68) 100%), url("${item.image}")` }
    : undefined;
}

export function SalonPublicPageClient({ salon }) {
  const router = useRouter();
  const goToApp = () => router.push("/");

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
    <SalonClientPage
      active
      selectedSalon={salon}
      salons={[]}
      reviews={[]}
      isFollowing={false}
      isSaved={false}
      getVisibleServices={getVisibleSalonServiceItems}
      getPortfolioCardStyle={getPortfolioCardStyle}
      onBack={goToApp}
      onFollow={goToApp}
      onSave={goToApp}
      onShare={handleShare}
      onOpenBooking={goToApp}
      onOpenChat={goToApp}
      onSelectSalon={goToApp}
    />
  );
}
