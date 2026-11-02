"use client";

import { useEffect, useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { PublicArtistModal } from "../../features/artist/PublicArtistModal";
import { getPublicArtistServices, salonClientBookingDays } from "../../features/artist/constants";
import { mapSharedPost } from "../../features/posts/mappers";
import { parseServiceDurationMinutes } from "../../shared/lib/time";
import { FollowSheet, useFollowGate } from "../../features/follow";
import { BusinessVisitorBar, businessVisitorKind } from "../../features/connect/BusinessVisitorBar";
import { goToAppFor } from "../../shared/lib/appHandoff";
import { ProfileSheet } from "../../features/profile/ProfileSheet";
import { createArtistBooking } from "../../shared/api/artists";
import { toPersianDigits } from "../../shared/lib/digits";

// Standalone, unauthenticated rendering of a single artist's public profile.
// This is the artist counterpart of app/salons/[id]/SalonPublicPageClient.jsx —
// it reuses the same presentation component the in-app (client-state) public
// artist flow uses, but none of the interactive actions here (follow/save/
// message/book) have a logged-in session or the app's socket/booking state to
// act on. Rather than half-implement those without auth, we send the visitor
// into the SPA shell to actually log in and use them. Follow works right here
// (sheet: sign up or log in, follow, thank-you) -- see SalonPublicPageClient. Booking works here too (owner,
// 2026-11-02): pick everything, then the account sheet, then the request goes (confirmBooking). Saving and
// opening a work open the app on this same artist (shared/lib/appHandoff.js).
function getPortfolioCardStyle(item) {
  return item?.image
    ? { backgroundImage: `linear-gradient(180deg, rgba(12, 14, 16, 0.04) 0%, transparent 46%, rgba(12, 14, 16, 0.68) 100%), url("${item.image}")` }
    : { backgroundImage: `url("/gallery-tile-empty.webp")` };
}

export function ArtistPublicPageClient({ artist }) {
  const router = useRouter();
  const goToApp = () => router.push("/");
  const openHere = () => goToAppFor(router, { type: "artist", id: artist.id, name: artist.name });
  const followGate = useFollowGate({ targetId: artist.id, targetName: artist.name, targetType: "artist" });
  // A salon or artist who scanned this page's code: their own bar instead of «رزرو» and «وصل شو» (owner's decision 2026-10-25).
  const visitorTarget = { type: "artist", id: artist.id, name: artist.name, area: artist.area || "" };
  const visitorBar = businessVisitorKind(followGate.viewer, visitorTarget)
    ? <BusinessVisitorBar viewer={followGate.viewer} target={visitorTarget} />
    : null;

  const [galleryFilter, setGalleryFilter] = useState("همه");
  const [selectedServiceId, setSelectedServiceId] = useState("");
  const [bookingDay, setBookingDay] = useState(salonClientBookingDays[0]);
  const [bookingSlot, setBookingSlot] = useState("");
  // Taken times learned while sending, so the picker stops offering them; and the sent request, for the thank-you.
  const [taken, setTaken] = useState([]);
  const [sent, setSent] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const shownArtist = useMemo(() => (taken.length ? { ...artist, bookedSlots: [...(artist.bookedSlots || []), ...taken] } : artist), [artist, taken]);

  const services = useMemo(() => getPublicArtistServices(artist), [artist]);

  useEffect(() => {
    if (!message) return undefined;
    const timer = window.setTimeout(() => setMessage(""), 6000);
    return () => window.clearTimeout(timer);
  }, [message]);

  /**
   * «بفرست» on this page (owner's decision of 2026-11-02, for visitors from an Instagram story): the visitor picked the
   * service, day and time; without an account the sign-up sheet opens and the request goes the moment they are in.
   * A time taken meanwhile is dropped from the picker with «این ساعت همین الان پر شد»; the rest of the picks stay.
   */
  const confirmBooking = () => {
    const service = services.find((item) => item.id === selectedServiceId) || services[0];
    if (!service || !bookingSlot || busy) return;
    const durationMinutes = parseServiceDurationMinutes(service.duration);
    const day = bookingDay;
    const time = bookingSlot;
    const send = async () => {
      setBusy(true);
      try {
        const { ok, status, payload } = await createArtistBooking({ artistUserId: artist.id, service: service.name, bookingDate: day, time, durationMinutes });
        if (ok) {
          setSent({ service: service.name, day, time });
          return;
        }
        if (payload?.code === "SLOT_TAKEN" || status === 409) {
          setTaken((list) => [...list, { booking_date: day, time, duration_minutes: durationMinutes, status: "تازه" }]);
          setBookingSlot("");
          setMessage("این ساعت همین الان پر شد؛ یه ساعت دیگه از همین روز انتخاب کن.");
          return;
        }
        setMessage(payload?.error || "درخواست نرفت؛ دوباره بزن.");
      } catch {
        setMessage("وصل نشد؛ دوباره بزن.");
      } finally {
        setBusy(false);
      }
    };
    const viewer = followGate.viewer;
    if (viewer && viewer.type !== "client") {
      setMessage("با حساب سالن یا آرتیست نمی‌شه نوبت گرفت؛ با حساب مشتری وارد شو.");
      return;
    }
    if (viewer) {
      void send();
      return;
    }
    followGate.askAccount("book", {
      onReady: async (user) => {
        if (user?.type && user.type !== "client") setMessage("با حساب سالن یا آرتیست نمی‌شه نوبت گرفت؛ با حساب مشتری وارد شو.");
        else await send();
        return "";
      },
      onCancel: () => setMessage("حساب نساختی، برای همین درخواست نرفت. انتخاب‌هات سر جاشه.")
    });
  };

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
    <>
    <PublicArtistModal
      artist={shownArtist}
      view="gallery"
      portfolio={portfolio}
      services={services}
      following={followGate.following}
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
      onSave={openHere}
      onFollow={followGate.onFollowClick}
      onViewChange={() => {}}
      onGalleryFilterChange={setGalleryFilter}
      onOpenWork={openHere}
      onSelectService={setSelectedServiceId}
      onBookingDayChange={setBookingDay}
      onBookingSlotChange={setBookingSlot}
      onConfirmBooking={confirmBooking}
      bookingBusy={busy}
      visitorBar={visitorBar}
      guest
    />
    <FollowSheet gate={followGate} />
    <ProfileSheet open={Boolean(sent)} kicker="انجام شد" title="درخواستت رفت" panelClassName="fsSheet" onClose={() => setSent(null)}>
      {sent ? (
        <div className="fsDone" role="status">
          <span className="fsDoneMark" aria-hidden="true"><Check size={34} strokeWidth={3} /></span>
          <h3>{sent.service} · {sent.day} ساعت {toPersianDigits(String(sent.time || "").slice(0, 5))}</h3>
          <p>«{artist.name}» باید تأییدش کنه. جوابش که اومد، توی فرفرو بهت خبر می‌دیم.</p>
          <div className="fsDoneActions">
            <a className="fsSubmit" href="/">برو به فرفرو</a>
            <button type="button" className="fsGhost" onClick={() => setSent(null)}>صفحه رو ببینم</button>
          </div>
        </div>
      ) : null}
    </ProfileSheet>
    {message ? <p className="fsToast" role="status">{message}</p> : null}
    </>
  );
}
