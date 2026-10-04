"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PublicArtistModal } from "../../features/artist/PublicArtistModal";
import { getPublicArtistServices, salonClientBookingDays } from "../../features/artist/constants";
import { mapSharedPost } from "../../features/posts/mappers";
import { parseServiceDurationMinutes } from "../../shared/lib/time";

// Standalone, unauthenticated rendering of a single artist's public profile.
// This is the artist counterpart of app/salons/[id]/SalonPublicPageClient.jsx —
// it reuses the same presentation component the in-app (client-state) public
// artist flow uses, but none of the interactive actions here (follow/save/
// message/book) have a logged-in session or the app's socket/booking state to
// act on. Rather than half-implement those without auth, we send the visitor
// into the SPA shell to actually log in and use them.
function getPortfolioCardStyle(item) {
  return item?.image
    ? { backgroundImage: `linear-gradient(180deg, rgba(12, 14, 16, 0.04) 0%, transparent 46%, rgba(12, 14, 16, 0.68) 100%), url("${item.image}")` }
    : { backgroundImage: `url("/gallery-tile-empty.png")` };
}

export function ArtistPublicPageClient({ artist }) {
  const router = useRouter();
  const goToApp = () => router.push("/");

  const [galleryFilter, setGalleryFilter] = useState("همه");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [bookingDay, setBookingDay] = useState(salonClientBookingDays[0]);
  const [bookingSlot, setBookingSlot] = useState("");

  const services = useMemo(() => getPublicArtistServices(artist), [artist]);

  const portfolio = useMemo(
    () => (Array.isArray(artist?.posts) ? artist.posts.map(mapSharedPost).filter(Boolean) : []),
    [artist]
  );

  const galleryTags = useMemo(() => {
    const tags = Array.from(new Set(portfolio.map((item) => item.tag).filter(Boolean)));
    return ["همه", ...tags];
  }, [portfolio]);

  const galleryItems = galleryFilter === "همه"
    ? portfolio
    : portfolio.filter((item) => item.tag === galleryFilter);
  const featuredWork = galleryItems[0] || null;
  const galleryRest = galleryItems.slice(1);

  const heroImage = (portfolio.find((item) => item.featured) || portfolio[0])?.image
    || artist?.avatar
    || "";

  const handleShare = () => {
    if (typeof window === "undefined") return;
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({ title: artist.name, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  return (
    <PublicArtistModal
      artist={artist}
      heroImage={heroImage}
      view="gallery"
      portfolio={portfolio}
      services={services}
      following={false}
      galleryTags={galleryTags}
      galleryFilter={galleryFilter}
      featuredWork={featuredWork}
      galleryRest={galleryRest}
      selectedServiceId={selectedServiceId}
      bookingDay={bookingDay}
      bookingSlot={bookingSlot}
      parseDuration={parseServiceDurationMinutes}
      getCardStyle={getPortfolioCardStyle}
      onClose={goToApp}
      onShare={handleShare}
      onSave={goToApp}
      onFollow={goToApp}
      onViewChange={() => {}}
      onGalleryFilterChange={setGalleryFilter}
      onOpenWork={goToApp}
      onSelectService={setSelectedServiceId}
      onBookingDayChange={setBookingDay}
      onBookingSlotChange={setBookingSlot}
      onConfirmBooking={goToApp}
    />
  );
}
