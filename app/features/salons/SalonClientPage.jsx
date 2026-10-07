"use client";

import { DEFAULT_SALON_LOGO } from "../../shared/lib/defaultAvatar";
import { SkeletonList } from "../../components/Skeleton";
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
  Store,
  UserPlus,
  UserRound,
  WandSparkles,
  X
} from "lucide-react";
import { ServiceIcon } from "../../components/ServiceIcon";
import { ServiceIconStrip } from "../../components/ServiceIconStrip";
import { SegmentClock } from "../../components/SegmentClock";
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

function getTodayStatus(hours) {
  if (!Array.isArray(hours) || !hours.length) return null;
  const row = hours.find((item) => item.day === PERSIAN_WEEKDAYS[new Date().getDay()]);
  return row?.active
    ? { open: true, short: `امروز تا ${toPersianDigits(row.close_time || "")}` }
    : { open: false, short: "امروز تعطیل" };
}

function getMinPrice(services) {
  const prices = (services || []).map((service) => parseTomanAmount(service.price)).filter(Boolean);
  return prices.length ? Math.min(...prices) : 0;
}

function getPrimaryBookingService(services) {
  return services[0]?.name || "رزرو وقت";
}

export function SalonClientPage({
  active,
  selectedSalon,
  salons,
  directoryLoading = false,
  isFollowing,
  isSaved,
  getVisibleServices,
  getPortfolioCardStyle,
  onBack,
  onFollow,
  onSave,
  onShare,
  postActions = null,
  onOpenBooking,
  onSelectSalon
}) {
  const [aboutOpen, setAboutOpen] = useState(false);
  const [publicSheet, setPublicSheet] = useState("");
  const [salonQuery, setSalonQuery] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const normalizedSalonQuery = salonQuery.trim();
  const visibleSalons = salons.filter((salon) => {
    if (onlyOpen && !getTodayStatus(salon.hours)?.open) return false;
    if (!normalizedSalonQuery) return true;
    return [salon.name, salon.area, salon.tag].filter(Boolean).some((field) => field.includes(normalizedSalonQuery));
  });
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
          <header className="scHero">
            {selectedSalon.poster ? (
              <img
                className="scHeroImage"
                src={selectedSalon.poster}
                alt=""
                aria-hidden="true"
                style={{ objectPosition: selectedSalon.posterPosition || "50% 50%" }}
              />
            ) : (
              <div className="scHeroFallback" aria-hidden="true" />
            )}
            <div className="scTopbar">
              <button type="button" className="scRound" onClick={onBack} aria-label="بازگشت به سالن‌ها">
                <ChevronLeft size={20} />
              </button>
              <button type="button" className="scRound" onClick={() => onShare(selectedSalon.name)} aria-label="اشتراک‌گذاری">
                <Share2 size={19} />
              </button>
            </div>
          </header>

          <section className="scId">
            <span className="scAvatar">
              <img
                src={selectedSalon.avatar || DEFAULT_SALON_LOGO}
                alt=""
                aria-hidden="true"
                style={{ objectPosition: selectedSalon.avatarPosition || "50% 50%" }}
              />
            </span>
            <h2>{publicName}</h2>
            <p className="scTag">{publicTag}</p>
            {selectedSalon.area ? <p className="scArea"><MapPin size={13} />{selectedSalon.area}</p> : null}
            {openStatus ? (
              <p className={`scOpen ${openStatus.open ? "is-open" : "is-closed"}`}>
                <Clock3 size={13} /> {openStatus.text}
              </p>
            ) : null}
            <div className="scStats">
              <span><b>{toPersianDigits(staffCount)}</b>عضو تیم</span>
              <span><b>{toPersianDigits(services.length)}</b>خدمت</span>
              <span><b>{followerCount}</b>دنبال‌کننده</span>
            </div>
            <div className="scActions">
              <button type="button" className={isFollowing ? "is-following" : ""} onClick={() => onFollow(selectedSalon)}>
                {isFollowing ? <Check size={17} /> : <UserPlus size={17} />}
                {isFollowing ? "دنبال می‌کنی" : "دنبال کردن"}
              </button>
              {selectedSalon.phone ? (
                <a href={`tel:${toLatinDigits(selectedSalon.phone)}`} aria-label="تماس با سالن">
                  <Phone size={17} /> تماس
                </a>
              ) : null}
            </div>
          </section>

          <section className="salonPublicCard salonPublicServices">
            <div className="salonPublicSectionHead">
              {services.length > 5 ? <button type="button" onClick={() => setPublicSheet("services")}>مشاهده همه</button> : <span />}
              <h3>خدمات و قیمت</h3>
            </div>
            {services.length ? (
              <div className="spvServiceList">
                {services.slice(0, 5).map((service) => (
                  <button
                    type="button"
                    className="spvService"
                    key={service.id || service.name}
                    onClick={() => onOpenBooking(service.name)}
                  >
                    <ServiceIcon emoji={service.emoji} name={service.name} size="md" />
                    <span className="spvServiceBody">
                      <b>{service.name}</b>
                      <small>{service.duration || "زمان متغیر"}</small>
                    </span>
                    <span className="spvServicePrice">
                      {parseTomanAmount(service.price) ? <><b>{formatTomanNumber(parseTomanAmount(service.price))}</b><em>تومان</em></> : <em>قیمت توافقی</em>}
                    </span>
                    <span className="spvServiceGo">رزرو</span>
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

          <nav className="spvBar" aria-label="رزرو و ذخیره">
            <button type="button" className={`spvBarIcon ${isSaved ? "is-on" : ""}`} onClick={() => onSave(selectedSalon)} aria-label={isSaved ? "حذف از ذخیره‌شده‌ها" : "ذخیره سالن"} aria-pressed={isSaved}>
              <Heart size={22} fill={isSaved ? "currentColor" : "none"} />
            </button>
            <button type="button" className="spvBarIcon" onClick={() => setAboutOpen(true)} aria-label="درباره سالن">
              <UserRound size={22} />
            </button>
            <button type="button" className="spvBarBook" onClick={() => onOpenBooking(getPrimaryBookingService(services))} disabled={!services.length}>
              <CalendarCheck size={19} />
              رزرو نوبت
              {minPrice ? <small>از {formatTomanNumber(minPrice)} تومان</small> : null}
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
            <div className="salonPublicBrowseOverlay" role="dialog" aria-modal="true" aria-label={publicSheet === "services" ? "همه خدمات" : "همه نمونه‌کارها"} onClick={() => setPublicSheet("")}>
              <article className={`salonPublicBrowseSheet is-${publicSheet}`} onClick={(event) => event.stopPropagation()}>
                <div className="salonPublicBrowseHead">
                  <span>{publicSheet === "services" ? "لیست خدمات" : "گالری سالن"}</span>
                  <h3>{publicSheet === "services" ? "همه خدمات سالن" : "همه نمونه‌کارها"}</h3>
                </div>
                {publicSheet === "services" ? (
                  services.length ? (
                    <div className="salonPublicAllServices">
                      {services.map((service) => (
                        <button
                          type="button"
                          key={service.id || service.name}
                          onClick={() => {
                            setPublicSheet("");
                            onOpenBooking(service.name);
                          }}
                        >
                          <ServiceIcon emoji={service.emoji} name={service.name} size="lg" />
                          <b>{service.name}</b>
                          <small>{service.price ? `${formatTomanNumber(parseTomanAmount(service.price))} تومان` : "قیمت توافقی"} • {service.duration || "زمان متغیر"}</small>
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
        <>
          <div className="salonPromoHeader">
            <ServiceIconStrip ids={["haircut", "manicure", "lipstick", "facial"]} size="sm" />
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
          <div className="sdrChips" role="tablist" aria-label="فیلتر سالن‌ها">
            <button type="button" role="tab" aria-selected={!onlyOpen} className={!onlyOpen ? "is-on" : ""} onClick={() => setOnlyOpen(false)}>همه سالن‌ها</button>
            <button type="button" role="tab" aria-selected={onlyOpen} className={onlyOpen ? "is-on" : ""} onClick={() => setOnlyOpen(true)}>امروز باز است</button>
          </div>
          <div className="salonList sdrList">
          {visibleSalons.length ? visibleSalons.map((salon) => {
            const serviceCount = getVisibleServices(salon).length;
            const localStaffCount = salon.staff?.length || 0;
            return (
              <div
                className="sdr"
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
                <div className="sdrHead">
                  <span className="sdrLogo hasImage" aria-hidden="true">
                    <img src={salon.avatar || DEFAULT_SALON_LOGO} alt="" style={{ objectPosition: salon.avatarPosition || "50% 50%" }} />
                  </span>
                  <div className="sdrTitle">
                    <h3>{salon.name}</h3>
                    {[salon.area, salon.tag].filter(Boolean).length > 0 ? (
                      <p><MapPin size={12} />{[salon.area, salon.tag].filter(Boolean).join(" • ")}</p>
                    ) : null}
                  </div>
                  {(() => {
                    const status = getTodayStatus(salon.hours);
                    return status ? <span className={`sdrOpen ${status.open ? "is-open" : "is-closed"}`}>{status.open ? "باز" : "تعطیل"}</span> : null;
                  })()}
                </div>
                {serviceCount > 0 ? (
                  <div className="sdrServices" aria-label="خدمات سالن">
                    {getVisibleServices(salon).slice(0, 5).map((service) => (
                      <ServiceIcon key={service.id || service.name} emoji={service.emoji} name={service.name} size="sm" />
                    ))}
                    {serviceCount > 5 ? <span className="sdrMore">+{toPersianDigits(serviceCount - 5)}</span> : null}
                  </div>
                ) : null}
                <div className="sdrFoot">
                  <div className="sdrMeta">
                    {(() => {
                      const from = getMinPrice(getVisibleServices(salon));
                      return from ? <b>از {formatTomanNumber(from)} تومان</b> : <b>{serviceCount > 0 ? `${toPersianDigits(serviceCount)} خدمت` : "هنوز خدمتی ثبت نشده"}</b>;
                    })()}
                    <small>
                      {(salon.post_count || salon.portfolio?.length || 0) > 0 ? `${toPersianDigits(salon.post_count || salon.portfolio?.length || 0)} نمونه‌کار` : ""}
                      {(salon.post_count || salon.portfolio?.length || 0) > 0 && localStaffCount > 0 ? " • " : ""}
                      {localStaffCount > 0 ? `${toPersianDigits(localStaffCount)} آرتیست` : ""}
                    </small>
                  </div>
                  {serviceCount > 0 ? (
                    <span className="sdrBook"><CalendarCheck size={16} /> رزرو</span>
                  ) : (
                    <span className="sdrBook is-soon">به‌زودی</span>
                  )}
                </div>
              </div>
            );
          }) : normalizedSalonQuery || onlyOpen ? (
            <div className="emptySalonDirectory">
              <Search size={22} />
              <div>
                <b>نتیجه‌ای پیدا نشد</b>
              </div>
            </div>
) : directoryLoading ? (
            <SkeletonList rows={4} variant="card" label="در حال بارگذاری سالن‌ها" />
          ) : (
            <div className="emptySalonDirectory">
              <img src="/salons-empty-illustration.webp" alt="" aria-hidden="true" />
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
