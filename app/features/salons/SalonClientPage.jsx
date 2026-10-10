"use client";

import { DEFAULT_SALON_LOGO } from "../../shared/lib/defaultAvatar";
import { useState } from "react";
import {
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronUp,
  Clock3,
  Heart,
  ImagePlus,
  MapPin,
  Phone,
  Scissors,
  Share2,
  UserPlus,
  UserRound
} from "lucide-react";
import { PublicProfileHeader } from "../../components/PublicProfileHeader";
import { ServicesDropUp, serviceKey } from "../../components/ServicesDropUp";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { formatTomanNumber, parseTomanAmount } from "../../shared/lib/money";
import { SalonClientGallery } from "./SalonClientGallery";
import { SheetClose } from "../../components/SheetClose";

// Bug fix: this used to fall back to hardcoded fake services and a fake
// portfolio gallery (identical stock images) whenever a real salon had none
// configured, so every service-less/portfolio-less salon showed made-up
// content indistinguishable from real data. Now it always reflects the real
// data — the rail/sheet below render an honest "هنوز خدمتی ثبت نشده" /
// "هنوز نمونه‌کاری ثبت نشده" empty state instead (SalonClientGallery already
// had this for the portfolio mosaic; it was just being starved by the
// fallback array upstream).

// JS getDay(): 0 = Sunday ... 6 = Saturday; the salon's hours rows are keyed by the Persian weekday name.
const PERSIAN_WEEKDAYS = ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"];

// Same decorative cover the salon's own panel shows until a poster is uploaded.
const DEFAULT_COVER = "/artist-hero-doodle.webp";

/**
 * The salons tab: a salon's public page when one is selected, otherwise
 * `homeContent` (the client's «سالن و آرتیست من», see features/connect).
 */
