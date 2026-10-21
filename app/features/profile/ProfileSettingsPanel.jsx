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
  Monitor,
  Moon,
  Sun,
  Tag,
  Briefcase,
  Trash2,
  Volume2,
  VolumeX,
  X
} from "lucide-react";
import { useSoundPreference } from "../../shared/lib/useSoundPreference";
import { APP_DOWNLOADS_OPEN } from "../landing/constants";
import { useThemePreference } from "../../shared/lib/useThemePreference";
import { playSound } from "../../shared/lib/sounds";
import { openSupport } from "../support";

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

const THEME_CHOICES = [
  { value: "auto", label: "خودکار", icon: Monitor },
  { value: "light", label: "روز", icon: Sun },
  { value: "dark", label: "شب", icon: Moon }
];

/** Day / night / follow-the-device, saved on this device only. */
function ThemePicker() {
  const [preference, setPreference] = useThemePreference();
  return (
    <div className="neoThemePick" role="radiogroup" aria-label="ظاهر برنامه">
      {THEME_CHOICES.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={preference === value}
          className={preference === value ? "is-on" : ""}
          onClick={() => setPreference(value)}
        >
          <Icon size={18} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
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

/*
 * The settings page (features/settings/SettingsPage.jsx) places each of these
 * in its own section, so they are exported separately instead of as one panel.
 */

/** Day / night / auto theme picker. */
export function AppearanceSettings() {
  return (
    <SettingsGroup title="ظاهر برنامه">
      <ThemePicker />
    </SettingsGroup>
  );
}

/** Reservation alerts and notification sound. Every account type has these. */
export function NotificationSettings({ profileType, profileSettings, onToggle }) {
  const [soundOn, setSoundOn] = useSoundPreference();
  return (
    <SettingsGroup title="اعلان‌ها">
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
}

/**
 * What customers can see of an artist or salon. Clients have no public
 * profile, so for them this renders nothing.
 */
export function ProfileVisibilitySettings({ profileType, profileSettings, onToggle }) {
  if (profileType !== "artist" && profileType !== "salon") return null;
  return (
    <SettingsGroup title="نمایش برای مشتری‌ها">
      <SettingsToggle
        icon={profileSettings.publicPortfolio ? Globe : Lock}
        label={profileType === "artist" ? "ویترین عمومی آرتیست" : "پروفایل عمومی سالن"}
        description={profileType === "artist" ? "نمونه‌کار، خدمات و مسیر رزرو برای مشتری‌ها" : "خدمات، نمونه‌کارها، تیم و ظرفیت رزرو برای مشتری‌ها"}
        checked={profileSettings.publicPortfolio}
        onChange={() => onToggle("publicPortfolio")}
        onLabel="عمومی"
        offLabel="خصوصی"
      />
      {profileType === "artist" ? (
        <SettingsToggle
          icon={Tag}
          label="نمایش قیمت‌ها"
          description="قیمت خدمات در پروفایل عمومی نشان داده شود، وگرنه «تماس بگیرید»"
          checked={Boolean(profileSettings.showPrices)}
          onChange={() => onToggle("showPrices")}
          onLabel="نمایش"
          offLabel="مخفی"
        />
      ) : null}
    </SettingsGroup>
  );
}

/** Artist booking capacity: vacation mode, direct booking, instant confirm and reminders. */
export function ArtistBookingSettings({ profileSettings, onToggle }) {
  return (
    <SettingsGroup title="رزرو و ظرفیت کاری">
      <SettingsToggle
        icon={Moon}
        label="حالت مرخصی"
        description="نوبت‌گیری جدید موقتاً بسته شود، بدون خصوصی کردن پروفایل"
        checked={Boolean(profileSettings.vacationMode)}
        onChange={() => onToggle("vacationMode")}
        onLabel="فعال"
        offLabel="خاموش"
      />
      <SettingsToggle
        icon={CalendarCheck}
        label="رزرو مستقیم"
        description="مشتری از پروفایل عمومی بدون واسطه وقت بگیرد"
        checked={Boolean(profileSettings.directBooking)}
        onChange={() => onToggle("directBooking")}
      />
      <SettingsToggle
        icon={Briefcase}
        label="تأیید سریع نوبت"
        description="نوبت‌های جدید بدون بررسی دستی تایید شوند"
        checked={Boolean(profileSettings.autoConfirm)}
        onChange={() => onToggle("autoConfirm")}
      />
      <SettingsToggle
        icon={Bell}
        label="یادآوری مشتری"
        description="یک روز و دو ساعت قبل از هر نوبت تأییدشده، برای مشتری اعلان یادآوری می‌رود"
        checked={Boolean(profileSettings.reminders)}
        onChange={() => onToggle("reminders")}
      />
    </SettingsGroup>
  );
}

/** Support, legal pages, sign-out and account deletion. Always the last section. */
export function AccountSettings({ onLogout, onDeleteAccount }) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  return (
    <>
      <div className="neoSettingsLegalLinks">
        <button type="button" onClick={() => openSupport()}>ارتباط با پشتیبانی</button>
        <Link href="/terms">قوانین و مقررات</Link>
        <Link href="/privacy">حریم خصوصی</Link>
        {APP_DOWNLOADS_OPEN ? <a className="webOnlyAppLink" href="/download">دانلود اپلیکیشن</a> : null}
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
    </>
  );
}
