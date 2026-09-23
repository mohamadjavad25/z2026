"use client";

import { useState } from "react";
import {
  Award,
  BadgeCheck,
  Heart,
  ImagePlus,
  MapPin,
  ShoppingBag,
  Star,
  UserPlus,
} from "lucide-react";
import { MarbleRatingStars } from "../../components/MarbleRatingStars";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatCount } from "../../shared/lib/rating";
import { ProfileHeroActions } from "./ProfileHeroActions";
import { ProfileStoryCreator } from "../../components/ProfileStoryCreator";
import { ProfileHeroWeekStrip } from "./ProfileHeroWeekStrip";

/**
 * Role-aware profile hero (client / artist / salon / shop).
 * Single component: one wrapper + salon layout fork; artist/shop are additive overlays.
 * State/panels stay in HomeApp — only callbacks + display stats are passed.
 */
export function ProfileHero({
  profile,
  heroClass = "",
  kicker = "",
  desc = "",
  salonStats,
  artistStats,
  shopStats,
  activePanel,
  onOpenSaved,
  onOpenNotifications,
  onOpenSettings,
  onOpenWeekHistory,
  onSelectSalonWeekDay,
  selectedSalonWeekDay,
  salonWeekTabs = [],
  showSalonWeekStrip = true,
  onShare,
  notificationCount = 0,
  showShare = false,
  onStorySave,
  onStoryDelete,
  onPreviewPublic
}) {
  const type = profile?.type || "";
  const name = profile?.data?.name || "پروفایل زیبابان";
  const avatar = profile?.data?.avatar || "/profile-icon.svg";
  const profileStoryPoster = profile?.data?.storyPoster || profile?.data?.story_poster || profile?.data?.introPoster || profile?.data?.intro_poster || "";
  const [storyCreatorOpen, setStoryCreatorOpen] = useState(false);
  if (!profile) return null;

  if (type === "salon") {
    const salonStoryVideo = profile.data?.storyVideo || profile.data?.story_video || profile.data?.introVideo || profile.data?.intro_video || "";
    const salonStoryPoster = profile.data?.storyPoster || profile.data?.story_poster || profile.data?.introPoster || profile.data?.intro_poster || "/salon-public-hero.png";
    const salonHeroStats = [
      {
        value: toPersianDigits(profile.data?.experienceYears || 0),
        label: "سال تجربه",
        icon: Award
      }
    ];
    // Real rolling-week tabs (today + next 6 days), built by the caller from
    // actual bookings/dates — see HomeApp's salonHeroWeekTabs. No fallback
    // sample data here: a stale hardcoded week is exactly the bug that made
    // "امروز" and the checked day disagree with the real calendar.
    const weekItems = salonWeekTabs;

    return (
      <div className={`profileHero ${heroClass}`}>
        <div className="salonHeroBanner" style={{ "--salon-story-poster": `url("${salonStoryPoster}")` }} />
        <ProfileHeroActions
          activePanel={activePanel}
          profileType={type}
          onOpenSaved={onOpenSaved}
          onOpenNotifications={onOpenNotifications}
          onOpenSettings={onOpenSettings}
          onShare={onShare}
          notificationCount={notificationCount}
          showShare={showShare}
        />
        <div className="salonHeroAvatarFrame" onClick={() => setStoryCreatorOpen(true)}>
          <img className="profileAvatarImage" src={avatar} alt="" aria-hidden="true" />
          <ProfileStoryCreator profileType="salon" storyVideo={salonStoryVideo} storyPoster={salonStoryPoster} onSave={onStorySave} onDelete={onStoryDelete} open={storyCreatorOpen} onOpenChange={setStoryCreatorOpen} />
        </div>

        <div className="salonHeroMeta">
          <div className="profileHeroCopy">
            <p>{profile.data?.tag || "سالن زیبایی"}</p>
            <h2>{name}</h2>
            <span className="salonHeroVerified" aria-hidden="true">✹</span>
          </div>
          <div className="salonHeroRatingPill" aria-label="امتیاز سالن">
            <b>بدون امتیاز</b>
            <Star size={13} fill="currentColor" />
          </div>
        </div>
        <div className="salonHeroFutureStats" aria-label="آمار سالن">
          {salonHeroStats.map((item) => {
            const Icon = item.icon;
            return (
              <span key={item.label}>
                <b>{item.value}</b>
                <small>{item.label}</small>
                <Icon size={15} />
              </span>
            );
          })}
        </div>
        {showSalonWeekStrip && (
          <ProfileHeroWeekStrip
            items={weekItems}
            selectedDay={selectedSalonWeekDay}
            onSelectDay={onSelectSalonWeekDay}
            onOpenHistory={onOpenWeekHistory}
            ariaLabel="برنامه هفته سالن"
          />
        )}
        <div className="salonHeroSocial" aria-label="امتیاز و فالو سالن">
          <div className="salonHeroFollowStats">
            <span>
              <Star size={14} />
              <b>{salonStats?.rating}</b>
              <small>امتیاز</small>
            </span>
            <span>
              <Heart size={14} />
              <b>{formatCount(salonStats?.followers)}</b>
              <small>دنبال‌کننده</small>
            </span>
            <span>
              <UserPlus size={14} />
              <b>{formatCount(salonStats?.following)}</b>
              <small>دنبال‌شونده</small>
            </span>
            <span>
              <ImagePlus size={14} />
              <b>{toPersianDigits(salonStats?.posts)}</b>
              <small>پست</small>
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (type === "client") {
    return (
      <div className={`profileHero ${heroClass} clientBeautyHero`}>
        <div className="clientBeautyHeroIdentity">
          <span className="clientBeautyAvatar">
            <img className="profileAvatarImage" src={avatar} alt="" aria-hidden="true" />
          </span>
          <div className="profileHeroCopy">
            <p>{kicker || "پروفایل بانو"}</p>
            <h2>{name}</h2>
            <span>
              <MapPin size={15} aria-hidden="true" />
              {profile.data?.area || "آدرس ثبت نشده"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`profileHero ${heroClass}`}>
      {type === "artist" ? (
        <div
          className={`artistHeroPoster ${profileStoryPoster ? "has-poster" : ""}`}
          style={profileStoryPoster ? { backgroundImage: `url("${profileStoryPoster}")` } : undefined}
          aria-hidden="true"
        />
      ) : null}
      <div className="profileStoryAvatarWrap" onClick={() => (type === "artist" || type === "shop") && setStoryCreatorOpen(true)}>
        <img className="profileAvatarImage" src={avatar} alt="" aria-hidden="true" />
        {type === "artist" && (
          <b className="artistHeroAvatarRating" aria-label={`امتیاز ${toPersianDigits(artistStats?.rating)}`}>
            {toPersianDigits(artistStats?.rating)}
            <Star size={10} fill="currentColor" aria-hidden="true" />
          </b>
        )}
        {(type === "artist" || type === "shop") && (
          <ProfileStoryCreator
            profileType={type}
            storyVideo={profile.data?.storyVideo || profile.data?.story_video || profile.data?.introVideo || profile.data?.intro_video || ""}
            storyPoster={profile.data?.storyPoster || profile.data?.story_poster || profile.data?.introPoster || profile.data?.intro_poster || ""}
            onSave={onStorySave}
            onDelete={onStoryDelete}
            open={storyCreatorOpen}
            onOpenChange={setStoryCreatorOpen}
          />
        )}
      </div>
      <div className="profileHeroCopy">
        {type !== "artist" && <p>{kicker}</p>}
        <h2>
          {type === "artist" ? <span className="artistHeroNameText">{name}</span> : name}
          {type === "artist" && <BadgeCheck className="artistVerifiedTick" size={16} aria-label="تایید شده" />}
        </h2>
        {type === "artist" && profile.data?.area && (
          <span className="artistHeroArea">
            <MapPin size={13} aria-hidden="true" />
            <span className="artistHeroAreaText">{profile.data.area}</span>
          </span>
        )}
        {type !== "artist" && (
          <span>
            {type === "client"
              ? (profile.data?.area || "آدرس ثبت نشده")
              : desc}
          </span>
        )}
      </div>
      {type === "artist" && (
        <div className="artistHeroStats" aria-label="آمار آرتیست">
          <span><b>{formatCount(artistStats?.followers)}</b> دنبال‌کننده</span>
          <span><b>{artistStats?.bookingCount ?? 0}</b> رزرو فعال</span>
        </div>
      )}
      {type === "shop" && (
        <>
          <div className="shopHeroTag">
            <ShoppingBag size={14} />
            <span>پنل فروش فعال</span>
          </div>
          <div className="shopHeroStats" aria-label="آمار فروشگاه">
            <span>
              <b>{toPersianDigits(shopStats?.productCount ?? 0)}</b>
              محصول
            </span>
            <span>
              <b>{toPersianDigits(shopStats?.newOrderCount ?? 0)}</b>
              سفارش جدید
            </span>
            <span>
              <b>{toPersianDigits(shopStats?.featuredCount ?? 0)}</b>
              ویژه
            </span>
          </div>
        </>
      )}
      <ProfileHeroActions
          activePanel={activePanel}
          profileType={type}
          onOpenSaved={onOpenSaved}
          onOpenNotifications={onOpenNotifications}
          onOpenSettings={onOpenSettings}
        onPreviewPublic={onPreviewPublic}
        notificationCount={notificationCount}
      />
    </div>
  );
}
