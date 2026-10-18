"use client";

import { Bookmark, CalendarCheck, Check, ChevronLeft, ChevronUp, Clock3, Heart, Phone, Scissors, Share2 } from "lucide-react";
import { PublicProfileHeader } from "../../components/PublicProfileHeader";
import { BookingPausedNote } from "../../components/BookingPausedNote";
import { ServicesDropUp } from "../../components/ServicesDropUp";
import { WeeklyHours } from "../../components/WeeklyHours";
import { bundleServices } from "../../shared/lib/serviceBundle";
import { formatTomanNumber, parseTomanAmount } from "../../shared/lib/money";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { DEFAULT_PERSON_AVATAR } from "../../shared/lib/defaultAvatar";
import { isPublicArtistSlotBlocked } from "./bookingUtils";
import { PublicArtistBookingPanel } from "./PublicArtistBookingPanel";
import { PublicArtistGalleryPanel } from "./PublicArtistGalleryPanel";
import { ProfileSheet } from "../profile/ProfileSheet";
import { WaitChoice } from "../booking/WaitChoice";
import { BOOKING_WAIT_CHOICES } from "../../shared/lib/bookingWindow";
import { getArtistFallbacks } from "../../shared/api/artists";
import { useEffect, useState } from "react";

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
  // How long the request waits for the artist: until the appointment (default) or an hour.
  const [wait, setWait] = useState("open");
  const [servicesOpen, setServicesOpen] = useState(false);
  // Several services picked together: one service-shaped bundle (shared/lib/serviceBundle).
  const [bundle, setBundle] = useState(null);
  // Opened from a category on «سالن و آرتیست من»: show the services menu as soon as the services have loaded.
  const focus = artist?.focusServices || null;
  const hasServices = Array.isArray(services) && services.length > 0;
  useEffect(() => {
    if (focus && hasServices) setServicesOpen(true);
  }, [focus, hasServices]);
  // With the hour: artists the client follows who do the same service and are free then (backups).
  const [backups, setBackups] = useState([]);
  const [backup, setBackup] = useState("");
  const pickedService = (bundle && bundle.id === selectedServiceId ? bundle : (services || []).find((item) => item.id === selectedServiceId)) || (services || [])[0];
  const pickedName = pickedService?.name || "";
  useEffect(() => {
    let live = true;
    if (wait !== "hour" || guest || !artist?.id || !bookingSlot || !pickedName) {
      setBackups([]);
      return undefined;
    }
    getArtistFallbacks(artist.id, pickedName, bookingDay, bookingSlot)
      .then(({ ok, data }) => {
        if (!live) return;
        const found = ok && Array.isArray(data?.artists) ? data.artists : [];
        setBackups(found);
        setBackup((current) => (found.some((item) => String(item.id) === current) ? current : ""));
      })
      .catch(() => { if (live) setBackups([]); });
    return () => { live = false; };
  }, [wait, guest, artist?.id, pickedName, bookingDay, bookingSlot]);
  if (!artist) return null;

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
            variant="artist"
            cover={artist.poster || DEFAULT_COVER}
            coverAlt={artist.poster && artist.name ? `${artist.name} — تصویر کاور` : ""}
            coverPosition={artist.posterPosition || "50% 50%"}
            avatar={artist.avatar || DEFAULT_PERSON_AVATAR}
            avatarAlt={artist.name ? `تصویر پروفایل ${artist.name}` : "تصویر پروفایل آرتیست"}
            avatarPosition={artist.avatarPosition || "50% 50%"}
            name={artist.name}
            location={artist.location}
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
            {openStatus ? (
              <div className="pphChips">
                {openStatus ? (
                  <span className={`pphChip ${openStatus.open ? "is-open" : "is-closed"}`}>
                    <Clock3 size={14} /> {openStatus.text}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div className="pphActions">
              <button type="button" className={`pphFollow${following ? " is-following" : ""}`} onClick={onFollow}>
                {following ? <Check size={18} /> : <Heart size={18} />}
                {following ? "وصل هستی" : "وصل شو"}
              </button>
              {artist.phone ? (
                <a className="pphCall" href={`tel:${toLatinDigits(artist.phone)}`} aria-label="تماس با آرتیست">
                  <Phone size={18} /> تماس
                </a>
              ) : null}
            </div>
            {artist.onlineBookingPaused ? <BookingPausedNote hasPhone={Boolean(artist.phone)} /> : null}
          </section>

          <div className={`artistPublicBody${servicesOpen ? " is-servicesOpen" : ""}`}>
            {/* Hours sit above the posts so a long gallery never buries them. */}
            <WeeklyHours rows={weekHours} todayName={todayName} />

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

            <ServicesDropUp
              open={servicesOpen}
              title={`خدمات ${artist.name || "آرتیست"}`}
              services={services}
              focusNames={focus?.names}
              focusLabel={focus?.label ? `مناسب «${focus.label}»` : ""}
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
              <button
                type="button"
                className={`spvBarBook${servicesOpen ? " is-open" : ""}`}
                onClick={() => setServicesOpen((open) => !open)}
                aria-expanded={servicesOpen}
                aria-haspopup="dialog"
              >
                <Scissors size={19} />
                {servicesOpen ? "بستن" : "خدمات"}
                {fromPrice && !servicesOpen ? <small>از {formatTomanNumber(fromPrice)} تومان</small> : null}
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
                {bookingSlot && !guest ? (
                  <WaitChoice value={wait} onChange={setWait} who="آرتیست" backups={backups} backup={backup} onBackup={setBackup} />
                ) : null}
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
                    const backupArtist = wait === "hour" && backup ? backups.find((item) => String(item.id) === backup) : null;
                    onConfirmBooking({
                      waitMinutes: BOOKING_WAIT_CHOICES[wait],
                      ...(backupArtist ? { fallbackArtistUserId: backupArtist.id, fallbackName: backupArtist.name } : {})
                    });
                    setBookingPopup(false);
                  }}
                >
                  <CalendarCheck size={17} />
                  {bookingBusy ? "در حال ثبت..." : bookingSlot ? (guest ? "ورود و ادامه رزرو" : `تایید رزرو • ${bookingDay} ${bookingSlot}`) : "ساعت را انتخاب کن"}
                </button>
          </ProfileSheet>

        </section>
      </article>
    </div>
  );
}
