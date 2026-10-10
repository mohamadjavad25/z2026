"use client";

import { Bookmark, CalendarCheck, Check, ChevronLeft, ChevronUp, Clock3, Heart, Info, Phone, Scissors, Share2 } from "lucide-react";
import { PublicProfileHeader } from "../../components/PublicProfileHeader";
import { ServicesDropUp } from "../../components/ServicesDropUp";
import { bundleServices } from "../../shared/lib/serviceBundle";
import { SheetClose } from "../../components/SheetClose";
import { formatTomanNumber, parseTomanAmount } from "../../shared/lib/money";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { DEFAULT_PERSON_AVATAR } from "../../shared/lib/defaultAvatar";
import { isPublicArtistSlotBlocked } from "./bookingUtils";
import { PublicArtistAboutPanel } from "./PublicArtistAboutPanel";
import { PublicArtistBookingPanel } from "./PublicArtistBookingPanel";
import { PublicArtistGalleryPanel } from "./PublicArtistGalleryPanel";
import { ProfileSheet } from "../profile/ProfileSheet";
import { useState } from "react";

// Same decorative cover the artist's own panel shows until a poster is uploaded.
const DEFAULT_COVER = "/artist-hero-doodle.webp";
// JS getDay(): 0 = Sunday ... 6 = Saturday; hours rows are keyed by the Persian weekday name.
const PERSIAN_WEEKDAYS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

export function PublicArtistModal({
  artist,
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
  const [servicesOpen, setServicesOpen] = useState(false);
  // Several services picked together: one service-shaped bundle (shared/lib/serviceBundle).
  const [bundle, setBundle] = useState(null);
  if (!artist) return null;

  const specialties = String(artist.service || "").split(/[،,]/).map((item) => item.trim()).filter(Boolean).slice(0, 4);
  const prices = (services || []).map((service) => parseTomanAmount(service.price)).filter(Boolean);
  const fromPrice = prices.length ? Math.min(...prices) : 0;
  // Today's working hours, worded like the salon page's chip.
  const weekHours = Array.isArray(artist.hours) ? artist.hours : [];
  const todayName = PERSIAN_WEEKDAYS[new Date().getDay()];
  const todayHours = weekHours.find((row) => row.day === todayName);
  const openStatus = weekHours.length
    ? (todayHours?.active
        ? { open: true, text: `امروز کار می‌کند • ${toPersianDigits(todayHours.open_time || "")} تا ${toPersianDigits(todayHours.close_time || "")}` }
        : { open: false, text: "امروز تعطیل است" })
    : null;

  return (
    <div
      className="artistPublicModal"
      role="dialog"
      aria-modal="true"
      aria-label={`پروفایل عمومی ${artist.name}`}
    >
      <article className="artistPublicSheet">
        <section className="artistPublicPage" aria-label={`صفحه عمومی ${artist.name}`}>
          <PublicProfileHeader
            cover={artist.poster || DEFAULT_COVER}
            coverAlt={artist.poster && artist.name ? `${artist.name} — تصویر کاور` : ""}
            coverPosition={artist.posterPosition || "50% 50%"}
            avatar={artist.avatar || DEFAULT_PERSON_AVATAR}
            avatarAlt={artist.name ? `تصویر پروفایل ${artist.name}` : "تصویر پروفایل آرتیست"}
            avatarPosition={artist.avatarPosition || "50% 50%"}
            name={artist.name}
            area={artist.area ? (String(artist.area).split("،")[0].replace(/^(شهر|روستای|دهستان)\s+/, "").trim() || String(artist.area).trim()) : ""}
            start={(
              <button type="button" className="pphRound" onClick={onClose} aria-label="بازگشت">
                <ChevronLeft size={19} />
              </button>
            )}
            end={(
              <>
                <button type="button" className="pphRound" aria-label="اشتراک‌گذاری" onClick={onShare}>
                  <Share2 size={18} />
                </button>
                <button
                  type="button"
                  className={`pphRound${saved ? " is-saved" : ""}`}
                  aria-label={saved ? "حذف از ذخیره‌ها" : "ذخیره پروفایل"}
                  aria-pressed={Boolean(saved)}
                  onClick={onSave}
                >
                  <Bookmark size={18} fill={saved ? "currentColor" : "none"} />
                </button>
              </>
            )}
          />

          <section className="pphInfo" aria-label={`معرفی ${artist.name || "آرتیست"}`}>
            {specialties.length || openStatus ? (
              <div className="pphChips">
                {specialties.map((item) => <span className="pphChip" key={item}>{item}</span>)}
                {openStatus ? (
                  <span className={`pphChip ${openStatus.open ? "is-open" : "is-closed"}`}>
                    <Clock3 size={14} /> {openStatus.text}
                  </span>
                ) : null}
              </div>
            ) : null}
            {artist.bio ? <p className="pphBio">{artist.bio}</p> : null}
            <div className="pphActions">
              <button type="button" className={`pphFollow${following ? " is-following" : ""}`} onClick={onFollow}>
                {following ? <Check size={18} /> : <Heart size={18} />}
                {following ? "دنبال می‌کنی" : "دنبال کردن"}
              </button>
              {artist.phone ? (
                <a className="pphCall" href={`tel:${toLatinDigits(artist.phone)}`} aria-label="تماس با آرتیست">
                  <Phone size={18} /> تماس
                </a>
              ) : null}
            </div>
          </section>

          <div className="artistPublicBody">
            <div className="artistPublicContent" key={view}>
              <>
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

            {/* Same weekly hours card the salon page shows under its posts. */}
            {weekHours.length ? (
              <section className="salonPublicCard spvHours">
                <div className="salonPublicSectionHead">
                  <span />
                  <h3>ساعت کاری</h3>
                </div>
                <ul>
                  {weekHours.map((row) => (
                    <li key={row.day} className={row.day === todayName ? "is-today" : ""}>
                      <b>{row.day}</b>
                      <span>{row.active ? `${toPersianDigits(row.open_time || "")} تا ${toPersianDigits(row.close_time || "")}` : "تعطیل"}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <ServicesDropUp
              open={servicesOpen}
              title={`خدمات ${artist.name || "آرتیست"}`}
              services={services}
              onConfirm={(picked) => {
                const service = bundleServices(picked);
                setServicesOpen(false);
                setBundle(service.items ? service : null);
                onSelectService(service.id, service);
                setBookingPopup(true);
              }}
              onClose={() => setServicesOpen(false)}
            />
            <nav className="spvBar" aria-label="رزرو و اطلاعات">
              <button type="button" className="spvBarIcon" onClick={() => setAboutPopup(true)} aria-label="درباره هنرمند" title="درباره هنرمند">
                <Info size={22} />
              </button>
              <button
                type="button"
                className="spvBarBook"
                onClick={() => setServicesOpen((open) => !open)}
                aria-expanded={servicesOpen}
                aria-haspopup="dialog"
              >
                <Scissors size={19} />
                خدمات
                {fromPrice ? <small>از {formatTomanNumber(fromPrice)} تومان</small> : null}
                <ChevronUp size={18} className={`spvBarChevron${servicesOpen ? " is-open" : ""}`} aria-hidden="true" />
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
                  services={bundle ? [bundle, ...services] : services}
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
                    برای ثبت نوبت باید وارد frfro شوی. بعد از ورود، رزرو را از پروفایل همین آرتیست ادامه بده.
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
                  {bookingBusy ? "در حال ثبت..." : bookingSlot ? (guest ? "ورود و ادامه رزرو" : `تایید رزرو • ${bookingDay} ${bookingSlot}`) : "ساعت را انتخاب کن"}
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
