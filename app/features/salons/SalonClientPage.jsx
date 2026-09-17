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
  MessageSquare,
  Palette,
  Phone,
  Plus,
  Scissors,
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

const fallbackServices = [
  { id: "makeup", name: "میکاپ", price: "از ۲.۵ م", duration: "۹۰ دقیقه", icon: "makeup" },
  { id: "chignon", name: "شینیون", price: "از ۱.۸ م", duration: "۹۰ دقیقه", icon: "hair" },
  { id: "hair-cut", name: "کوتاهی مو", price: "از ۶۵۰ هزار", duration: "۴۵ دقیقه", icon: "scissors" },
  { id: "keratin", name: "کراتینه", price: "از ۴.۵ م", duration: "۱۵۰ دقیقه", icon: "care" },
  { id: "highlight", name: "هایلایت", price: "از ۳.۸ م", duration: "۱۸۰ دقیقه", icon: "spark" },
  { id: "hair-color", name: "رنگ مو", price: "از ۱.۸ م", duration: "۱۲۰ دقیقه", icon: "palette" }
];

const fallbackPortfolio = [
  { id: "public-salon-1", title: "رنگ و لایت", image: "/explore-post-hair-balayage.png" },
  { id: "public-salon-2", title: "شینیون", image: "/explore-post-bridal-pearl.png" },
  { id: "public-salon-3", title: "مو صاف", image: "/explore-post-hair-waves.png" },
  { id: "public-salon-4", title: "موج نرم", image: "/story-modern-hair.png" },
  { id: "public-salon-5", title: "میکاپ", image: "/explore-post-makeup-nude.png" }
];

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
  onOpenChat,
  onSelectSalon
}) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [publicSheet, setPublicSheet] = useState("");
  const services = selectedSalon ? getVisibleServices(selectedSalon) : [];
  const visibleServices = services.length ? services : fallbackServices;
  const publicServiceItems = visibleServices.length ? visibleServices : fallbackServices;
  const portfolioItems = selectedSalon?.portfolio?.length ? selectedSalon.portfolio : fallbackPortfolio;
  const rating = "۴.۸";
  const followerCount = "۱۲.۴ هزار";
  const staffCount = 8;
  const publicName = "سالن نازی‌ها";
  const publicTag = "سالن زیبایی";
  const managerName = selectedSalon?.managerName || selectedSalon?.manager_name || selectedSalon?.ownerName || selectedSalon?.owner_name || "مدیر سالن";
  const teamNames = (selectedSalon?.staff || [])
    .map((member) => member?.name || member?.fullName || member?.artist_name)
    .filter(Boolean)
    .slice(0, 3);
  const specialtyNames = visibleServices.slice(0, 4).map((service) => service.name).filter(Boolean);
  const storyVideoSrc = selectedSalon?.storyVideo || selectedSalon?.story_video || selectedSalon?.introVideo || selectedSalon?.intro_video || "";
  const storyPosterSrc = selectedSalon?.storyPoster || selectedSalon?.story_poster || selectedSalon?.introPoster || selectedSalon?.intro_poster || "/salon-public-hero.png";
  const story = usePublicStory({ storyVideoSrc, storyPosterSrc });

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
                {toPersianDigits(rating)} امتیاز
                <Star size={15} fill="currentColor" />
              </span>
              <small>({toPersianDigits(reviews.length || 386)} نظر)</small>
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
            <div className="salonPublicServiceRail">
              {publicServiceItems.map((service, index) => (
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
            <button type="button" className="is-primary" onClick={() => onOpenBooking(getPrimaryBookingService(visibleServices))}>
              <Plus size={30} />
            </button>
            <button type="button" onClick={() => onOpenChat(selectedSalon)} aria-label="چت با سالن">
              <MessageSquare size={23} />
            </button>
            <button type="button" className="is-active"><Home size={23} /></button>
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
                  {selectedSalon.bio || "سالن نازی‌ها با تمرکز روی میکاپ، رنگ مو و خدمات تخصصی زیبایی، تجربه‌ای آرام و دقیق برای رزروهای روزمره و مناسبتی فراهم می‌کند."}
                </p>
                <section className="salonPublicAboutBlock">
                  <h4>مدیر و تیم سالن</h4>
                  <div className="salonPublicAboutList">
                    <span><UserRound size={16} /> مدیریت: {managerName}</span>
                    <span><UserPlus size={16} /> تیم: {teamNames.length ? teamNames.join("، ") : "رنگ‌کار، میکاپ آرتیست، ناخن‌کار"}</span>
                  </div>
                </section>
                <section className="salonPublicAboutBlock">
                  <h4>تخصص‌ها و سابقه</h4>
                  <div className="salonPublicAboutChips">
                    {(specialtyNames.length ? specialtyNames : ["میکاپ", "رنگ مو", "شینیون", "کوتاهی مو"]).map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>
                </section>
                <div className="salonPublicAboutFacts">
                  <span><UserRound size={16} /> {toPersianDigits(staffCount)} سال سابقه</span>
                  <span><Heart size={16} /> {followerCount} دنبال‌کننده</span>
                  <span><Star size={16} fill="currentColor" /> {toPersianDigits(rating)} امتیاز</span>
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
                  <span><MapPin size={17} /> تهران، سعادت‌آباد</span>
                  <span><Clock3 size={17} /> ۲۰:۰۰ - ۲۰:۰۰</span>
                  <span><Phone size={17} /> ۰۲۱-۱۲۳۴۵۶۷۸</span>
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
                  <div className="salonPublicAllServices">
                    {publicServiceItems.map((service, index) => (
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
                        <small>{service.price || "قیمت توافقی"} · {service.duration || "زمان متغیر"}</small>
                        <CalendarCheck size={17} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="salonPublicAllPortfolio">
                    {portfolioItems.map((item) => (
                      <figure key={item.id || item.title}>
                        {item.image ? <img src={item.image} alt={item.title || "نمونه کار سالن"} /> : <span style={getPortfolioCardStyle(item)} />}
                        <figcaption>{item.title || "نمونه‌کار"}</figcaption>
                      </figure>
                    ))}
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
          <div className="salonList">
          {salons.length ? salons.map((salon) => {
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
          }) : (
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
