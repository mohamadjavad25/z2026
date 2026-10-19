"use client";

import { defaultAvatarFor } from "../../shared/lib/defaultAvatar";
import { useState } from "react";
import {
  Bell,
  Eye,
  ImagePlus,
  MapPin,
  QrCode
} from "lucide-react";
import { toPersianDigits } from "../../shared/lib/digits";
import { ProfileHeroActions } from "./ProfileHeroActions";
import { ProfileQrCodeSheet } from "../../components/ProfileQrCodeSheet";

/**
 * Role-aware profile hero (client / artist / salon).
 * Single component: one wrapper + salon layout fork; artist is an additive overlay.
 * State/panels stay in HomeApp — only callbacks + display stats are passed.
 */
// Eye next to the owner's name: opens their page as clients see it.
function PublicPreviewButton({ onClick }) {
  if (typeof onClick !== "function") return null;
  return (
    <button
      type="button"
      className="profileHeroEyeBtn"
      onClick={onClick}
      aria-label="دیدن پروفایل عمومی"
      title="دیدن پروفایل عمومی"
    >
      <Eye size={18} />
    </button>
  );
}

// City under the name; tapping it opens «ثبت لوکیشن» in Settings.
function AreaLine({ area, onClick, icon = false }) {
  const content = (
    <>
      {icon ? <MapPin size={14} aria-hidden="true" /> : null}
      {area || "شهر ثبت نشده"}
    </>
  );
  if (typeof onClick !== "function") return <p>{content}</p>;
  return (
    <p>
      <button type="button" className="profileHeroAreaBtn" onClick={onClick} aria-label={area ? "ویرایش لوکیشن" : "ثبت لوکیشن"}>
        {content}
      </button>
    </p>
  );
}

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
  onScan,
  onOpenLocation,
  modeRail = null
}) {
  const type = profile?.type || "";
  const name = profile?.data?.name || "پروفایل frfro";
  const avatar = profile?.data?.avatar || defaultAvatarFor(profile?.type);
  const poster = profile?.data?.poster || "";
  const avatarPosition = profile?.data?.avatarPosition || "50% 50%";
  const posterPosition = profile?.data?.posterPosition || "50% 50%";
  const [qrSheetOpen, setQrSheetOpen] = useState(false);
  if (!profile) return null;
  // «اسکن شو» sheet -> «اسکن کن»: close the code and open the scanner.
  const scanFromSheet = typeof onScan === "function" ? () => { setQrSheetOpen(false); onScan(); } : undefined;
  const artistPublicUrl = type === "artist" && profile.id && typeof window !== "undefined"
    ? `${window.location.origin}/artists/${profile.id}`
    : "";

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
          aria-label="کد QR و اسکن"
          title="کد QR و اسکن"
        >
          <QrCode size={18} />
        </button>
        <ProfileQrCodeSheet
          open={qrSheetOpen}
          url={salonPublicUrl}
          name={name}
          hint="مشتری‌ها با اسکن این کد به تو وصل می‌شوند و از همان‌جا نوبت می‌گیرند. برای آوردن آرتیست به تیمت، از «پرسنل ← دعوت آرتیست» کد مخصوص تیم را نشانش بده."
          onScan={scanFromSheet}
          onOpenChange={setQrSheetOpen}
        />
        <div className="salonHeroAvatarFrame">
          <img className="profileAvatarImage" src={avatar} alt="" aria-hidden="true" style={{ objectPosition: avatarPosition }} />
        </div>

        <div className="salonHeroMeta">
          <div className="profileHeroCopy">
            <AreaLine area={profile.data?.area} onClick={onOpenLocation} />
            <h2>{name}</h2>
            <span className="salonHeroVerified" aria-hidden="true">✹</span>
          </div>
          <PublicPreviewButton onClick={onPreviewPublic} />
        </div>
        {modeRail}
        <div className="salonHeroSocial" aria-label="آمار سالن">
          <div className="salonHeroFollowStats">
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
          <AreaLine area={profile.data?.area} onClick={onOpenLocation} icon />
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
        {type === "artist" && <PublicPreviewButton onClick={onPreviewPublic} />}
        {type !== "artist" && <p>{kicker}</p>}
        <h2>
          {type === "artist" ? <span className="artistHeroNameText">{name}</span> : name}
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
          <span><b>{artistStats?.bookingCount ?? 0}</b> رزرو فعال</span>
        </div>
      )}
      <ProfileHeroActions
        activePanel={activePanel}
        profileType={type}
        onOpenSaved={onOpenSaved}
        onOpenNotifications={onOpenNotifications}
        onShowQr={type === "artist" && artistPublicUrl ? () => setQrSheetOpen(true) : undefined}
        notificationCount={notificationCount}
      />
      {type === "artist" ? (
        <ProfileQrCodeSheet
          open={qrSheetOpen}
          url={artistPublicUrl}
          name={name}
          hint="مشتری‌ها با اسکن این کد به تو وصل می‌شوند و سالن‌ها تو را به تیمشان دعوت می‌کنند."
          onScan={scanFromSheet}
          onOpenChange={setQrSheetOpen}
        />
      ) : null}
    </div>
  );
}
