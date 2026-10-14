"use client";

import { DEFAULT_SALON_LOGO } from "../../shared/lib/defaultAvatar";
import { useState, useEffect } from "react";
import {
  Bookmark,
  Check,
  ChevronLeft,
  ChevronUp,
  Clock3,
  ImagePlus,
  Phone,
  Scissors,
  Share2,
  UserPlus
} from "lucide-react";
import { PublicProfileHeader } from "../../components/PublicProfileHeader";
import { ServicesDropUp } from "../../components/ServicesDropUp";
import { bundleServices } from "../../shared/lib/serviceBundle";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { formatTomanNumber, parseTomanAmount } from "../../shared/lib/money";
import { SalonClientGallery } from "./SalonClientGallery";
import { SheetClose } from "../../components/SheetClose";
import { WeeklyHours } from "../../components/WeeklyHours";

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

// Posts shown on the page itself; the rest sit behind «مشاهده همه».
const PORTFOLIO_PREVIEW = 6;

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
  const [publicSheet, setPublicSheet] = useState("");
  const [servicesOpen, setServicesOpen] = useState(false);
  const services = selectedSalon ? getVisibleServices(selectedSalon) : [];
  // Opened from a category on «سالن و آرتیست من»: show the services menu as soon as the services have loaded.
  const focus = selectedSalon?.focusServices || null;
  const hasServices = services.length > 0;
  useEffect(() => {
    if (focus && hasServices) setServicesOpen(true);
  }, [focus, hasServices]);
  const portfolioItems = Array.isArray(selectedSalon?.portfolio) ? selectedSalon.portfolio : [];
  const publicName = selectedSalon?.name || "سالن";
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
              <>
                <button type="button" className="pphRound" onClick={() => onShare(selectedSalon.name)} aria-label="اشتراک‌گذاری">
                  <Share2 size={18} />
                </button>
                <button
                  type="button"
                  className={`pphRound${isSaved ? " is-saved" : ""}`}
                  aria-label={isSaved ? "حذف از ذخیره‌ها" : "ذخیره سالن"}
                  aria-pressed={Boolean(isSaved)}
                  onClick={() => onSave(selectedSalon)}
                >
                  <Bookmark size={18} fill={isSaved ? "currentColor" : "none"} />
                </button>
              </>
            )}
          />

          <section className="pphInfo" aria-label={`معرفی ${publicName}`}>
            {openStatus ? (
              <div className="pphChips">
                <span className={`pphChip ${openStatus.open ? "is-open" : "is-closed"}`}>
                  <Clock3 size={14} /> {openStatus.text}
                </span>
              </div>
            ) : null}
            {selectedSalon.bio ? (
              <p className="pphBio">{selectedSalon.bio}</p>
            ) : null}
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

          <WeeklyHours rows={weekHours} todayName={todayName} />

          {teamMembers.length ? (
            <section className="spvSection spvTeam" aria-label="تیم سالن">
              <h3 className="spvHead">تیم سالن</h3>
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
          <section className="spvSection salonPublicPortfolio" aria-label="نمونه‌کارها">
            <div className="spvHeadRow">
              <h3 className="spvHead">نمونه‌کارها</h3>
              {portfolioItems.length > PORTFOLIO_PREVIEW ? (
                <button type="button" className="spvSeeAll" onClick={() => setPublicSheet("portfolio")}>
                  مشاهده همه ({toPersianDigits(portfolioItems.length)})
                </button>
              ) : null}
            </div>
            <SalonClientGallery
              salon={selectedSalon}
              items={portfolioItems.slice(0, PORTFOLIO_PREVIEW)}
              allItems={portfolioItems}
              getFallbackStyle={getPortfolioCardStyle}
              postActions={postActions}
            />
          </section>
          ) : null}

          <ServicesDropUp
            open={servicesOpen}
            title={`خدمات ${publicName}`}
            services={services}
            focusNames={focus?.names}
            focusLabel={focus?.label ? `مناسب «${focus.label}»` : ""}
            onConfirm={(picked) => {
              setServicesOpen(false);
              onOpenBooking(bundleServices(picked));
            }}
            onClose={() => setServicesOpen(false)}
          />
          <nav className="spvBar" aria-label="رزرو و ذخیره">
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
