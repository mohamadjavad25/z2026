"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronDown,
  EyeOff,
  Bell,
  BellOff,
  CalendarCheck,
  LogOut,
  Globe,
  Lock,
  Moon,
  Tag,
  Briefcase,
  Trash2,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import { useSoundPreference } from "../../shared/lib/useSoundPreference";
import { playSound } from "../../shared/lib/sounds";

const DELETE_CONFIRM_WORD = "حذف";

/**
 * Inline (not a separate modal) type-to-confirm gate for account deletion —
 * a single tap is too easy to hit by accident for something this
 * irreversible (see migration v34: the account and everything only it
 * owned is gone for good, though other users' own history with it is now
 * preserved). Requires literally typing "حذف" before the real action is
 * even clickable.
 */
function DeleteAccountConfirm({ onConfirm, onCancel, busy, error }) {
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const matches = typed.trim() === DELETE_CONFIRM_WORD && password.length > 0;
  return (
    <div className="neoSettingsDeleteConfirm" role="alertdialog" aria-label="تایید حذف حساب">
      <div className="neoSettingsDeleteConfirmHead">
        <AlertTriangle size={16} />
        <b>این کار برگشت‌ناپذیر است</b>
      </div>
      <p>حساب و اطلاعاتی که فقط متعلق به خودت است برای همیشه حذف می‌شود. برای تایید، کلمه «{DELETE_CONFIRM_WORD}» را تایپ کن و رمز عبور فعلی‌ات را وارد کن.</p>
      <input
        type="text"
        inputMode="text"
        autoComplete="off"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder={DELETE_CONFIRM_WORD}
        disabled={busy}
      />
      <input
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="رمز عبور فعلی"
        disabled={busy}
      />
      {error ? <p className="neoSettingsDeleteConfirmError">{error}</p> : null}
      <div className="neoSettingsDeleteConfirmActions">
        <button type="button" onClick={onCancel} disabled={busy}>
          <X size={15} />
          انصراف
        </button>
        <button type="button" className="is-danger" disabled={!matches || busy} onClick={() => onConfirm(password)}>
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
  const [soundOn, setSoundOn] = useSoundPreference();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  const commonToggles = (
    <SettingsGroup title={profileType === "artist" ? "کنترل تجربه مشتری" : profileType === "client" ? "اعلان‌ها" : "عمومی"}>
      <SettingsToggle
        icon={profileSettings.reservationAlerts ? Bell : BellOff}
        label={profileType === "artist" ? "اعلان رزرو" : profileType === "salon" ? "اعلان رزرو و تیم" : "اعلان رزرو"}
        description={profileType === "artist" ? "درخواست نوبت جدید، تایید یا لغو و انقضای نوبت" : profileType === "salon" ? "رزرو جدید، جابه‌جایی نوبت و انقضای درخواست" : "تایید، لغو یا انقضای نوبتی که رزرو کردی"}
        checked={profileSettings.reservationAlerts}
        onChange={() => onToggle("reservationAlerts")}
      />
      <SettingsToggle
        icon={soundOn ? Volume2 : VolumeX}
        label="صدای اعلان‌ها"
        description="روی همین دستگاه برای اعلان، نوبت‌ها و یادآوری پخش شود"
        checked={soundOn}
        onChange={(value) => {
          setSoundOn(value);
          if (value) window.setTimeout(() => playSound("notify"), 60);
        }}
        onLabel="روشن"
        offLabel="خاموش"
      />
    </SettingsGroup>
  );

  const profileTypeToggle = profileType === "artist" ? (
    <>
      <SettingsToggle
        icon={profileSettings.publicPortfolio ? Globe : Lock}
        label="ویترین عمومی آرتیست"
        description="نمونه‌کار، خدمات و مسیر رزرو برای مشتری‌ها"
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

      <div className="neoSettingsLegalLinks">
        <Link href="/terms">قوانین و مقررات</Link>
        <Link href="/privacy">حریم خصوصی</Link>
      </div>

      <button type="button" className="neoSettingsLogout" onClick={onLogout}>
        <LogOut size={16} />
        <span>خروج از حساب</span>
      </button>

      {onDeleteAccount ? (
        deleteConfirmOpen ? (
          <DeleteAccountConfirm
            busy={deleteBusy}
            error={deleteError}
            onCancel={() => {
              setDeleteConfirmOpen(false);
              setDeleteError("");
            }}
            onConfirm={async (password) => {
              setDeleteBusy(true);
              setDeleteError("");
              const result = await onDeleteAccount(password);
              setDeleteBusy(false);
              if (result && result.ok === false) {
                setDeleteError(result.error || "رمز عبور اشتباه است.");
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
