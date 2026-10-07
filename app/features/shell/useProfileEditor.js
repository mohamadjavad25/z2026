"use client";

import { apiFetch } from "../../shared/api/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeProfile } from "../auth";
import { compressImageToDataUrl } from "../../shared/lib/imageCompression";

const DEFAULT_PROFILE_SETTINGS = {
  reservationAlerts: true,
  publicPortfolio: true,
  smartSuggestions: true,
  orderAlerts: true,
  shippingReady: true,
  showPrices: true,
  vacationMode: false,
  directBooking: true,
  autoConfirm: false,
  reminders: true
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
  const [profileSaving, setProfileSaving] = useState(false);
  const profileSavingRef = useRef(false);
  const [profileSettings, setProfileSettings] = useState(DEFAULT_PROFILE_SETTINGS);
  const settingsLoadedForId = useRef(null);
  // Mirror of profileSettings readable synchronously, so a toggle can compute
  // its next value *before* sending (a setState updater runs later, not inline).
  const settingsRef = useRef(DEFAULT_PROFILE_SETTINGS);
  const settingsSaveChain = useRef(new Map());

  useEffect(() => {
    const userId = createdProfile?.id;
    if (!userId || settingsLoadedForId.current === userId) return;
    settingsLoadedForId.current = userId;
    let cancelled = false;
    (async () => {
      try {
        const { ok, payload } = await apiFetch("/api/profile/settings");
        if (!ok) return;
        const settings = payload?.data?.settings;
        if (!cancelled && settings) {
          const merged = { ...settingsRef.current, ...settings };
          settingsRef.current = merged;
          setProfileSettings(merged);
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
    if (!createdProfile || profileSavingRef.current) return;
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
    profileSavingRef.current = true;
    setProfileSaving(true);
    try {
      // Only send what has a value: an empty password/phone/etc. used to be
      // sent as "" and the server's validation rejected the whole save
      // (password min length, phone format), so saving anything failed.
      const text = (value) => String(value ?? "").trim();
      const fields = {
        name: text(data.name),
        area: text(data.area),
        service: text(data.service) || text(createdProfile.data.service),
        phone: text(data.phone),
        email: text(data.email),
        bio: text(data.bio ?? createdProfile.data.bio),
        experienceYears: text(data.experienceYears) || text(createdProfile.data.experienceYears),
        managerName: text(data.managerName) || text(createdProfile.data.managerName),
        password: nextPassword,
        currentPassword
      };
      const body = { type: createdProfile.type, data: {} };
      for (const [key, value] of Object.entries(fields)) {
        if (value !== "" || key === "email") body.data[key] = value;
      }
      if (nextAvatar) body.data.avatar = nextAvatar;
      const { ok, payload } = await apiFetch("/api/profile", {
        method: "POST",
        body: JSON.stringify(body)
      });
      if (!ok) {
        notify(payload.error || "ویرایش ذخیره نشد.");
        return;
      }
      const profile = normalizeProfile(payload.data?.user);
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
    } finally {
      profileSavingRef.current = false;
      setProfileSaving(false);
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
      const { ok, payload } = await apiFetch("/api/profile", {
        method: "POST",
        body: JSON.stringify({
          data: { area }
        })
      });
      if (!ok) {
        notify(payload.error || "ذخیره لوکیشن انجام نشد.");
        return;
      }
      const profile = normalizeProfile(payload.data?.user);
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

  const handleProfileAvatarUpload = useCallback(async (event) => {
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
    // Downscale + re-encode before it ever becomes a data URL sent to the
    // server -- see imageCompression.js for why (a multi-MB phone photo
    // otherwise gets base64-encoded and POSTed essentially as-is).
    setProfileEditAvatar(await compressImageToDataUrl(file));
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
        const { ok, payload } = await apiFetch("/api/profile", {
          method: "POST",
          body: JSON.stringify({ data: fields })
        });
        if (!ok) {
          notify(payload.error || "ذخیره انجام نشد.");
          return;
        }
        const profile = normalizeProfile(payload.data?.user);
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

  const stageProfileImage = useCallback(async (file, setPending) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("فقط فایل تصویری مجاز است.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      notify("حجم تصویر باید کمتر از ۴ مگابایت باشد.");
      return;
    }
    // Same downscale-before-upload as handleProfileAvatarUpload above --
    // this is the path confirmAvatarUpload/confirmPosterUpload eventually
    // POST to the server, so this is where the real payload-size win
    // happens for the logo/poster position-editor flow.
    const dataUrl = await compressImageToDataUrl(file);
    if (dataUrl) setPending(dataUrl);
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

  // One-step logo change (used by the profile checklist): pick -> compress ->
  // save with a centered focal point. No edit form, no other field required.
  const quickSetLogo = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      notify("فقط فایل تصویری مجاز است.");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      notify("حجم تصویر باید کمتر از ۴ مگابایت باشد.");
      return;
    }
    const dataUrl = await compressImageToDataUrl(file);
    if (!dataUrl) {
      notify("خواندن تصویر انجام نشد؛ عکس دیگری امتحان کن.");
      return;
    }
    await saveProfileFields(
      { avatar: dataUrl, avatarPosition: "50% 50%" },
      { setBusy: setLogoSaving, successMessage: "لوگو بروزرسانی شد." }
    );
  }, [saveProfileFields, notify]);

  const confirmAvatarUpload = useCallback((position, croppedImage) => {
    if (!pendingAvatarUpload) return;
    saveProfileFields(
      { avatar: croppedImage || pendingAvatarUpload, avatarPosition: position },
      { setBusy: setLogoSaving, successMessage: "لوگو بروزرسانی شد." }
    );
    setPendingAvatarUpload("");
  }, [pendingAvatarUpload, saveProfileFields]);

  const confirmPosterUpload = useCallback((position, croppedImage) => {
    if (!pendingPosterUpload) return;
    saveProfileFields(
      { poster: croppedImage || pendingPosterUpload, posterPosition: position },
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

  const saveAvatarPosition = useCallback((position, croppedImage) => (
    saveProfileFields(
      croppedImage ? { avatar: croppedImage, avatarPosition: position } : { avatarPosition: position },
      { setBusy: setLogoSaving, successMessage: "لوگو بروزرسانی شد." }
    )
  ), [saveProfileFields]);

  const savePosterPosition = useCallback((position, croppedImage) => (
    saveProfileFields(
      croppedImage ? { poster: croppedImage, posterPosition: position } : { posterPosition: position },
      { setBusy: setPosterSaving, successMessage: "پوستر بروزرسانی شد." }
    )
  ), [saveProfileFields]);

  const applySetting = useCallback((key, value) => {
    const next = { ...settingsRef.current, [key]: value };
    settingsRef.current = next;
    setProfileSettings(next);
  }, []);

  const toggleProfileSetting = useCallback((key) => {
    const value = !settingsRef.current[key];
    const previous = !value;
    applySetting(key, value);
    // One request at a time per key, in tap order, so rapid taps can't land
    // out of order on the server and leave it opposite to what's on screen.
    const chain = settingsSaveChain.current;
    const run = (chain.get(key) || Promise.resolve()).then(async () => {
      try {
        const { ok, payload } = await apiFetch("/api/profile/settings", {
          method: "POST",
          body: JSON.stringify({ settings: { [key]: value } })
        });
        if (ok) return;
        throw new Error(/[\u0600-\u06FF]/.test(payload?.error || "") ? payload.error : "");
      } catch (err) {
        // Only roll back if no newer tap has changed this key since.
        if (settingsRef.current[key] === value) applySetting(key, previous);
        notify(err?.message || "ذخیره تنظیمات انجام نشد؛ اتصال را بررسی کن و دوباره امتحان کن.");
      }
    });
    chain.set(key, run);
  }, [applySetting, notify]);

  return {
    profileEditOpen,
    setProfileEditOpen,
    profileEditAvatar,
    setProfileEditAvatar,
    profileLocationSaving,
    profileSaving,
    profileSettings,
    updateRegisteredProfile,
    saveProfileLocation,
    openProfileEdit,
    handleProfileAvatarUpload,
    toggleProfileSetting,
    logoSaving,
    posterSaving,
    saveProfileLogo,
    quickSetLogo,
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
