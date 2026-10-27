"use client";

import { DEFAULT_SALON_LOGO } from "../../shared/lib/defaultAvatar";
import { useState, useEffect } from "react";
import {
  Bookmark,
  CalendarCheck,
  ChevronLeft,
  ChevronUp,
  ImagePlus,
  Phone,
  RotateCw,
  Scissors,
  Share2,
  UserPlus
} from "lucide-react";
import { PublicProfileHeader } from "../../components/PublicProfileHeader";
import { folderPhotos, InstagramCoverBadge, InstagramWorksTile } from "../../components/InstagramFolder";
import { BookingPausedNote } from "../../components/BookingPausedNote";
import { ServicesDropUp } from "../../components/ServicesDropUp";
import { ServicesOnPage } from "../../components/ServicesOnPage";
import { bundleServices } from "../../shared/lib/serviceBundle";
import { toLatinDigits, toPersianDigits } from "../../shared/lib/digits";
import { formatTomanNumber, parseTomanAmount } from "../../shared/lib/money";
import { SalonClientGallery } from "./SalonClientGallery";
import { SalonTeam } from "./SalonTeam";
import { SheetClose } from "../../components/SheetClose";
import { WeeklyHours } from "../../components/WeeklyHours";
import { ConnectToggle } from "../connect/ConnectToggle";

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
  onOpenBooking,
  // Opens a team artist's own page («صفحهٔ …» on their card); without it the card links to /artists/:id.
  onOpenArtist = null,
  // A salon or artist looking at this page (opened from a scanned code): their own bar replaces «رزرو» and «وصل شو».
  visitorBar = null,
  continueFor = null,
  onContinue = null,
  onDismissContinue = null,
  onRetryDetail = null
}) {
  const [publicSheet, setPublicSheet] = useState("");
  const [servicesOpen, setServicesOpen] = useState(false);
  // «رزرو با …» from a team card: the services menu shows only that member's services and books with them.
  const [bookWith, setBookWith] = useState(null);
  // «نمونه‌کارها» filter: "all", "salon", or a team member's staffId.
  const [postsBy, setPostsBy] = useState("all");
  const salonKey = selectedSalon?.id ?? "";
  useEffect(() => { setBookWith(null); setPostsBy("all"); }, [salonKey]);
  const services = selectedSalon ? getVisibleServices(selectedSalon) : [];
  // Opened from a category on «سالن و آرتیست من»: show the services menu as soon as the services have loaded.
  const focus = selectedSalon?.focusServices || null;
  const hasServices = services.length > 0;
  useEffect(() => {
    if (focus && hasServices) setServicesOpen(true);
  }, [focus, hasServices]);
  const salonPosts = Array.isArray(selectedSalon?.portfolio) ? selectedSalon.portfolio : [];
  const publicName = selectedSalon?.name || "سالن";
  // The team as the salon's public page shows it (repos/salons/team.js); until the detail arrives, the plain staff list.
  const team = Array.isArray(selectedSalon?.team)
    ? selectedSalon.team
    : (selectedSalon?.staff || []).filter((member) => member && (member.artist_name || member.name)).map((member) => ({
      staffId: member.id ?? null,
      name: member.artist_name || member.name,
      bookingName: String(member.name || "").trim(),
      role: String(member.role || member.artist_service || "").split(/[،,]/)[0],
      avatar: member.avatar || member.staff_avatar || "",
      isOwner: Boolean(member.is_owner),
      posts: []
    }));
  // The salon's own posts and its team artists' (owner's decision 2026-10-26), newest first; each team post carries
  // its artist (`by`) for the name on the tile and the viewer.
  const teamPosts = team.filter((member) => !member.isOwner).flatMap((member) => (member.posts || []).map((post) => ({
    ...post,
    staffKey: String(member.staffId),
    by: { name: member.name, role: "آرتیست", area: selectedSalon?.area || "", avatar: member.avatar || "" }
  })));
  const allPosts = teamPosts.length
    ? [...salonPosts, ...teamPosts].sort((a, b) => (Number(Boolean(b.featured && !b.by)) - Number(Boolean(a.featured && !a.by)))
      || (new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()))
    : salonPosts;
  const postFilters = teamPosts.length ? [
    { key: "all", label: "همه" },
    ...(salonPosts.length ? [{ key: "salon", label: "سالن" }] : []),
    ...team.filter((member) => !member.isOwner && member.posts?.length).map((member) => ({ key: String(member.staffId), label: member.name }))
  ] : [];
  const activeFilter = postFilters.some((filter) => filter.key === postsBy) ? postsBy : "all";
  const portfolioItems = activeFilter === "all" ? allPosts
    : activeFilter === "salon" ? salonPosts
    : teamPosts.filter((post) => post.staffKey === activeFilter);
  const menuServices = bookWith ? bookWith.services : services;
  // «اینستاگرام» (owner's choice 2026-10-27): on the cover («ب») and as the last tile of the works («الف»), the folder
  // showing the salon's newest works.
  const instagram = selectedSalon?.instagram || "";
  const instagramPhotos = folderPhotos(allPosts);
  const weekHours = Array.isArray(selectedSalon?.hours) ? selectedSalon.hours : [];
  const todayName = PERSIAN_WEEKDAYS[new Date().getDay()];
  const prices = services.map((service) => parseTomanAmount(service.price)).filter(Boolean);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  // On the bottom bar: how many services and the lowest price, e.g. «۸ خدمت، قیمت از ۴ تومان».
  const barNote = [
    services.length ? `${toPersianDigits(services.length)} خدمت` : "",
    minPrice ? `قیمت از ${formatTomanNumber(minPrice)} تومان` : ""
  ].filter(Boolean).join("، ");

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
            location={selectedSalon.location}
            coverBadge={instagram ? <InstagramCoverBadge instagram={instagram} name={publicName} photos={instagramPhotos} /> : null}
            start={(
              <button type="button" className="pphRound" onClick={onBack} aria-label="برگرد">
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
            <div className="pphActions">
              {visitorBar ? null : <ConnectToggle following={isFollowing} onToggle={() => onFollow(selectedSalon)} name={publicName} kind="سالن" icon={<UserPlus size={18} />} />}
              {selectedSalon.phone ? (
                <a className="pphCall" href={`tel:${toLatinDigits(selectedSalon.phone)}`} aria-label="تماس با سالن">
                  <Phone size={18} /> تماس
                </a>
              ) : null}
            </div>
            {continueFor ? (
              <div className={`spvContinue${continueFor.error ? " is-error" : ""}`} role={continueFor.error ? "alert" : "status"}>
                <span>{continueFor.error || continueFor.text}</span>
                <span className="spvContinueActions">
                  {continueFor.error ? null : <button type="button" className="spvContinueGo" onClick={onContinue}>ادامه</button>}
                  <button type="button" onClick={() => { onDismissContinue?.(); setServicesOpen(true); }}>
                    {continueFor.error ? "یه خدمت انتخاب کن" : "یه خدمت دیگه"}
                  </button>
                </span>
              </div>
            ) : null}
            {selectedSalon.onlineBookingPaused ? <BookingPausedNote hasPhone={Boolean(selectedSalon.phone)} /> : null}
          </section>

          {selectedSalon.detailFailed && onRetryDetail ? (
            <p className="salonGalleryRetry" role="alert">
              اینترنتت کنده؛ دوباره بزن
              <button type="button" onClick={onRetryDetail}><RotateCw size={14} aria-hidden="true" /> دوباره</button>
            </p>
          ) : null}

          <WeeklyHours rows={weekHours} todayName={todayName} />

          {/* Clients pick services from the «رزرو» bar; a visiting salon or artist has no bar, so it sees them here. */}
          {visitorBar ? <ServicesOnPage services={services} /> : null}

          <SalonTeam
            salon={selectedSalon}
            team={team}
            services={services}
            salonPosts={salonPosts}
            getFallbackStyle={getPortfolioCardStyle}
            postActions={postActions}
            onBookWith={visitorBar || selectedSalon.onlineBookingPaused ? null : (member, theirs) => {
              setBookWith({ member, services: theirs });
              setServicesOpen(true);
            }}
            onOpenArtist={onOpenArtist}
          />

          {allPosts.length ? (
          <section className="spvSection salonPublicPortfolio" aria-label="نمونه‌کارها">
            <div className="spvHeadRow">
              <h3 className="spvHead">نمونه‌کارها</h3>
              {portfolioItems.length > PORTFOLIO_PREVIEW ? (
                <button type="button" className="spvSeeAll" onClick={() => setPublicSheet("portfolio")}>
                  همه ({toPersianDigits(portfolioItems.length)})
                </button>
              ) : null}
            </div>
            {postFilters.length > 2 ? (
              <div className="spvPostFilters" role="group" aria-label="نمونه‌کارهای کی؟">
                {postFilters.map((filter) => (
                  <button
                    type="button"
                    key={filter.key}
                    aria-pressed={activeFilter === filter.key}
                    className={activeFilter === filter.key ? "is-on" : ""}
                    onClick={() => setPostsBy(filter.key)}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            ) : null}
            <SalonClientGallery
              salon={selectedSalon}
              items={portfolioItems.slice(0, PORTFOLIO_PREVIEW)}
              allItems={portfolioItems}
              getFallbackStyle={getPortfolioCardStyle}
              postActions={postActions}
              endTile={instagram ? <InstagramWorksTile instagram={instagram} name={publicName} photos={instagramPhotos} className="salonClientMosaicTile is-square" /> : null}
            />
          </section>
          ) : instagram ? (
            <section className="spvSection" aria-label="اینستاگرام">
              <InstagramWorksTile instagram={instagram} name={publicName} photos={[]} wide />
            </section>
          ) : null}

          {visitorBar || (
          <>
          <ServicesDropUp
            key={bookWith ? `with-${bookWith.member.staffId}` : "all"}
            open={servicesOpen}
            title={bookWith ? `کارهای ${bookWith.member.name}` : `خدمات ${publicName}`}
            services={menuServices}
            focusNames={bookWith ? null : focus?.names}
            focusLabel={focus?.label && !bookWith ? `مناسب «${focus.label}»` : ""}
            note={bookWith ? `کارهای ${bookWith.member.name}؛ نوبتت با خودش ثبت می‌شه.` : ""}
            browseOnly={Boolean(selectedSalon.onlineBookingPaused)}
            onConfirm={(picked) => {
              const member = bookWith?.member;
              setServicesOpen(false);
              setBookWith(null);
              onOpenBooking(bundleServices(picked), member ? {
                withStaff: { staffId: member.staffId, name: member.name, bookingName: member.bookingName || member.name }
              } : undefined);
            }}
            onClose={() => { setServicesOpen(false); setBookWith(null); }}
          />
          <nav className="spvBar" aria-label="نوبت گرفتن">
            <button
              type="button"
              className={`spvBarBook${servicesOpen ? " is-open" : ""}`}
              onClick={() => { setBookWith(null); setServicesOpen((open) => !open); }}
              aria-expanded={servicesOpen}
              aria-haspopup="dialog"
            >
              {selectedSalon.onlineBookingPaused ? <Scissors size={19} /> : <CalendarCheck size={19} />}
              {servicesOpen ? "بستن" : selectedSalon.onlineBookingPaused ? "خدمات و قیمت‌ها" : "رزرو"}
              {barNote && !servicesOpen ? <small>{barNote}</small> : null}
              <ChevronUp size={18} className={`spvBarChevron${servicesOpen ? " is-open" : ""}`} aria-hidden="true" />
            </button>
          </nav>
          </>
          )}
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
                    <b>هنوز کاری نذاشته؛ به‌زودی اینجا میاد</b>
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
