"use client";

import { BadgeCheck, Bookmark, CalendarCheck, ChevronLeft, Heart, Info, MapPin, Share2, X } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatCount } from "../../shared/lib/counts";
import { isPublicArtistSlotBlocked } from "./bookingUtils";
import { PUBLIC_PROFILE_DEFAULT_HERO, PUBLIC_PROFILE_DEFAULT_LOGO } from "./constants";
import { PublicArtistAboutPanel } from "./PublicArtistAboutPanel";
import { PublicArtistBookingPanel } from "./PublicArtistBookingPanel";
import { PublicArtistGalleryPanel } from "./PublicArtistGalleryPanel";
import { PublicArtistServicesPanel } from "./PublicArtistServicesPanel";
import { ProfileSheet } from "../profile/ProfileSheet";
import { useState } from "react";

export function PublicArtistModal({
  artist,
  heroImage,
  view,
  portfolio,
  services,
  following,
  saved,
  galleryTags,
  galleryFilter,
  featuredWork,
  galleryRest,
  selectedServiceId,
  bookingDay,
  bookingSlot,
  parseDuration,
  getCardStyle,
  onClose,
  onShare,
  onSave,
  onFollow,
  onViewChange,
  onGalleryFilterChange,
  onOpenWork,
  onSelectService,
  onBookingDayChange,
  onBookingSlotChange,
  onConfirmBooking,
  bookingBusy = false,
  clientPhone = "",
  onEditProfile
}) {
  const [bookingPopup, setBookingPopup] = useState(false);
  const [aboutPopup, setAboutPopup] = useState(false);
  if (!artist) return null;

  return (
    <div
      className="artistPublicModal"
      role="dialog"
      aria-modal="true"
      aria-label={`پروفایل عمومی ${artist.name}`}
    >
      <article className="artistPublicSheet">
        <section className="artistPublicPage" aria-label={`صفحه عمومی ${artist.name}`}>
          <header className="artistPublicCover">
            {/* Real <img> (not a CSS background) so this — usually the single
                largest, most prominent photo on the page — is indexable by
                Google Image Search and readable by screen readers. When the
                artist has no poster we fall back to the same stock hero the
                salon page uses, instead of rendering an empty grey band. */}
            <img
              className="publicStoryHeroImage"
              src={heroImage || PUBLIC_PROFILE_DEFAULT_HERO}
              alt={heroImage && artist.name ? `${artist.name} — تصویر کاور` : ""}
              aria-hidden={heroImage ? undefined : true}
            />
            <div className="artistPublicCoverShade" aria-hidden="true" />
            <div className="artistPublicHeroTop">
              <button type="button" className="artistPublicBack" onClick={onClose} aria-label="بازگشت">
                <ChevronLeft size={18} />
              </button>
              <div className="artistPublicHeroTopActions">
                <button
                  type="button"
                  aria-label="اشتراک‌گذاری"
                  onClick={onShare}
                >
                  <Share2 size={16} />
                </button>
                <button
                  type="button"
                  aria-label={saved ? "حذف از ذخیره‌ها" : "ذخیره پروفایل"}
                  className={saved ? "is-saved" : ""}
                  onClick={onSave}
                >
                  <Bookmark size={16} fill={saved ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          </header>

          <section className="artistPublicIdentityCard">
            <div className="artistPublicAvatarWrap">
              <div className="artistPublicAvatar hasImage">
                {/* Always an image, exactly like the salon logo slot
                    (features/salons/SalonClientPage.jsx): the artist's own
                    avatar, else the cover photo, else the stock profile icon.
                    The old bare-initial fallback left a text glyph in an
                    otherwise image-only slot. */}
                <img
                  className="artistPublicAvatarImage"
                  src={artist.avatar || heroImage || PUBLIC_PROFILE_DEFAULT_LOGO}
                  alt={artist.avatar || heroImage
                    ? (artist.name ? `تصویر پروفایل ${artist.name}` : "تصویر پروفایل آرتیست")
                    : ""}
                  aria-hidden={artist.avatar || heroImage ? undefined : true}
                  style={{ objectPosition: artist.avatarPosition || "50% 50%" }}
                />
              </div>
            </div>

            <div className="artistPublicTitle">
              <h2>
                <span className="artistPublicNameText">{artist.name}</span>
                <BadgeCheck className="artistPublicVerifiedIcon" size={15} />
              </h2>
              {artist.area ? (
                <span className="artistPublicCityTag">
                  <MapPin size={12} />
                  {String(artist.area).split("،")[0].replace(/^(شهر|روستای|دهستان)\s+/, "").trim() || String(artist.area).trim()}
                </span>
              ) : null}
            </div>

            <div className="artistPublicStatsRow" aria-label="آمار آرتیست">
              <span><b>{toPersianDigits(artist.experienceYears || 0)}</b> سال تجربه</span>
              <span><b>{formatCount(artist.followers)}</b> دنبال‌کننده</span>
            </div>

            <div className="artistPublicActions">
              <button
                type="button"
                className={`artistPublicFollow ${following ? "is-following" : ""}`}
                onClick={onFollow}
              >
                <Heart size={16} />
                {following ? "دنبال می‌کنی" : "فالو"}
              </button>
            </div>
          </section>

          <div className="artistPublicBody">
            <div className="artistPublicContent" key={view}>
              <>
                  <PublicArtistServicesPanel
                    services={services}
                    selectedServiceId={selectedServiceId}
                    onServiceClick={(service) => { onSelectService(service.id); setBookingPopup(true); }}
                    onSelectService={onSelectService}
                  />
                  <PublicArtistGalleryPanel
                    tags={galleryTags}
                    activeTag={galleryFilter}
                    featured={featuredWork}
                    rest={galleryRest}
                    getCardStyle={getCardStyle}
                    onTagChange={onGalleryFilterChange}
                    onOpenWork={onOpenWork}
                  />
                </>
            </div>

            <div className="artistPublicBooking">
              <button
                type="button"
                className="artistPublicAboutBtn"
                onClick={() => setAboutPopup(true)}
                aria-label="درباره هنرمند"
                title="درباره هنرمند"
              >
                <Info size={18} />
                <span>درباره هنرمند</span>
              </button>
            </div>
          </div>

          <ProfileSheet
            open={bookingPopup}
            kicker={artist.name || "آرتیست"}
            title="رزرو نوبت"
            panelClassName="artistBookingPopupSheet"
            onClose={() => setBookingPopup(false)}
          >
                <PublicArtistBookingPanel
                  artist={artist}
                  services={services}
                  selectedServiceId={selectedServiceId}
                  bookingDay={bookingDay}
                  bookingSlot={bookingSlot}
                  parseDuration={parseDuration}
                  onBackToServices={() => setBookingPopup(false)}
                  onDayChange={(day, durationMinutes) => {
                    onBookingDayChange(day);
                    onBookingSlotChange((current) => (
                      current
                      && !isPublicArtistSlotBlocked(artist, day, current, durationMinutes)
                        ? current
                        : ""
                    ));
                  }}
                  onSlotChange={onBookingSlotChange}
                />
                {!clientPhone ? (
                  <p className="artistBookingPhoneWarning">
                    برای رزرو، شماره تماس را در پروفایلت ثبت کن — بدون آن آرتیست نمی‌تواند برای تایید با تو تماس بگیرد.{" "}
                    {typeof onEditProfile === "function" ? (
                      <button type="button" onClick={onEditProfile}>
                        ثبت شماره تماس
                      </button>
                    ) : null}
                  </p>
                ) : null}
                <button
                  type="button"
                  className="artistBookingPopupConfirm"
                  disabled={bookingBusy || !bookingSlot || !clientPhone}
                  onClick={() => {
                    if (bookingBusy || !bookingSlot || !clientPhone) return;
                    onConfirmBooking();
                    setBookingPopup(false);
                  }}
                >
                  <CalendarCheck size={17} />
                  {bookingBusy ? "در حال ثبت..." : bookingSlot ? `تایید رزرو · ${bookingDay} ${bookingSlot}` : "ساعت را انتخاب کن"}
                </button>
          </ProfileSheet>

          {aboutPopup ? (
            <div
              className="artistAboutPopup"
              role="dialog"
              aria-modal="true"
              aria-label="درباره هنرمند"
              onClick={() => setAboutPopup(false)}
            >
              <article className="artistAboutPopupSheet" onClick={(event) => event.stopPropagation()}>
                <div className="artistAboutPopupHead">
                  <span className="artistAboutPopupHeadIcon">
                    <Info size={18} />
                  </span>
                  <h3>درباره {artist.name}</h3>
                </div>
                <PublicArtistAboutPanel artist={artist} />
              </article>
              <button
                type="button"
                className="artistAboutPopupClose"
                onClick={() => setAboutPopup(false)}
                aria-label="بستن"
              >
                <X size={18} />
              </button>
            </div>
          ) : null}
        </section>
      </article>
    </div>
  );
}
