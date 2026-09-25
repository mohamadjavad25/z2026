"use client";

import { BadgeCheck, Bookmark, CalendarCheck, ChevronLeft, Heart, Info, MapPin, Share2, X } from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatCount } from "../../shared/lib/counts";
import { isPublicArtistSlotBlocked } from "./bookingUtils";
import { PublicArtistAboutPanel } from "./PublicArtistAboutPanel";
import { PublicArtistBookingPanel } from "./PublicArtistBookingPanel";
import { PublicArtistGalleryPanel } from "./PublicArtistGalleryPanel";
import { PublicArtistServicesPanel } from "./PublicArtistServicesPanel";
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
  bookingBusy = false
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
            {heroImage ? (
              // Real <img> (not a CSS background) so this — usually the
              // single largest, most prominent photo on the page — is
              // indexable by Google Image Search and readable by screen
              // readers.
              <img
                className="publicStoryHeroImage"
                src={heroImage}
                alt={artist.name ? `${artist.name} — تصویر کاور` : ""}
              />
            ) : (
              <div className="publicStoryHeroImage" aria-hidden="true" />
            )}
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
              <div className={`artistPublicAvatar ${(artist.avatar || heroImage) ? "hasImage" : ""}`}>
                {(artist.avatar || heroImage) ? (
                  // Real <img> (not a CSS background) so the artist's profile
                  // photo is indexable by Google Image Search and readable by
                  // screen readers — it's real content, not decoration.
                  <img
                    className="artistPublicAvatarImage"
                    src={artist.avatar || heroImage}
                    alt={artist.name ? `تصویر پروفایل ${artist.name}` : "تصویر پروفایل آرتیست"}
                  />
                ) : (
                  String(artist.name || "آ").slice(0, 1)
                )}
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

          {bookingPopup ? (
            <div className="artistBookingPopup" role="dialog" aria-modal="true" aria-label="رزرو نوبت" onClick={() => setBookingPopup(false)}>
              <article className="artistBookingPopupSheet" onClick={(event) => event.stopPropagation()}>
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
                <button
                  type="button"
                  className="artistBookingPopupConfirm"
                  disabled={bookingBusy}
                  onClick={() => {
                    if (bookingBusy) return;
                    onConfirmBooking();
                    if (bookingSlot) setBookingPopup(false);
                  }}
                >
                  <CalendarCheck size={17} />
                  {bookingBusy ? "در حال ثبت..." : bookingSlot ? `تایید رزرو · ${bookingDay} ${bookingSlot}` : "ساعت را انتخاب کن"}
                </button>
              </article>
              <button type="button" className="artistBookingPopupClose" onClick={() => setBookingPopup(false)}>
                <X size={18} />
              </button>
            </div>
          ) : null}

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
