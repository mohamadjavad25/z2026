"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  CalendarCheck,
  Check,
  ChevronLeft,
  Clock3,
  Home,
  Heart,
  ImagePlus,
  MapPin,
  Palette,
  Phone,
  Plus,
  Scissors,
  Search,
  ShieldCheck,
  Share2,
  Sparkles,
  Star,
  Store,
  UserPlus,
  UserRound,
  WandSparkles,
  X
} from "lucide-react";
import { SegmentClock } from "../../components/SegmentClock";
import { MarbleRatingStars } from "../../components/MarbleRatingStars";
import { toPersianDigits } from "../../shared/lib/digits";
import { SalonClientGallery } from "./SalonClientGallery";
import { PublicStoryBanner, usePublicStory } from "../../components/PublicStoryBanner";

// Bug fix: this used to fall back to hardcoded fake services and a fake
// portfolio gallery (identical stock images) whenever a real salon had none
// configured, so every service-less/portfolio-less salon showed made-up
// content indistinguishable from real data. Now it always reflects the real
// data — the rail/sheet below render an honest "هنوز خدمتی ثبت نشده" /
// "هنوز نمونه‌کاری ثبت نشده" empty state instead (SalonClientGallery already
// had this for the portfolio mosaic; it was just being starved by the
// fallback array upstream).
function getServiceIcon(service, index) {
  const key = String(service.icon || service.badge || service.name || "").toLowerCase();
  if (key.includes("کوتاه") || key.includes("scissor")) return <Scissors size={21} />;
  if (key.includes("رنگ") || key.includes("color") || key.includes("palette")) return <Palette size={21} />;
  if (key.includes("کرات") || key.includes("care")) return <ShieldCheck size={21} />;
  if (key.includes("میکاپ") || key.includes("makeup")) return <WandSparkles size={21} />;
  if (key.includes("های") || key.includes("spark")) return <Sparkles size={21} />;
  return index % 2 ? <UserRound size={21} /> : <Scissors size={21} />;
}

function getPrimaryBookingService(services) {
  return services[0]?.name || "رزرو وقت";
}

