"use client";

import { Bell, BellRing, CalendarCheck, ChevronLeft, Globe, Link2 } from "lucide-react";
import { useState } from "react";
import { ProfileSheet } from "../profile/ProfileSheet";
import { ProfileQrCodeSheet } from "../../components/ProfileQrCodeSheet";
import { usePhonePush } from "./usePhonePush";
import {
  AppearanceSettings,
  ArtistBookingSettings,
  NotificationSettings,
  ProfileVisibilitySettings
} from "../profile/ProfileSettingsPanel";

/**
 * One cell of the settings grid. `id` lets «کارهای مونده» find the button inside; `pending` puts the small pink dot on
 * a tile whose todo is still open.
 */
export function TileSlot({ id, pending = false, wide = false, children }) {
  return (
    <div className={`spTileSlot${pending ? " has-todo" : ""}${wide ? " is-wide" : ""}`} data-todo-slot={id}>
      {children}
    </div>
  );
}

/** A tile that opens a sheet with the settings behind it. */
function SheetTile({ icon: Icon, title, state, kicker = "تنظیمات", children }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="profileLocationRow" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="profileLocationRowIcon" aria-hidden="true">
          <Icon size={17} />
        </span>
        <span className="profileLocationRowInfo">
          <strong>{title}</strong>
          <span>{state}</span>
        </span>
        <ChevronLeft size={16} className="profileLocationRowChevron" aria-hidden="true" />
      </button>
      <ProfileSheet open={open} kicker={kicker} title={title} label={title} onClose={() => setOpen(false)}>
        {children}
      </ProfileSheet>
    </>
  );
}

/** Day, night and automatic sit side by side right on the page, no sheet (owner's decision 2026-10-28). */
export function AppearanceTile() {
  return (
    <div className="spAppearance">
      <strong>ظاهر برنامه</strong>
      <AppearanceSettings bare />
    </div>
  );
}

const PUSH_COPY = {
  on: "روشنه. حتی وقتی برنامه بسته‌ست، خبر نوبت‌ها میاد.",
  off: "خاموشه. روشنش کن تا خبر نوبت‌ها از دستت نره.",
  blocked: "مرورگر جلوشو گرفته. تو تنظیمات مرورگر، اعلان فرفرو رو آزاد کن.",
  unsupported: "این مرورگر اعلان نمی‌ده. اگه آیفون داری، فرفرو رو به صفحهٔ اصلی گوشی اضافه کن و از اونجا باز کن."
};

/** The phone notification itself: its state, one button to turn it on, one to prove it works. */
function PhonePushRow({ push }) {
  const [result, setResult] = useState("");
  async function test() {
    setResult("");
    const sent = await push.sendTest();
    setResult(sent === null ? "نشد. اینترنتت رو چک کن." : sent > 0 ? "فرستادم. تا چند ثانیه دیگه میاد." : "نرسید. اعلان فرفرو رو تو تنظیمات گوشی چک کن.");
  }
  if (push.status === "checking") return null;
  return (
    <div className="spPush" data-state={push.status}>
      <span className="spPushIcon" aria-hidden="true"><BellRing size={17} /></span>
      <div className="spPushCopy">
        <b>اعلان روی گوشی</b>
        <small>{PUSH_COPY[push.status]}</small>
        {result ? <small className="spPushResult" role="status">{result}</small> : null}
      </div>
      {push.status === "off" ? (
        <button type="button" className="spPushBtn" disabled={push.busy} onClick={push.turnOn}>{push.busy ? "صبر کن…" : "روشنش کن"}</button>
      ) : null}
      {push.status === "on" ? (
        <button type="button" className="spPushBtn is-ghost" disabled={push.busy} onClick={test}>{push.busy ? "صبر کن…" : "آزمایش کن"}</button>
      ) : null}
    </div>
  );
}

export function NotificationsTile({ profileType, profileSettings, onToggle }) {
  const push = usePhonePush();
  const state = push.status === "on" ? "روی گوشی روشنه" : push.status === "checking" ? "" : "روی گوشی خاموشه";
  return (
    <SheetTile icon={Bell} title="اعلان‌ها" state={state}>
      <PhonePushRow push={push} />
      <NotificationSettings bare profileType={profileType} profileSettings={profileSettings} onToggle={onToggle} />
    </SheetTile>
  );
}

export function VisibilityTile({ profileType, profileSettings, onToggle }) {
  return (
    <SheetTile
      icon={Globe}
      title="نمایش برای مشتری‌ها"
      state={profileSettings.publicPortfolio ? "صفحه‌ت عمومیه" : "صفحه‌ت خصوصیه"}
    >
      <ProfileVisibilitySettings bare profileType={profileType} profileSettings={profileSettings} onToggle={onToggle} />
    </SheetTile>
  );
}

export function ArtistBookingTile({ profileSettings, onToggle }) {
  return (
    <SheetTile
      icon={CalendarCheck}
      title="نوبت‌ها"
      state={profileSettings.vacationMode ? "مرخصی فعاله" : "نوبت می‌گیری"}
      kicker="تنظیمات آرتیست"
    >
      <ArtistBookingSettings bare profileSettings={profileSettings} onToggle={onToggle} />
    </SheetTile>
  );
}

/** The link and QR of the public page, to share (the same sheet as on the profile). */
export function PageLinkTile({ profile }) {
  const [open, setOpen] = useState(false);
  const path = `/${profile.type === "salon" ? "salons" : "artists"}/${Number(profile.id)}`;
  const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
  return (
    <>
      <button type="button" className="profileLocationRow" onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="profileLocationRowIcon" aria-hidden="true">
          <Link2 size={17} />
        </span>
        <span className="profileLocationRowInfo">
          <strong>لینک صفحه‌م</strong>
          <span>بفرست یا QR بده</span>
        </span>
        <ChevronLeft size={16} className="profileLocationRowChevron" aria-hidden="true" />
      </button>
      <ProfileQrCodeSheet open={open} url={url} name={profile.data?.name || "صفحه‌م"} onOpenChange={setOpen} />
    </>
  );
}
