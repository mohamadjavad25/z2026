"use client";

import { useState } from "react";
import {
  ChevronDown,
  EyeOff,
  Bell,
  BellOff,
  Sparkles,
  CalendarCheck,
  LogOut,
  Globe,
  Lock,
  Moon,
  Palette,
  Store,
  Tag,
  Briefcase,
  Package,
  Truck
} from "lucide-react";

function SettingsToggle({ icon: Icon, label, description, checked, onChange, onLabel, offLabel }) {
  return (
    <label className="neoSettingsToggle">
      <span className="neoSettingsToggleIcon">
        <Icon size={16} />
      </span>
      <span className="neoSettingsToggleCopy">
        <b>{label}</b>
        <small>{description}</small>
      </span>
      <span className="neoSettingsSwitch" data-on={checked}>
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="neoSettingsSwitchTrack">
          <span className="neoSettingsSwitchKnob" />
        </span>
        <span className="neoSettingsSwitchLabel">
          {checked ? (onLabel || "روشن") : (offLabel || "خاموش")}
        </span>
      </span>
    </label>
  );
}

function SettingsGroup({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`neoSettingsGroup ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="neoSettingsGroupHead"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span>{title}</span>
        <ChevronDown size={15} className="neoSettingsGroupChev" />
      </button>
      {open && <div className="neoSettingsGroupBody">{children}</div>}
    </div>
  );
}

export function ProfileSettingsPanel({
  profileType,
  profileSettings,
  onToggle,
  artistBookingSettings,
  onArtistBookingChange,
  onLogout
}) {
  const shopMainToggles = profileType === "shop" ? (
    <SettingsGroup title="نمایش فروشگاه">
      <SettingsToggle
        icon={profileSettings.publicPortfolio ? Store : Lock}
        label="ویترین عمومی فروشگاه"
        description="محصولات، قیمت و موجودی برای مشتری‌ها نمایش داده شود"
        checked={profileSettings.publicPortfolio}
        onChange={() => onToggle("publicPortfolio")}
        onLabel="عمومی"
        offLabel="خصوصی"
      />
    </SettingsGroup>
  ) : null;

  const commonToggles = profileType === "shop" ? null : (
    <SettingsGroup title={profileType === "artist" ? "کنترل تجربه مشتری" : "عمومی"}>
      <SettingsToggle
        icon={profileSettings.reservationAlerts ? Bell : BellOff}
        label={profileType === "artist" ? "اعلان رزرو و پیام" : profileType === "salon" ? "اعلان رزرو و تیم" : "اعلان رزرو"}
        description={profileType === "artist" ? "رزرو مستقیم، پیام مشتری و تغییر وضعیت پرداخت" : profileType === "salon" ? "رزرو جدید، جابه‌جایی نوبت و پیام مشتری" : "رزرو، پیام سالن و وضعیت پرداخت"}
        checked={profileSettings.reservationAlerts}
        onChange={() => onToggle("reservationAlerts")}
      />
      <SettingsToggle
        icon={Sparkles}
        label={profileType === "artist" ? "پیشنهاد رشد پروفایل" : profileType === "salon" ? "پیشنهاد رشد سالن" : "پیشنهاد هوشمند"}
        description={profileType === "artist" ? "ایده نمونه‌کار، قیمت‌گذاری و جذب مشتری بهتر" : profileType === "salon" ? "بهبود خدمات، ظرفیت، قیمت و محتوای سالن" : "مدل، سالن و پیشنهادهای شخصی"}
        checked={profileSettings.smartSuggestions}
        onChange={() => onToggle("smartSuggestions")}
      />
    </SettingsGroup>
  );

  const profileTypeToggle = profileType === "artist" ? (
    <>
      <SettingsToggle
        icon={profileSettings.publicPortfolio ? Globe : Lock}
        label="ویترین عمومی آرتیست"
        description="نمونه‌کار، خدمات، امتیاز و مسیر رزرو برای مشتری‌ها"
        checked={profileSettings.publicPortfolio}
        onChange={() => onToggle("publicPortfolio")}
        onLabel="عمومی"
        offLabel="خصوصی"
      />
      <SettingsToggle
        icon={Tag}
        label="نمایش قیمت‌ها"
        description="قیمت خدمات در پروفایل عمومی نشان داده شود، وگرنه «تماس بگیرید»"
        checked={Boolean(profileSettings.showPrices)}
        onChange={() => onToggle("showPrices")}
        onLabel="نمایش"
        offLabel="مخفی"
      />
    </>
  ) : profileType === "salon" ? (
    <SettingsToggle
      icon={profileSettings.publicPortfolio ? Globe : Lock}
      label="پروفایل عمومی سالن"
      description="خدمات، نمونه‌کارها، تیم و ظرفیت رزرو برای مشتری‌ها"
      checked={profileSettings.publicPortfolio}
      onChange={() => onToggle("publicPortfolio")}
      onLabel="عمومی"
      offLabel="خصوصی"
    />
  ) : (
    <SettingsToggle
      icon={Palette}
      label="ترجیحات زیبایی"
      description="سبک‌ها، پوست، مو و مدل‌های ذخیره‌شده"
      checked={false}
      onChange={() => {}}
    />
  );

  const artistBooking = profileType === "artist" && artistBookingSettings ? (
    <SettingsGroup title="رزرو و ظرفیت کاری">
      <SettingsToggle
        icon={Moon}
        label="حالت مرخصی"
        description="نوبت‌گیری جدید موقتاً بسته شود، بدون خصوصی کردن پروفایل"
        checked={Boolean(artistBookingSettings.vacationMode)}
        onChange={(v) => onArtistBookingChange?.({ ...artistBookingSettings, vacationMode: v })}
        onLabel="فعال"
        offLabel="خاموش"
      />
      <SettingsToggle
        icon={CalendarCheck}
        label="رزرو مستقیم"
        description="مشتری از پروفایل عمومی بدون واسطه وقت بگیرد"
        checked={artistBookingSettings.directBooking}
        onChange={(v) => onArtistBookingChange?.({ ...artistBookingSettings, directBooking: v })}
      />
      <SettingsToggle
        icon={Briefcase}
        label="تأیید سریع نوبت"
        description="نوبت‌های جدید بدون بررسی دستی تایید شوند"
        checked={artistBookingSettings.autoConfirm}
        onChange={(v) => onArtistBookingChange?.({ ...artistBookingSettings, autoConfirm: v })}
      />
      <SettingsToggle
        icon={Bell}
        label="یادآوری مشتری"
        description="قبل از زمان نوبت برای مشتری یادآوری ارسال شود"
        checked={artistBookingSettings.reminders}
        onChange={(v) => onArtistBookingChange?.({ ...artistBookingSettings, reminders: v })}
      />
    </SettingsGroup>
  ) : null;

  const shopOps = profileType === "shop" ? (
    <SettingsGroup title="سفارش و ارسال">
      <SettingsToggle
        icon={profileSettings.orderAlerts ? Package : BellOff}
        label="اعلان سفارش و پیام"
        description="سفارش جدید، پیام مشتری و پرداخت موفق"
        checked={Boolean(profileSettings.orderAlerts)}
        onChange={() => onToggle("orderAlerts")}
      />
      <SettingsToggle
        icon={Truck}
        label="آمادگی ارسال"
        description="نمایش وضعیت ارسال در ویترین و سفارش"
        checked={Boolean(profileSettings.shippingReady)}
        onChange={() => onToggle("shippingReady")}
        onLabel="فعال"
        offLabel="خاموش"
      />
    </SettingsGroup>
  ) : null;

  return (
    <div className="neoSettingsPanel">
      {shopMainToggles}
      {commonToggles}

      {profileType === "shop" ? null : (
        <SettingsGroup title={
          profileType === "artist" ? "پروفایل آرتیست"
          : profileType === "salon" ? "سالن"
          : "ترجیحات"
        }>
          {profileTypeToggle}
        </SettingsGroup>
      )}

      {artistBooking}
      {shopOps}

      <button type="button" className="neoSettingsLogout" onClick={onLogout}>
        <LogOut size={16} />
        <span>خروج از حساب</span>
      </button>
    </div>
  );
}
