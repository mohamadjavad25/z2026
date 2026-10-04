"use client";

import { Bookmark, CalendarCheck, ChevronLeft, Heart, Info, MapPin, Share2 } from "lucide-react";
import { SheetClose } from "../../components/SheetClose";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatCount } from "../../shared/lib/counts";
import { formatTomanNumber, parseTomanAmount } from "../../shared/lib/money";
import { isPublicArtistSlotBlocked } from "./bookingUtils";
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

  const specialties = String(artist.service || "").split(/[،,]/).map((item) => item.trim()).filter(Boolean).slice(0, 4);
  const prices = (services || []).map((service) => parseTomanAmount(service.price)).filter(Boolean);
  const fromPrice = prices.length ? Math.min(...prices) : 0;

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
                    style={{ objectPosition: artist.avatarPosition || "50% 50%" }}
                  />
                ) : (
                  String(artist.name || "آ").slice(0, 1)
                )}
              </div>
            </div>

            <div className="artistPublicTitle">
              <h2>
                <span className="artistPublicNameText">{artist.name}</span>
              </h2>
              {specialties.length ? (
                <div className="spvSpecialties">
                  {specialties.map((item) => <span key={item}>{item}</span>)}
                </div>
              ) : null}
              {artist.area ? (
                <span className="artistPublicCityTag">
                  <MapPin size={12} />
                  {String(artist.area).split("،")[0].replace(/^(شهر|روستای|دهستان)\s+/, "").trim() || String(artist.area).trim()}
                </span>
              ) : null}
            </div>

            <div className="artistPublicStatsRow" aria-label="آمار آرتیست">
              {Number(artist.experienceYears) > 0 ? <span><b>{toPersianDigits(artist.experienceYears)}</b> سال تجربه</span> : null}
              <span><b>{formatCount(artist.followers)}</b> دنبال‌کننده</span>
              {portfolio?.length ? <span><b>{toPersianDigits(portfolio.length)}</b> نمونه‌کار</span> : null}
            </div>
            {artist.bio ? <p className="spvBioLine">{artist.bio}</p> : null}

            <div className="artistPublicActions">
              <button
                type="button"
                className={`artistPublicFollow ${following ? "is-following" : ""}`}
                onClick={onFollow}
              >
                <Heart size={16} />
                {following ? "دنبال می‌کنی" : "دنبال کردن"}
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

            <nav className="spvBar" aria-label="رزرو و اطلاعات">
              <button type="button" className="spvBarIcon" onClick={() => setAboutPopup(true)} aria-label="درباره هنرمند" title="درباره هنرمند">
                <Info size={22} />
              </button>
              <button
                type="button"
                className="spvBarBook"
                disabled={!services?.length}
                onClick={() => {
                  const service = services.find((item) => item.id === selectedServiceId) || services[0];
                  if (!service) return;
                  onSelectService(service.id);
                  setBookingPopup(true);
                }}
              >
                <CalendarCheck size={19} />
                رزرو نوبت
                {fromPrice ? <small>از {formatTomanNumber(fromPrice)} تومان</small> : null}
              </button>
            </nav>
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
              <SheetClose onClick={() => setAboutPopup(false)} />
            </div>
          ) : null}
        </section>
      </article>
    </div>
  );
}
