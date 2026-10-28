"use client";

import { Bell, CalendarCheck, ChevronLeft, Globe, Moon } from "lucide-react";
import { useState } from "react";
import { useThemePreference } from "../../shared/lib/useThemePreference";
import { ProfileSheet } from "../profile/ProfileSheet";
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
export function TileSlot({ id, pending = false, children }) {
  return (
    <div className={`spTileSlot${pending ? " has-todo" : ""}`} data-todo-slot={id}>
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

const THEME_STATE = { auto: "خودکار", light: "روز", dark: "شب" };

export function AppearanceTile() {
  const [preference] = useThemePreference();
  return (
    <SheetTile icon={Moon} title="ظاهر برنامه" state={THEME_STATE[preference] || "خودکار"}>
      <AppearanceSettings bare />
    </SheetTile>
  );
}

export function NotificationsTile({ profileType, profileSettings, onToggle }) {
  return (
    <SheetTile icon={Bell} title="اعلان‌ها" state={profileSettings.reservationAlerts ? "روشن" : "خاموش"}>
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
