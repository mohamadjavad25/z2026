"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronDown,
  EyeOff,
  Bell,
  BellOff,
  BellRing,
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
import { ExitPlanPanel } from "../exit/ExitPlanPanel";
import { CANCEL_ALL_AND_TEXT } from "../../shared/lib/providerRules";

const DELETE_CONFIRM_WORD = "حذف";

/**
 * Inline (not a separate modal) type-to-confirm gate for account deletion —
 * a single tap is too easy to hit by accident for something this
 * irreversible (see migration v34: the account and everything only it
 * owned is gone for good, though other users' own history with it is now
 * preserved). Requires literally typing "حذف" before the real action is
 * even clickable.
 */
function DeleteAccountConfirm({ onConfirm, onCancel, busy, error, exit = null, onExitPlan, onNotice }) {
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const matches = typed.trim() === DELETE_CONFIRM_WORD && password.length > 0;
  // A salon or artist with confirmed bookings: the list of what stands in the way (owner's rules of 2026-10-22).
  const stuck = Boolean(exit?.plan && (exit.plan.blocked || exit.plan.needsChoice));
  return (
    <div className="neoSettingsDeleteConfirm" role="alertdialog" aria-label="پاک کردن حساب">
      <div className="neoSettingsDeleteConfirmHead">
        <AlertTriangle size={16} />
        <b>این کار برگشت نداره</b>
      </div>
      <p>حسابت و هر چی فقط مال خودته برای همیشه پاک می‌شه. اگه مطمئنی، کلمهٔ «{DELETE_CONFIRM_WORD}» رو بنویس و رمزت رو بزن.</p>
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
        placeholder="رمز فعلیت"
        disabled={busy}
      />
      {error ? <p className="neoSettingsDeleteConfirmError">{error}</p> : null}
      {exit?.plan ? (
        <ExitPlanPanel
          plan={exit.plan}
          scope="account"
          message={exit.message}
          busy={busy}
          onPlan={onExitPlan}
          onNotice={onNotice}
          onConfirm={matches ? ({ cancelAll }) => onConfirm(password, { cancelAll }) : null}
        />
      ) : null}
      {exit?.plan && exit.plan.needsChoice && !matches ? <p className="neoSettingsDeleteConfirmError">برای «{CANCEL_ALL_AND_TEXT}» اول کلمهٔ «{DELETE_CONFIRM_WORD}» و رمزت رو بنویس.</p> : null}
      <div className="neoSettingsDeleteConfirmActions">
        <button type="button" onClick={onCancel} disabled={busy}>
          <X size={15} />
          انصراف
        </button>
        <button type="button" className="is-danger" disabled={!matches || busy || stuck} onClick={() => onConfirm(password)}>
          <Trash2 size={15} />
          {busy ? "دارم پاک می‌کنم…" : "پاکش کن"}
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

/**
 * In-app alerts, appointment reminders (clients; artists set theirs under booking controls) and the sound. The
 * «reservationAlerts» switch only governs what shows inside the open app: the phone notification and SMS about a
 * booking always go (audit 2026-10-22: the old label promised more than it did).
 */
export function NotificationSettings({ profileType, profileSettings, onToggle }) {
  const [soundOn, setSoundOn] = useSoundPreference();
  return (
    <SettingsGroup title="اعلان‌ها">
      <SettingsToggle
        icon={profileSettings.reservationAlerts ? Bell : BellOff}
        label="خبرهای داخل اپ"
        description={profileType === "client"
          ? "وقتی اپ بازه: پیام بالای صفحه و زنگ نیم ساعت قبل از نوبت. خبر تأیید و لغو نوبت همیشه روی گوشی میاد."
          : "وقتی اپ بازه: پیام بالای صفحه برای درخواست تازه، تأیید و لغو. خبر درخواست تازه همیشه روی گوشی میاد."}
        checked={profileSettings.reservationAlerts}
        onChange={() => onToggle("reservationAlerts")}
      />
      {profileType === "client" && (
        <SettingsToggle
          icon={profileSettings.reminders ? BellRing : BellOff}
          label="یادآوری نوبت"
          description="یه روز و دو ساعت قبل از هر نوبت"
          checked={profileSettings.reminders !== false}
          onChange={() => onToggle("reminders")}
        />
      )}
      <SettingsToggle
        icon={soundOn ? Volume2 : VolumeX}
        label="صدای اعلان‌ها"
        description="روی همین گوشی، برای خبرها و یادآوری‌ها"
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
        label={profileType === "artist" ? "صفحه‌م برای همه" : "صفحهٔ سالن برای همه"}
        description={profileType === "artist" ? "مشتری‌ها کارها و خدمت‌هات رو ببینن و نوبت بگیرن" : "مشتری‌ها خدمت‌ها، کارها و تیمت رو ببینن و نوبت بگیرن"}
        checked={profileSettings.publicPortfolio}
        onChange={() => onToggle("publicPortfolio")}
        onLabel="عمومی"
        offLabel="خصوصی"
      />
      {profileType === "artist" ? (
        <SettingsToggle
          icon={Tag}
          label="نمایش قیمت‌ها"
          description="قیمت‌ها توی صفحه‌ت دیده بشه؛ وگرنه «زنگ بزن»"
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
    <SettingsGroup title="نوبت‌ها">
      <SettingsToggle
        icon={Moon}
        label="حالت مرخصی"
        description="فعلاً نوبت تازه نگیر؛ صفحه‌ت سر جاش می‌مونه"
        checked={Boolean(profileSettings.vacationMode)}
        onChange={() => onToggle("vacationMode")}
        onLabel="فعال"
        offLabel="خاموش"
      />
      <SettingsToggle
        icon={CalendarCheck}
        label="نوبت مستقیم"
        description="مشتری از صفحه‌ت یه‌راست نوبت بگیره"
        checked={Boolean(profileSettings.directBooking)}
        onChange={() => onToggle("directBooking")}
      />
      <SettingsToggle
        icon={Briefcase}
        label="تأیید سریع نوبت"
        description="نوبت‌های تازه خودشون تأیید بشن"
        checked={Boolean(profileSettings.autoConfirm)}
        onChange={() => onToggle("autoConfirm")}
      />
      <SettingsToggle
        icon={Bell}
        label="یادآوری مشتری"
        description="یه روز و دو ساعت قبل از هر نوبت، به مشتری یادآوری می‌ره"
        checked={Boolean(profileSettings.reminders)}
        onChange={() => onToggle("reminders")}
      />
    </SettingsGroup>
  );
}

/** Support, legal pages, sign-out and account deletion. Always the last section. */
export function AccountSettings({ onLogout, onDeleteAccount, onNotice }) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteExit, setDeleteExit] = useState(null);

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
        <span>خروج</span>
      </button>

      {onDeleteAccount ? (
        deleteConfirmOpen ? (
          <DeleteAccountConfirm
            busy={deleteBusy}
            error={deleteError}
            exit={deleteExit}
            onExitPlan={(plan) => setDeleteExit((current) => ({ ...(current || {}), plan }))}
            onNotice={onNotice}
            onCancel={() => {
              setDeleteConfirmOpen(false);
              setDeleteError("");
              setDeleteExit(null);
            }}
            onConfirm={async (password, options) => {
              setDeleteBusy(true);
              setDeleteError("");
              const result = await onDeleteAccount(password, options);
              setDeleteBusy(false);
              if (result && result.ok === false) {
                if (result.plan) {
                  // Confirmed bookings stand in the way: show them (the account is not deleted).
                  setDeleteExit({ plan: result.plan, message: result.error });
                } else {
                  setDeleteError(result.error || "رمز اشتباهه.");
                }
              }
            }}
          />
        ) : (
          <button type="button" className="neoSettingsDelete" onClick={() => setDeleteConfirmOpen(true)}>
            <Trash2 size={16} />
            <span>پاک کردن حساب</span>
          </button>
        )
      ) : null}
    </>
  );
}