export function SalonClientPage({
  active,
  selectedSalon,
  homeContent = null,
  isFollowing,
  isSaved,
  getVisibleServices,
  getPortfolioCardStyle,
  onBack,
  onFollow,
  onSave,
  onShare,
  postActions = null,
  onOpenBooking
}) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [publicSheet, setPublicSheet] = useState("");
  const [servicesOpen, setServicesOpen] = useState(false);
  const [pickedService, setPickedService] = useState("");
  const services = selectedSalon ? getVisibleServices(selectedSalon) : [];
  const portfolioItems = Array.isArray(selectedSalon?.portfolio) ? selectedSalon.portfolio : [];
  const followerCountValue = Number(selectedSalon?.followerCount ?? selectedSalon?.follower_count ?? 0) || 0;
  const followerCount = toPersianDigits(followerCountValue);
  const staffCount = selectedSalon?.staff?.length || 0;
  const publicName = selectedSalon?.name || "سالن";
  const publicTag = selectedSalon?.tag || "سالن";
  const managerName = selectedSalon?.managerName || selectedSalon?.manager_name || selectedSalon?.ownerName || selectedSalon?.owner_name || "مدیر سالن";
  const teamNames = (selectedSalon?.staff || [])
    .map((member) => member?.name || member?.fullName || member?.artist_name)
    .filter(Boolean)
    .slice(0, 3);
  const specialtyNames = services.slice(0, 4).map((service) => service.name).filter(Boolean);
  const teamMembers = (selectedSalon?.staff || []).filter((member) => member && (member.artist_name || member.name)).slice(0, 12);
  const weekHours = Array.isArray(selectedSalon?.hours) ? selectedSalon.hours : [];
  const todayName = PERSIAN_WEEKDAYS[new Date().getDay()];
  const todayHours = weekHours.find((row) => row.day === todayName);
  const openStatus = weekHours.length
    ? (todayHours?.active
        ? { open: true, text: `امروز باز است • ${toPersianDigits(todayHours.open_time || "")} تا ${toPersianDigits(todayHours.close_time || "")}` }
        : { open: false, text: "امروز تعطیل است" })
    : null;
  const prices = services.map((service) => parseTomanAmount(service.price)).filter(Boolean);
  const minPrice = prices.length ? Math.min(...prices) : 0;

  return (
    <div className={`salonPanel mobilePage page-salons ${active ? "is-active" : ""}`} id="salons">
      {active && selectedSalon ? (
        <section
          className="salonClientPage salonPublicProfile"
          aria-label={`صفحه مشتری ${selectedSalon.name}`}
        >
          <PublicProfileHeader
            cover={selectedSalon.poster || DEFAULT_COVER}
            coverPosition={selectedSalon.posterPosition || "50% 50%"}
            avatar={selectedSalon.avatar || DEFAULT_SALON_LOGO}
            avatarAlt={`لوگوی ${publicName}`}
            avatarPosition={selectedSalon.avatarPosition || "50% 50%"}
            name={publicName}
            area={selectedSalon.area}
            start={(
              <button type="button" className="pphRound" onClick={onBack} aria-label="بازگشت به سالن‌ها">
                <ChevronLeft size={19} />
              </button>
            )}
            end={(
              <button type="button" className="pphRound" onClick={() => onShare(selectedSalon.name)} aria-label="اشتراک‌گذاری">
                <Share2 size={18} />
              </button>
            )}
          />

          <section className="pphInfo" aria-label={`معرفی ${publicName}`}>
            <div className="pphChips">
              <span className="pphChip">{publicTag}</span>
              {openStatus ? (
                <span className={`pphChip ${openStatus.open ? "is-open" : "is-closed"}`}>
                  <Clock3 size={14} /> {openStatus.text}
                </span>
              ) : null}
            </div>
            <div className="pphActions">
              <button type="button" className={`pphFollow${isFollowing ? " is-following" : ""}`} onClick={() => onFollow(selectedSalon)}>
                {isFollowing ? <Check size={18} /> : <UserPlus size={18} />}
                {isFollowing ? "دنبال می‌کنی" : "دنبال کردن"}
              </button>
              {selectedSalon.phone ? (
                <a className="pphCall" href={`tel:${toLatinDigits(selectedSalon.phone)}`} aria-label="تماس با سالن">
                  <Phone size={18} /> تماس
                </a>
              ) : null}
            </div>
          </section>

          {teamMembers.length ? (
            <section className="salonPublicCard spvTeam">
              <div className="salonPublicSectionHead">
                <span />
                <h3>تیم سالن</h3>
              </div>
              <div className="spvTeamRail">
                {teamMembers.map((member) => (
                  <div className="spvMember" key={member.id || member.name}>
                    <img src={member.avatar || member.staff_avatar || "/profile-icon.svg"} alt="" loading="lazy" decoding="async" />
                    <b>{member.artist_name || member.name}</b>
                    <small>{String(member.role || member.artist_service || "آرتیست").split(/[،,]/)[0]}</small>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {portfolioItems.length ? (
          <section className="salonPublicCard salonPublicPortfolio">
            <div className="salonPublicSectionHead">
              {portfolioItems.length > 5 ? <button type="button" onClick={() => setPublicSheet("portfolio")}>مشاهده همه</button> : <span />}
              <h3>نمونه‌کارها</h3>
            </div>
            <SalonClientGallery
              salon={selectedSalon}
              items={portfolioItems.slice(0, 5)}
              allItems={portfolioItems}
              getFallbackStyle={getPortfolioCardStyle}
              postActions={postActions}
            />
          </section>
          ) : null}

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
            title={`خدمات ${publicName}`}
            services={services}
            selectedKey={pickedService}
            onSelect={(service) => setPickedService(service ? serviceKey(service) : "")}
            onConfirm={(service) => {
              setServicesOpen(false);
              onOpenBooking(service.name);
            }}
            onClose={() => setServicesOpen(false)}
          />
          <nav className="spvBar" aria-label="رزرو و ذخیره">
            <button type="button" className={`spvBarIcon ${isSaved ? "is-on" : ""}`} onClick={() => onSave(selectedSalon)} aria-label={isSaved ? "حذف از ذخیره‌شده‌ها" : "ذخیره سالن"} aria-pressed={isSaved}>
              <Heart size={22} fill={isSaved ? "currentColor" : "none"} />
            </button>
            <button type="button" className="spvBarIcon" onClick={() => setAboutOpen(true)} aria-label="درباره سالن">
              <UserRound size={22} />
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
              {minPrice ? <small>از {formatTomanNumber(minPrice)} تومان</small> : null}
              <ChevronUp size={18} className={`spvBarChevron${servicesOpen ? " is-open" : ""}`} aria-hidden="true" />
            </button>
          </nav>
          {aboutOpen ? (
            <div className="salonPublicAboutOverlay" role="dialog" aria-modal="true" aria-label="درباره سالن" onClick={() => setAboutOpen(false)}>
              <article className="salonPublicAboutSheet" onClick={(event) => event.stopPropagation()}>
                <div className="salonPublicAboutHead">
                  <img
                    src={selectedSalon.avatar || DEFAULT_SALON_LOGO}
                    alt=""
                    aria-hidden="true"
                    style={{ objectPosition: selectedSalon.avatarPosition || "50% 50%" }}
                  />
                  <div>
                    <span>درباره سالن</span>
                    <h3>{publicName}</h3>
                    <small>{publicTag}</small>
                  </div>
                </div>
                <p className="salonPublicAboutBio">
                  {selectedSalon.bio || "این سالن هنوز توضیحی درباره خودش ثبت نکرده است."}
                </p>
                {selectedSalon.rules ? (
                  <section className="salonPublicAboutBlock salonPublicAboutRules">
                    <h4>قوانین و شرایط سالن</h4>
                    <p>{selectedSalon.rules}</p>
                  </section>
                ) : null}
                <section className="salonPublicAboutBlock">
                  <h4>مدیر و تیم سالن</h4>
                  <div className="salonPublicAboutList">
                    <span><UserRound size={16} /> مدیریت: {managerName}</span>
                    <span><UserPlus size={16} /> تیم: {teamNames.length ? teamNames.join("، ") : "هنوز عضو تیمی ثبت نشده"}</span>
                  </div>
                </section>
                <section className="salonPublicAboutBlock">
                  <h4>تخصص‌ها</h4>
                  <div className="salonPublicAboutChips">
                    {specialtyNames.length ? (
                      specialtyNames.map((item) => <span key={item}>{item}</span>)
                    ) : (
                      <span>هنوز تخصصی ثبت نشده</span>
                    )}
                  </div>
                </section>
                <div className="salonPublicAboutFacts">
                  <span><UserRound size={16} /> {toPersianDigits(staffCount)} عضو تیم</span>
                  <span><Heart size={16} /> {followerCount} دنبال‌کننده</span>
                </div>
                <div className="salonPublicAboutContact">
                  <span><MapPin size={17} /> {selectedSalon.area || "آدرس ثبت نشده"}</span>
                  <span><Clock3 size={17} /> {selectedSalon.open || "ساعت کاری ثبت نشده"}</span>
                  <span><Phone size={17} /> {selectedSalon.phone ? <span dir="ltr">{toPersianDigits(selectedSalon.phone)}</span> : "شماره تماس ثبت نشده"}</span>
                </div>
                <section className="salonPublicAboutBlock">
                  <h4>قوانین رزرو و لغو</h4>
                  <div className="salonPublicAboutList">
                    <span><CalendarCheck size={16} /> تغییر زمان رزرو با هماهنگی سالن انجام می‌شود</span>
                    <span><Clock3 size={16} /> در صورت تاخیر، زمان خدمات بر اساس ظرفیت روز تنظیم می‌شود</span>
                  </div>
                </section>
                <SheetClose onClick={() => setAboutOpen(false)} />
              </article>
            </div>
          ) : null}
          {publicSheet ? (
            <div className="salonPublicBrowseOverlay" role="dialog" aria-modal="true" aria-label="همه نمونه‌کارها" onClick={() => setPublicSheet("")}>
              <article className={`salonPublicBrowseSheet is-${publicSheet}`} onClick={(event) => event.stopPropagation()}>
                <div className="salonPublicBrowseHead">
                  <span>گالری سالن</span>
                  <h3>همه نمونه‌کارها</h3>
                </div>
                {portfolioItems.length ? (
                  <div className="salonPublicAllPortfolio">
                    {portfolioItems.map((item) => (
                      <figure key={item.id || item.title}>
                        {item.image ? <img src={item.image} alt={item.title || "نمونه کار سالن"} loading="lazy" decoding="async" /> : <span style={getPortfolioCardStyle(item)} />}
                        <figcaption>{item.title || "نمونه‌کار"}</figcaption>
                      </figure>
                    ))}
                  </div>
                ) : (
                  <div className="salonClientEmptyGallery">
                    <ImagePlus size={22} />
                    <b>هنوز نمونه‌کاری ثبت نشده</b>
                  </div>
                )}
                <SheetClose onClick={() => setPublicSheet("")} />
              </article>
            </div>
          ) : null}
        </section>
      ) : (
        homeContent
      )}
    </div>
  );
}
