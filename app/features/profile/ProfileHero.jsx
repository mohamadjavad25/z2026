"use client";

import { defaultAvatarFor } from "../../shared/lib/defaultAvatar";
import { useState } from "react";
import {
  BadgeCheck,
  Bell,
  Heart,
  ImagePlus,
  MapPin,
  QrCode,
  UserPlus
} from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { formatCount } from "../../shared/lib/counts";
import { ProfileHeroActions } from "./ProfileHeroActions";
import { SalonQrCodeSheet } from "../../components/SalonQrCodeSheet";

/**
 * Role-aware profile hero (client / artist / salon).
 * Single component: one wrapper + salon layout fork; artist is an additive overlay.
 * State/panels stay in HomeApp — only callbacks + display stats are passed.
 */
export function ProfileHero({
  profile,
  heroClass = "",
  kicker = "",
  desc = "",
  salonStats,
  artistStats,
  activePanel,
  onOpenSaved,
  onOpenNotifications,
  onShare,
  notificationCount = 0,
  showShare = false,
  onPreviewPublic,
  modeRail = null
}) {
  const type = profile?.type || "";
  const name = profile?.data?.name || "پروفایل Farfaroo";
  const avatar = profile?.data?.avatar || defaultAvatarFor(profile?.type);
  const poster = profile?.data?.poster || "";
  const avatarPosition = profile?.data?.avatarPosition || "50% 50%";
  const posterPosition = profile?.data?.posterPosition || "50% 50%";
  const [qrSheetOpen, setQrSheetOpen] = useState(false);
  if (!profile) return null;

  if (type === "salon") {
    const salonPublicUrl = typeof window !== "undefined" && profile.id
      ? `${window.location.origin}/salons/${profile.id}`
      : "";

    return (
      <div className={`profileHero ${heroClass}`}>
        <div className="salonHeroBanner">
          {poster ? <img className="salonHeroBannerImage" src={poster} alt="" aria-hidden="true" style={{ objectPosition: posterPosition }} /> : null}
        </div>
        <ProfileHeroActions
          activePanel={activePanel}
          profileType={type}
          onOpenSaved={onOpenSaved}
          onOpenNotifications={onOpenNotifications}
          onShare={onShare}
          notificationCount={notificationCount}
          showShare={showShare}
        />
        <button
          type="button"
          className="salonHeroQrBtn"
          onClick={() => setQrSheetOpen(true)}
          disabled={!salonPublicUrl}
          aria-label="نمایش کد QR پروفایل عمومی"
          title="نمایش کد QR پروفایل عمومی"
        >
          <QrCode size={18} />
        </button>
        <SalonQrCodeSheet
          open={qrSheetOpen}
          url={salonPublicUrl}
          name={name}
          onOpenChange={setQrSheetOpen}
        />
        <div className="salonHeroAvatarFrame">
          <img className="profileAvatarImage" src={avatar} alt="" aria-hidden="true" style={{ objectPosition: avatarPosition }} />
        </div>

        <div className="salonHeroMeta">
          <div className="profileHeroCopy">
            <p>{profile.data?.area || "شهر ثبت نشده"}</p>
            <h2>{name}</h2>
            <span className="salonHeroVerified" aria-hidden="true">✹</span>
          </div>
        </div>
        {modeRail}
        <div className="salonHeroSocial" aria-label="فالو سالن">
          <div className="salonHeroFollowStats">
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
      <div className={`profileHero ${heroClass} cphHero`}>
        <div className="cphBanner" aria-hidden="true" />
        <button
          type="button"
          className={`clientBeautyHeroBell cphBell ${activePanel === "notifications" ? "is-active" : ""} ${notificationCount > 0 ? "has-notifications" : ""}`.trim()}
          onClick={onOpenNotifications}
          aria-label="اعلان‌ها"
        >
          <Bell size={18} />
        </button>
        <span className="cphAvatar">
          <img className="profileAvatarImage" src={avatar} alt="" aria-hidden="true" style={{ objectPosition: avatarPosition }} />
        </span>
        <div className="cphMeta">
          <h2>{name}</h2>
          <p>
            <MapPin size={14} aria-hidden="true" />
            {profile.data?.area || "شهر ثبت نشده"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`profileHero ${heroClass}`}>
      {type === "artist" ? (
        <div className="artistHeroPoster" aria-hidden="true">
          {poster ? <img className="artistHeroPosterImage" src={poster} alt="" style={{ objectPosition: posterPosition }} /> : null}
        </div>
      ) : null}
      <div className="profileStoryAvatarWrap">
        <img className="profileAvatarImage" src={avatar} alt="" aria-hidden="true" style={{ objectPosition: avatarPosition }} />
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
      <ProfileHeroActions
          activePanel={activePanel}
          profileType={type}
          onOpenSaved={onOpenSaved}
          onOpenNotifications={onOpenNotifications}
        onPreviewPublic={onPreviewPublic}
        notificationCount={notificationCount}
      />
    </div>
  );
}
