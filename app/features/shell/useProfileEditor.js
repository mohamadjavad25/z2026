"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeProfile } from "../auth";

const DEFAULT_PROFILE_SETTINGS = {
  reservationAlerts: true,
  publicPortfolio: true,
  smartSuggestions: true,
  orderAlerts: true,
  shippingReady: true,
  showPrices: true
};

/**
 * Registered-profile editing: the edit-sheet open/avatar-draft state, the
 * "save profile edits" and "save location" requests, and the account
 * settings toggles shown in the profile settings sheet.
 *
 * Depends on pieces owned by useAuthSession (createdProfile, setCreatedProfile,
 * setProfileType, setProfileView, lockSession, writeAuthSession) — this hook
 * must be called after it, with its return values passed in.
 *
 * @param {{
 *   createdProfile?: { type?: string, data?: Record<string, unknown> } | null,
 *   setCreatedProfile: (profile: unknown) => void,
 *   setProfileType: (type: string) => void,
 *   setProfileView: (view: string) => void,
 *   setActiveTab?: (tab: string) => void,
 *   lockSession: () => void,
 *   writeAuthSession: (profile: unknown) => void,
 *   onNotice?: (msg: string) => void
 * }} options
 */
export function useProfileEditor({
  createdProfile = null,
  setCreatedProfile,
  setProfileType,
  setProfileView,
  setActiveTab,
  lockSession,
  writeAuthSession,
  onNotice
} = {}) {
  const notify = useCallback((message) => {
    if (typeof onNotice === "function" && message) onNotice(message);
  }, [onNotice]);

  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [profileEditAvatar, setProfileEditAvatar] = useState("");
  const [profileLocationSaving, setProfileLocationSaving] = useState(false);
  const [profileSettings, setProfileSettings] = useState(DEFAULT_PROFILE_SETTINGS);
  const settingsLoadedForId = useRef(null);

  useEffect(() => {
    const userId = createdProfile?.id;
    if (!userId || settingsLoadedForId.current === userId) return;
    settingsLoadedForId.current = userId;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/profile/settings");
        if (!response.ok) return;
        const payload = await response.json();
        if (!cancelled && payload?.settings) {
          setProfileSettings((current) => ({ ...current, ...payload.settings }));
        }
      } catch {
        // Keep defaults; the toggle itself will surface an error if the user acts on it.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [createdProfile?.id]);

  const updateRegisteredProfile = useCallback(async (event) => {
    event.preventDefault();
    if (!createdProfile) return;
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const nextPassword = String(data.password || "").trim();
    const confirmPassword = String(data.passwordConfirm || "").trim();
    const currentPassword = String(data.currentPassword || "").trim();
    if (nextPassword || confirmPassword) {
      if (!currentPassword) {
        notify("برای تغییر رمز، رمز فعلی را وارد کن.");
        return;
      }
      if (nextPassword.length < 8) {
        notify("رمز جدید باید حداقل ۸ کاراکتر باشد.");
        return;
      }
      if (nextPassword !== confirmPassword) {
        notify("تکرار رمز با رمز جدید یکی نیست.");
        return;
      }
    }
    // profileEditAvatar is seeded from createdProfile.data.avatar when the
    // sheet opens, which is now a /api/media/avatar/… URL (see publicUser()
    // in app/lib/auth.js), not the actual image — only a freshly-picked file
    // (a real "data:" URL from handleProfileAvatarUpload's FileReader) is a
    // genuine new avatar. Sending the URL back would overwrite the stored
    // image with that URL string, breaking it. Omit the field entirely when
    // nothing new was picked, so the server keeps the current avatar as-is.
    const nextAvatar = profileEditAvatar.startsWith("data:") ? profileEditAvatar : "";
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: createdProfile.type,
          data: {
            name: data.name,
            area: data.area,
            service: data.service || createdProfile.data.service || "",
            phone: data.phone,
            email: data.email,
            bio: data.bio ?? createdProfile.data.bio ?? "",
            experienceYears: data.experienceYears || createdProfile.data.experienceYears || "",
            managerName: data.managerName || createdProfile.data.managerName || "",
            password: nextPassword,
            currentPassword,
            ...(nextAvatar ? { avatar: nextAvatar } : {})
          }
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        notify(payload.error || "ویرایش ذخیره نشد.");
        return;
      }
      const profile = normalizeProfile(payload.profile);
      if (!profile) {
        notify("ویرایش ذخیره نشد.");
        return;
      }
      lockSession();
      writeAuthSession(profile);
      setCreatedProfile(profile);
      setProfileEditOpen(false);
      setProfileEditAvatar("");
      if (profile.type === "salon") {
        setProfileView("overview");
      }
      setActiveTab?.("settings");
      notify(nextPassword ? "اطلاعات و رمز عبور به‌روزرسانی شد." : "اطلاعات ثبت‌نام به‌روزرسانی شد.");
    } catch {
      notify("ویرایش انجام نشد؛ دوباره امتحان کن.");
    }
  }, [createdProfile, profileEditAvatar, lockSession, writeAuthSession, setCreatedProfile, setProfileView, setActiveTab, notify]);

  const saveProfileLocation = useCallback(async (nextArea) => {
    if (!createdProfile) return;
    const area = String(nextArea || "").trim();
    if (!area) {
      notify("لوکیشن را وارد کن.");
      return;
    }
    setProfileLocationSaving(true);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { area }
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        notify(payload.error || "ذخیره لوکیشن انجام نشد.");
        return;
      }
      const profile = normalizeProfile(payload.profile);
      if (!profile) {
        notify("ذخیره لوکیشن انجام نشد.");
        return;
      }
      lockSession();
      writeAuthSession(profile);
      setCreatedProfile(profile);
      setProfileType(profile.type);
      notify("لوکیشن ذخیره شد.");
    } catch {
      notify("ذخیره لوکیشن انجام نشد؛ دوباره امتحان کن.");
    } finally {
      setProfileLocationSaving(false);
    }
  }, [createdProfile, lockSession, writeAuthSession, setCreatedProfile, setProfileType, notify]);

  const openProfileEdit = useCallback(() => {
    setProfileEditAvatar(createdProfile?.data?.avatar || "");
    setProfileEditOpen(true);
  }, [createdProfile]);

  const handleProfileAvatarUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("فقط فایل تصویری مجاز است.");
      event.target.value = "";
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      notify("حجم تصویر باید کمتر از ۴ مگابایت باشد.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProfileEditAvatar(String(reader.result || ""));
    reader.readAsDataURL(file);
  }, [notify]);

  const [logoSaving, setLogoSaving] = useState(false);
  const [posterSaving, setPosterSaving] = useState(false);

  /**
   * Saves one profile.data field (avatar/poster dataURL or "" to remove,
   * avatarPosition/posterPosition as a CSS object-position string) and
   * folds the exact value we just sent into local/session state instead of
   * trusting the server's echoed profile for it.
   *
   * Why: avatar/poster are served from a URL that's stable per user
   * (/api/media/.../[userId]) — after a change the server still echoes
   * back that same URL string, so nothing downstream (ProfileHero,
   * BottomNav, Settings, ...) ever sees a different `src` to react to,
   * and the old image just keeps showing everywhere in this session
   * (reported: fixed in Settings but nowhere else, because that was the
   * one spot patched with its own local preview — this replaces that
   * with a fix at the shared profile state itself, so every consumer
   * picks it up at once). Patching the field locally sidesteps the stale
   * URL entirely for this session; the next real page load re-fetches
   * from the server, which is correct there too (see the ETag fix on
   * those two media routes).
   */
  const saveProfileFields = useCallback((fields, { setBusy, successMessage } = {}) => {
    if (!createdProfile) return;
    setBusy?.(true);
    return (async () => {
      try {
        const response = await fetch("/api/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: fields })
        });
        const payload = await response.json();
        if (!response.ok) {
          notify(payload.error || "ذخیره انجام نشد.");
          return;
        }
        const profile = normalizeProfile(payload.profile);
        if (!profile) {
          notify("ذخیره انجام نشد.");
          return;
        }
        if (profile.data) Object.assign(profile.data, fields);
        writeAuthSession(profile);
        setCreatedProfile(profile);
        if (successMessage) notify(successMessage);
      } catch {
        notify("ذخیره انجام نشد؛ دوباره امتحان کن.");
      } finally {
        setBusy?.(false);
      }
    })();
  }, [createdProfile, writeAuthSession, setCreatedProfile, notify]);

  const saveProfileField = useCallback((field, value, opts) => (
    saveProfileFields({ [field]: value }, opts)
  ), [saveProfileFields]);

  // A picked file doesn't save right away -- it's staged here so the
  // position editor opens immediately with the *new* image (not the old
  // stored one), and the actual upload + chosen focal point are sent to
  // the server together in one request once the user confirms there.
  const [pendingAvatarUpload, setPendingAvatarUpload] = useState("");
  const [pendingPosterUpload, setPendingPosterUpload] = useState("");

  const stageProfileImage = useCallback((file, setPending) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("فقط فایل تصویری مجاز است.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      notify("حجم تصویر باید کمتر از ۴ مگابایت باشد.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      if (dataUrl) setPending(dataUrl);
    };
    reader.readAsDataURL(file);
  }, [notify]);

  const saveProfileLogo = useCallback((event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    stageProfileImage(file, setPendingAvatarUpload);
  }, [stageProfileImage]);

  const saveProfilePoster = useCallback((event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    stageProfileImage(file, setPendingPosterUpload);
  }, [stageProfileImage]);

  const confirmAvatarUpload = useCallback((position) => {
    if (!pendingAvatarUpload) return;
    saveProfileFields(
      { avatar: pendingAvatarUpload, avatarPosition: position },
      { setBusy: setLogoSaving, successMessage: "لوگو بروزرسانی شد." }
    );
    setPendingAvatarUpload("");
  }, [pendingAvatarUpload, saveProfileFields]);

  const confirmPosterUpload = useCallback((position) => {
    if (!pendingPosterUpload) return;
    saveProfileFields(
      { poster: pendingPosterUpload, posterPosition: position },
      { setBusy: setPosterSaving, successMessage: "پوستر بروزرسانی شد." }
    );
    setPendingPosterUpload("");
  }, [pendingPosterUpload, saveProfileFields]);

  const removeProfileLogo = useCallback(() => {
    saveProfileField("avatar", "", { setBusy: setLogoSaving, successMessage: "لوگو حذف شد." });
  }, [saveProfileField]);

  const removeProfilePoster = useCallback(() => {
    saveProfileField("poster", "", { setBusy: setPosterSaving, successMessage: "پوستر حذف شد." });
  }, [saveProfileField]);

  const saveAvatarPosition = useCallback((position) => (
    saveProfileField("avatarPosition", position, { setBusy: setLogoSaving })
  ), [saveProfileField]);

  const savePosterPosition = useCallback((position) => (
    saveProfileField("posterPosition", position, { setBusy: setPosterSaving })
  ), [saveProfileField]);

  const toggleProfileSetting = useCallback((key) => {
    let nextValue = null;
    setProfileSettings((settings) => {
      nextValue = !settings[key];
      return { ...settings, [key]: nextValue };
    });
    fetch("/api/profile/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: { [key]: nextValue } })
    })
      .then(async (response) => {
        if (response.ok) return;
        const payload = await response.json().catch(() => ({}));
        setProfileSettings((settings) => ({ ...settings, [key]: !nextValue }));
        notify(payload.error || "ذخیره تنظیمات انجام نشد.");
      })
      .catch(() => {
        setProfileSettings((settings) => ({ ...settings, [key]: !nextValue }));
        notify("ذخیره تنظیمات انجام نشد؛ اتصال را بررسی کن.");
      });
  }, [notify]);

  return {
    profileEditOpen,
    setProfileEditOpen,
    profileEditAvatar,
    setProfileEditAvatar,
    profileLocationSaving,
    profileSettings,
    updateRegisteredProfile,
    saveProfileLocation,
    openProfileEdit,
    handleProfileAvatarUpload,
    toggleProfileSetting,
    logoSaving,
    posterSaving,
    saveProfileLogo,
    saveProfilePoster,
    removeProfileLogo,
    removeProfilePoster,
    saveAvatarPosition,
    savePosterPosition,
    pendingAvatarUpload,
    pendingPosterUpload,
    confirmAvatarUpload,
    confirmPosterUpload,
    cancelAvatarUpload: () => setPendingAvatarUpload(""),
    cancelPosterUpload: () => setPendingPosterUpload("")
  };
}
