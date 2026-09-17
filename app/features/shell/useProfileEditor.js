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
 * setProfileType, setProfileView, lockSession, writeAuthSession) and by
 * useSalonWorkspace (setSalonHeroSheet) — this hook must be called after both,
 * with their return values passed in.
 *
 * @param {{
 *   createdProfile?: { type?: string, data?: Record<string, unknown> } | null,
 *   setCreatedProfile: (profile: unknown) => void,
 *   setProfileType: (type: string) => void,
 *   setProfileView: (view: string) => void,
 *   setSalonHeroSheet: (sheet: unknown) => void,
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
  setSalonHeroSheet,
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
            avatar: profileEditAvatar || createdProfile.data.avatar || ""
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
        setSalonHeroSheet("settings");
      } else {
        setProfileView("settings");
      }
      notify(nextPassword ? "اطلاعات و رمز عبور به‌روزرسانی شد." : "اطلاعات ثبت‌نام به‌روزرسانی شد.");
    } catch {
      notify("ویرایش انجام نشد؛ دوباره امتحان کن.");
    }
  }, [createdProfile, profileEditAvatar, lockSession, writeAuthSession, setCreatedProfile, setProfileView, setSalonHeroSheet, notify]);

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
    toggleProfileSetting
  };
}
