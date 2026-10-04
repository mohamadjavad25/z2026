"use client";

import { Bookmark, CalendarCheck, Check, ChevronLeft, Heart, Info, MapPin, Share2 } from "lucide-react";
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
  guest = false,
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
          <header className="scHero">
            {heroImage ? (
              // Real <img> (not a CSS background) so this — usually the single largest photo on the
              // page — is indexable by Google Image Search and readable by screen readers.
              <img
                className="scHeroImage"
                src={heroImage}
                alt={artist.name ? `${artist.name} — تصویر کاور` : ""}
              />
            ) : (
              <div className="scHeroFallback" aria-hidden="true" />
            )}
            <div className="scTopbar">
              <button type="button" className="scRound" onClick={onClose} aria-label="بازگشت">
                <ChevronLeft size={20} />
              </button>
              <div className="scTopActions">
                <button type="button" className="scRound" aria-label="اشتراک‌گذاری" onClick={onShare}>
                  <Share2 size={18} />
                </button>
                <button
                  type="button"
                  className={`scRound${saved ? " is-saved" : ""}`}
                  aria-label={saved ? "حذف از ذخیره‌ها" : "ذخیره پروفایل"}
                  aria-pressed={Boolean(saved)}
                  onClick={onSave}
                >
                  <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
                </button>
              </div>
            </div>
          </header>

          <section className="scId">
            <span className="scAvatar">
              {(artist.avatar || heroImage) ? (
                // Real <img> so the profile photo is indexable and readable by screen readers.
                <img
                  src={artist.avatar || heroImage}
                  alt={artist.name ? `تصویر پروفایل ${artist.name}` : "تصویر پروفایل آرتیست"}
                  style={{ objectPosition: artist.avatarPosition || "50% 50%" }}
                />
              ) : (
                <b className="scAvatarLetter">{String(artist.name || "آ").slice(0, 1)}</b>
              )}
            </span>
            <h2>{artist.name}</h2>
            {specialties.length ? (
              <div className="spvSpecialties">
                {specialties.map((item) => <span key={item}>{item}</span>)}
              </div>
            ) : null}
            {artist.area ? (
              <p className="scArea">
                <MapPin size={13} />
                {String(artist.area).split("،")[0].replace(/^(شهر|روستای|دهستان)\s+/, "").trim() || String(artist.area).trim()}
              </p>
            ) : null}
            {artist.bio ? <p className="scBio">{artist.bio}</p> : null}
            <div className="scStats">
              {Number(artist.experienceYears) > 0 ? <span><b>{toPersianDigits(artist.experienceYears)}</b>سال تجربه</span> : null}
              <span><b>{formatCount(artist.followers)}</b>دنبال‌کننده</span>
              <span><b>{toPersianDigits(portfolio?.length || 0)}</b>نمونه‌کار</span>
            </div>
            <div className="scActions">
              <button type="button" className={following ? "is-following" : ""} onClick={onFollow}>
                {following ? <Check size={17} /> : <Heart size={17} />}
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
                {services?.length ? "رزرو نوبت" : "هنوز خدمتی برای رزرو نیست"}
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
                {guest ? (
                  <p className="artistBookingPhoneWarning is-info">
                    برای ثبت نوبت باید وارد زیبابان شوی. بعد از ورود، رزرو را از پروفایل همین آرتیست ادامه بده.
                  </p>
                ) : !clientPhone ? (
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
                  disabled={bookingBusy || !bookingSlot || (!guest && !clientPhone)}
                  onClick={() => {
                    if (bookingBusy || !bookingSlot || (!guest && !clientPhone)) return;
                    onConfirmBooking();
                    setBookingPopup(false);
                  }}
                >
                  <CalendarCheck size={17} />
                  {bookingBusy ? "در حال ثبت..." : bookingSlot ? (guest ? "ورود و ادامه رزرو" : `تایید رزرو · ${bookingDay} ${bookingSlot}`) : "ساعت را انتخاب کن"}
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
