"use client";

import { useState } from "react";
import {
  AlertTriangle,
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
  Tag,
  Briefcase,
  Trash2,
  X
} from "lucide-react";

const DELETE_CONFIRM_WORD = "حذف";

/**
 * Inline (not a separate modal) type-to-confirm gate for account deletion —
 * a single tap is too easy to hit by accident for something this
 * irreversible (see migration v34: the account and everything only it
 * owned is gone for good, though other users' own history with it is now
 * preserved). Requires literally typing "حذف" before the real action is
 * even clickable.
 */
function DeleteAccountConfirm({ onConfirm, onCancel, busy }) {
  const [typed, setTyped] = useState("");
  const matches = typed.trim() === DELETE_CONFIRM_WORD;
  return (
    <div className="neoSettingsDeleteConfirm" role="alertdialog" aria-label="تایید حذف حساب">
      <div className="neoSettingsDeleteConfirmHead">
        <AlertTriangle size={16} />
        <b>این کار برگشت‌ناپذیر است</b>
      </div>
      <p>حساب و اطلاعاتی که فقط متعلق به خودت است برای همیشه حذف می‌شود. برای تایید، کلمه «{DELETE_CONFIRM_WORD}» را تایپ کن.</p>
      <input
        type="text"
        inputMode="text"
        autoComplete="off"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={DELETE_CONFIRM_WORD}
        disabled={busy}
      />
      <div className="neoSettingsDeleteConfirmActions">
        <button type="button" onClick={onCancel} disabled={busy}>
          <X size={15} />
          انصراف
        </button>
        <button type="button" className="is-danger" disabled={!matches || busy} onClick={onConfirm}>
          <Trash2 size={15} />
          {busy ? "در حال حذف…" : "تایید حذف حساب"}
        </button>
      </div>
    </div>
  );
}

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
  onLogout,
  onDeleteAccount
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const commonToggles = (
    <SettingsGroup title={profileType === "artist" ? "کنترل تجربه مشتری" : "عمومی"}>
      <SettingsToggle
        icon={profileSettings.reservationAlerts ? Bell : BellOff}
        label={profileType === "artist" ? "اعلان رزرو" : profileType === "salon" ? "اعلان رزرو و تیم" : "اعلان رزرو"}
        description={profileType === "artist" ? "درخواست نوبت جدید، تایید یا لغو و انقضای نوبت" : profileType === "salon" ? "رزرو جدید، جابه‌جایی نوبت و انقضای درخواست" : "تایید، لغو یا انقضای نوبتی که رزرو کردی"}
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
  ) : null;

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

  return (
    <div className="neoSettingsPanel">
      {commonToggles}

      {profileTypeToggle ? (
        <SettingsGroup title={
          profileType === "artist" ? "پروفایل آرتیست"
          : profileType === "salon" ? "سالن"
          : "ترجیحات"
        }>
          {profileTypeToggle}
        </SettingsGroup>
      ) : null}

      {artistBooking}

      <button type="button" className="neoSettingsLogout" onClick={onLogout}>
        <LogOut size={16} />
        <span>خروج از حساب</span>
      </button>

      {onDeleteAccount ? (
        deleteConfirmOpen ? (
          <DeleteAccountConfirm
            busy={deleteBusy}
            onCancel={() => setDeleteConfirmOpen(false)}
            onConfirm={async () => {
              setDeleteBusy(true);
              try {
                await onDeleteAccount();
              } finally {
                setDeleteBusy(false);
              }
            }}
          />
        ) : (
          <button type="button" className="neoSettingsDelete" onClick={() => setDeleteConfirmOpen(true)}>
            <Trash2 size={16} />
            <span>حذف حساب</span>
          </button>
        )
      ) : null}
    </div>
  );
}