export function SalonClientPage({
  active,
  selectedSalon,
  salons,
  reviews,
  isFollowing,
  isSaved,
  getVisibleServices,
  getPortfolioCardStyle,
  onBack,
  onFollow,
  onSave,
  onShare,
  onOpenBooking,
  onSelectSalon
}) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [publicSheet, setPublicSheet] = useState("");
  const [salonQuery, setSalonQuery] = useState("");
  const normalizedSalonQuery = salonQuery.trim();
  const visibleSalons = normalizedSalonQuery
    ? salons.filter((salon) =>
        [salon.name, salon.area, salon.tag]
          .filter(Boolean)
          .some((field) => field.includes(normalizedSalonQuery))
      )
    : salons;
  const services = selectedSalon ? getVisibleServices(selectedSalon) : [];
  const portfolioItems = Array.isArray(selectedSalon?.portfolio) ? selectedSalon.portfolio : [];
  const ratingValue = Number(selectedSalon?.rating);
  const rating = Number.isFinite(ratingValue) && ratingValue > 0 ? toPersianDigits(ratingValue.toFixed(1)) : null;
  const followerCountValue = Number(selectedSalon?.followerCount ?? selectedSalon?.follower_count ?? 0) || 0;
  const followerCount = toPersianDigits(followerCountValue);
  const staffCount = selectedSalon?.staff?.length || 0;
  const publicName = selectedSalon?.name || "سالن";
  const publicTag = selectedSalon?.tag || "سالن زیبایی";
  const managerName = selectedSalon?.managerName || selectedSalon?.manager_name || selectedSalon?.ownerName || selectedSalon?.owner_name || "مدیر سالن";
  const teamNames = (selectedSalon?.staff || [])
    .map((member) => member?.name || member?.fullName || member?.artist_name)
    .filter(Boolean)
    .slice(0, 3);
  const specialtyNames = services.slice(0, 4).map((service) => service.name).filter(Boolean);
  const storyVideoSrc = selectedSalon?.storyVideo || selectedSalon?.story_video || selectedSalon?.introVideo || selectedSalon?.intro_video || "";
  const realStoryPosterSrc = selectedSalon?.storyPoster || selectedSalon?.story_poster || selectedSalon?.introPoster || selectedSalon?.intro_poster || "";
  const storyPosterSrc = realStoryPosterSrc || "/salon-public-hero.png";
  const story = usePublicStory({ storyVideoSrc, storyPosterSrc });
  // Only describe the hero image to crawlers/screen readers when it's a real
  // uploaded photo — the generic fallback illustration stays decorative
  // (empty alt) so it doesn't get indexed as if it were the salon's photo.
  const heroAlt = realStoryPosterSrc ? `${publicName} — تصویر کاور` : "";

  return (
    <div className={`salonPanel mobilePage page-salons ${active ? "is-active" : ""}`} id="salons">
      {active && selectedSalon ? (
        <section
          className={`salonClientPage salonPublicProfile ${story.storyStateClasses}`}
          aria-label={`صفحه مشتری ${selectedSalon.name}`}
        >
          <PublicStoryBanner
            story={story}
            heroClassName="salonPublicHero"
            heroImage={storyPosterSrc}
            heroAlt={heroAlt}
            topbar={(
              <>
                <div className="salonPublicTopbar">
                  <button type="button" className="salonPublicRoundButton salonPublicBackButton" onClick={onBack} aria-label="بازگشت به سالن‌ها">
                    <ChevronLeft size={20} />
                  </button>
                  <button
                    type="button"
                    className="salonPublicRoundButton salonPublicMenuButton"
                    onClick={() => onShare(selectedSalon.name)}
                    aria-label="اشتراک‌گذاری"
                  >
                    <Share2 size={20} />
                  </button>
                </div>
                              </>
            )}
            emptyTitle="استوری معرفی هنوز آماده نیست"
            emptyText="وقتی سالن ویدیوی معرفی اضافه کند، همین‌جا مثل یک استوری پخش می‌شود."
          />

          <section className="salonPublicIdentityCard">
            <div
              className="salonPublicLogoSlot publicStoryLogo"
              role={story.logoHandlers.role}
              tabIndex={story.logoHandlers.tabIndex}
              aria-label="کشیدن لوگو برای نمایش ویدیوی معرفی سالن"
              onPointerDown={story.logoHandlers.onPointerDown}
              onPointerMove={story.logoHandlers.onPointerMove}
              onPointerUp={story.logoHandlers.onPointerUp}
              onPointerCancel={story.logoHandlers.onPointerCancel}
              onClick={story.logoHandlers.onClick}
              onDoubleClick={story.logoHandlers.onDoubleClick}
              onKeyDown={story.logoHandlers.onKeyDown}
            >
              <div className="profileHero is-salon salonPublicAvatarHost">
                <div className="salonHeroAvatarFrame">
                  <img
                    className="profileAvatarImage"
                    src={selectedSalon.avatar || "/profile-icon.svg"}
                    alt=""
                    aria-hidden="true"
                  />
                </div>
              </div>
            </div>
            <div className="salonPublicTitle">
              <h2>
                {publicName}
                <BadgeCheck className="salonPublicVerifiedIcon" size={18} />
              </h2>
              <span>{publicTag}</span>
            </div>
            <div className="salonPublicRatingCard">
              <span>
                {rating ? `${rating} امتیاز` : "بدون امتیاز"}
                <Star size={15} fill="currentColor" />
              </span>
              <small>{reviews.length ? `(${toPersianDigits(reviews.length)} نظر)` : "بدون نظر ثبت‌شده"}</small>
            </div>
            <div className="salonPublicStats">
              <span><UserRound size={17} /> {toPersianDigits(staffCount)} سال سابقه</span>
              <span><Heart size={17} /> {followerCount} دنبال‌کننده</span>
            </div>
            <div className="salonPublicActions">
              <button
                type="button"
                className={isFollowing ? "is-following" : ""}
                onClick={() => onFollow(selectedSalon)}
              >
                {isFollowing ? <Check size={18} /> : <UserPlus size={18} />}
                {isFollowing ? "دنبال می‌کنی" : "دنبال کردن"}
              </button>
            </div>
          </section>

          <section className="salonPublicCard salonPublicServices">
            <div className="salonPublicSectionHead">
              <button type="button" onClick={() => setPublicSheet("services")}>مشاهده همه</button>
              <h3>خدمات</h3>
            </div>
            {services.length ? (
              <div className="salonPublicServiceRail">
                {services.map((service, index) => (
                  <button
                    type="button"
                    key={service.id || service.name}
                    onClick={() => onOpenBooking(service.name)}
                  >
                    <span>{getServiceIcon(service, index)}</span>
                    <b>{service.name}</b>
                  </button>
                ))}
              </div>
            ) : (
              <div className="salonClientEmptyGallery">
                <Scissors size={22} />
                <b>هنوز خدمتی ثبت نشده</b>
              </div>
            )}
          </section>

          <section className="salonPublicCard salonPublicPortfolio">
            <div className="salonPublicSectionHead">
              <button type="button" onClick={() => setPublicSheet("portfolio")}>مشاهده همه</button>
              <h3>نمونه‌کارها</h3>
            </div>
            <SalonClientGallery
              salon={selectedSalon}
              items={portfolioItems.slice(0, 5)}
              getFallbackStyle={getPortfolioCardStyle}
            />
  
          </section>

          <nav className="salonPublicBottomDock" aria-label="ناوبری صفحه سالن">
            <button type="button" className={aboutOpen ? "is-active" : ""} onClick={() => setAboutOpen(true)} aria-label="درباره سالن">
              <UserRound size={23} />
            </button>
            <button type="button" className={isSaved ? "is-active" : ""} onClick={() => onSave(selectedSalon)}>
              <Heart size={23} fill={isSaved ? "currentColor" : "none"} />
            </button>
            <button type="button" className="is-primary" onClick={() => onOpenBooking(getPrimaryBookingService(services))}>
              <Plus size={30} />
            </button>
            <button type="button" className="is-active" onClick={onBack} aria-label="بازگشت به سالن‌ها">
              <Home size={23} />
            </button>
          </nav>
          {aboutOpen ? (
            <div className="salonPublicAboutOverlay" role="dialog" aria-modal="true" aria-label="درباره سالن" onClick={() => setAboutOpen(false)}>
              <article className="salonPublicAboutSheet" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="salonPublicAboutClose" onClick={() => setAboutOpen(false)} aria-label="بستن">
                  <X size={18} />
                </button>
                <div className="salonPublicAboutHead">
                  <img src={selectedSalon.avatar || "/profile-icon.svg"} alt="" aria-hidden="true" />
                  <div>
                    <span>درباره سالن</span>
                    <h3>{publicName}</h3>
                    <small>{publicTag}</small>
                  </div>
                </div>
                <p className="salonPublicAboutBio">
                  {selectedSalon.bio || "این سالن هنوز توضیحی درباره خودش ثبت نکرده است."}
                </p>
                <section className="salonPublicAboutBlock">
                  <h4>مدیر و تیم سالن</h4>
                  <div className="salonPublicAboutList">
                    <span><UserRound size={16} /> مدیریت: {managerName}</span>
                    <span><UserPlus size={16} /> تیم: {teamNames.length ? teamNames.join("، ") : "هنوز عضو تیمی ثبت نشده"}</span>
                  </div>
                </section>
                <section className="salonPublicAboutBlock">
                  <h4>تخصص‌ها و سابقه</h4>
                  <div className="salonPublicAboutChips">
                    {specialtyNames.length ? (
                      specialtyNames.map((item) => <span key={item}>{item}</span>)
                    ) : (
                      <span>هنوز تخصصی ثبت نشده</span>
                    )}
                  </div>
                </section>
                <div className="salonPublicAboutFacts">
                  <span><UserRound size={16} /> {toPersianDigits(staffCount)} سال سابقه</span>
                  <span><Heart size={16} /> {followerCount} دنبال‌کننده</span>
                  <span><Star size={16} fill="currentColor" /> {rating ? `${rating} امتیاز` : "بدون امتیاز"}</span>
                  <span><ShieldCheck size={16} /> پروفایل تایید شده</span>
                </div>
                <section className="salonPublicAboutBlock">
                  <h4>مجوزها و اعتماد</h4>
                  <div className="salonPublicAboutList">
                    <span><ShieldCheck size={16} /> اطلاعات سالن تایید شده</span>
                    <span><BadgeCheck size={16} /> نمونه‌کارها و امتیازها قابل بررسی هستند</span>
                  </div>
                </section>
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
              </article>
            </div>
          ) : null}
          {publicSheet ? (
            <div className="salonPublicBrowseOverlay" role="dialog" aria-modal="true" aria-label={publicSheet === "services" ? "همه خدمات" : "همه نمونه‌کارها"} onClick={() => setPublicSheet("")}>
              <article className={`salonPublicBrowseSheet is-${publicSheet}`} onClick={(event) => event.stopPropagation()}>
                <button type="button" className="salonPublicAboutClose" onClick={() => setPublicSheet("")} aria-label="بستن">
                  <X size={18} />
                </button>
                <div className="salonPublicBrowseHead">
                  <span>{publicSheet === "services" ? "لیست خدمات" : "گالری سالن"}</span>
                  <h3>{publicSheet === "services" ? "همه خدمات سالن" : "همه نمونه‌کارها"}</h3>
                </div>
                {publicSheet === "services" ? (
                  services.length ? (
                    <div className="salonPublicAllServices">
                      {services.map((service, index) => (
                        <button
                          type="button"
                          key={service.id || service.name}
                          onClick={() => {
                            setPublicSheet("");
                            onOpenBooking(service.name);
                          }}
                        >
                          <span>{getServiceIcon(service, index)}</span>
                          <b>{service.name}</b>
                          <small>{service.price ? `${toPersianDigits(service.price)} تومان` : "قیمت توافقی"} · {service.duration || "زمان متغیر"}</small>
                          <CalendarCheck size={17} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="salonClientEmptyGallery">
                      <Scissors size={22} />
                      <b>هنوز خدمتی ثبت نشده</b>
                    </div>
                  )
                ) : portfolioItems.length ? (
                  <div className="salonPublicAllPortfolio">
                    {portfolioItems.map((item) => (
                      <figure key={item.id || item.title}>
                        {item.image ? <img src={item.image} alt={item.title || "نمونه کار سالن"} /> : <span style={getPortfolioCardStyle(item)} />}
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
              </article>
            </div>
          ) : null}
        </section>
      ) : (
        <>
          <div className="salonPromoHeader">
            <div className="salonPromoHeaderIcon">
              <Sparkles size={22} />
            </div>
            <div className="salonPromoHeaderBody">
              <b>بهترین سالن‌های زیبایی شهر، آماده‌ی رزرو</b>
              <span>سالن مورد علاقه‌ت رو پیدا کن و در چند ثانیه وقت بگیر.</span>
            </div>
          </div>
          <label className="salonSearchBar">
            <Search size={16} />
            <input
              type="search"
              value={salonQuery}
              onChange={(event) => setSalonQuery(event.target.value)}
              placeholder="جستجوی سالن یا محدوده..."
              aria-label="جستجوی سالن"
            />
          </label>
          <div className="salonList">
          {visibleSalons.length ? visibleSalons.map((salon) => {
            const serviceCount = getVisibleServices(salon).length;
            const localStaffCount = salon.staff?.length || 0;
            return (
              <article
                className="salonRow"
                key={salon.id || salon.name}
                role="button"
                tabIndex={0}
                onClick={() => onSelectSalon(salon)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectSalon(salon);
                  }
                }}
              >
                <div className="salonCardMain">
                  <div className="salonCardHead">
                    <div className={`salonIcon ${salon.avatar ? "hasImage" : ""}`} aria-hidden="true">
                      {salon.avatar ? <img src={salon.avatar} alt="" /> : <Store size={21} />}
                    </div>
                    <div>
                      <h3>{salon.name}</h3>
                      {[salon.area, salon.tag].filter(Boolean).length > 0 && (
                        <p><MapPin size={12} /> {[salon.area, salon.tag].filter(Boolean).join(" · ")}</p>
                      )}
                    </div>
                  </div>
                  <div className="salonCardStats" aria-label="اطلاعات سالن">
                    {salon.rating ? (
                      <span>
                        <MarbleRatingStars count={1} className="inlineRatingStars" label={`امتیاز ${salon.rating}`} />
                        <b>{toPersianDigits(salon.rating)}</b>
                      </span>
                    ) : (
                      <span className="salonNewTag">جدید</span>
                    )}
                    {(salon.post_count || salon.portfolio?.length || 0) > 0 ? (
                      <span><ImagePlus size={13} /><b>{toPersianDigits(salon.post_count || salon.portfolio?.length || 0)}</b> نمونه‌کار</span>
                    ) : null}
                    {localStaffCount > 0 ? (
                      <span><UserRound size={13} /><b>{toPersianDigits(localStaffCount)}</b> آرتیست</span>
                    ) : null}
                  </div>
                </div>
                <div className="salonCardFooter">
                  <div className="salonCardFooterChips">
                    <span className="salonOpenChip">
                      {salon.open ? <SegmentClock value={salon.open} size="xs" as="span" /> : "آماده رزرو"}
                    </span>
                    <span className="salonServiceChip">{toPersianDigits(serviceCount)} خدمت</span>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectSalon(salon);
                    }}
                  >
                    <CalendarCheck size={17} /> رزرو
                  </button>
                </div>
              </article>
            );
          }) : normalizedSalonQuery ? (
            <div className="emptySalonDirectory">
              <Search size={22} />
              <div>
                <b>نتیجه‌ای پیدا نشد</b>
              </div>
            </div>
          ) : (
            <div className="emptySalonDirectory">
              <img src="/salons-empty-illustration.png" alt="" aria-hidden="true" />
              <div>
                <b>سالن‌ها اینجا نمایش داده می‌شوند</b>
              </div>
            </div>
          )}
          </div>
        </>
      )}
    </div>
  );
}
