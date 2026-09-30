"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deleteAccount as apiDeleteAccount, getAuthMe, login as apiLogin, logout as apiLogout, register as apiRegister } from "../../shared/api/auth";
import { AUTH_SESSION_KEY, normalizeProfile, readAuthSession, writeAuthSession } from "./constants";

/**
 * Auth/session domain — owns race guards, gate UI state, login/register/logout.
 *
 * Race logic (do not change):
 * - authBootRef: generation counter; stale async boots abort
 * - sessionLockedRef: set on login/register/boot success; mid-boot lock skips applying guest/me
 *
 * createdProfile shape is always normalizeProfile(...) so the seven domain hooks stay compatible.
 *
 * @param {object} options
 * @param {(profile: object, meta: { source: "boot"|"login"|"register" }) => void|Promise<void>} options.onAuthenticated
 * @param {() => void|Promise<void>} options.onLoggedOut
 * @param {(guard: { isStale: () => boolean }) => void|Promise<void>} [options.onPublicBoot]
 * @param {() => void|Promise<void>} [options.onGuestBoot]
 * @param {(tab?: string) => void} [options.onEnterTab]
 * @param {(message: string) => void} [options.onShellNotice]
 */
export function useAuthSession({
  onAuthenticated,
  onLoggedOut,
  onPublicBoot,
  onGuestBoot,
  onEnterTab,
  onShellNotice
} = {}) {
  const [authChecked, setAuthChecked] = useState(false);
  const [createdProfile, setCreatedProfile] = useState(null);
  const [profileType, setProfileType] = useState("client");
  const [authMode, setAuthMode] = useState("signup");
  const [signupStep, setSignupStep] = useState("role");
  const [authNotice, setAuthNotice] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [profileView, setProfileView] = useState("overview");

  const authBootRef = useRef(0);
  const sessionLockedRef = useRef(false);
  const authBusyRef = useRef(false);

  const onAuthenticatedRef = useRef(onAuthenticated);
  const onLoggedOutRef = useRef(onLoggedOut);
  const onPublicBootRef = useRef(onPublicBoot);
  const onGuestBootRef = useRef(onGuestBoot);
  const onEnterTabRef = useRef(onEnterTab);
  const onShellNoticeRef = useRef(onShellNotice);
  onAuthenticatedRef.current = onAuthenticated;
  onLoggedOutRef.current = onLoggedOut;
  onPublicBootRef.current = onPublicBoot;
  onGuestBootRef.current = onGuestBoot;
  onEnterTabRef.current = onEnterTab;
  onShellNoticeRef.current = onShellNotice;

  const enterAuthenticatedSession = useCallback((profile, tab = "profile") => {
    sessionLockedRef.current = true;
    writeAuthSession(profile);
    if (profile?.data?.phone) {
      try {
        window.localStorage.setItem("zibaban_last_phone", profile.data.phone);
      } catch {
        // ignore
      }
    }
    setCreatedProfile(profile);
    setProfileType(profile.type);
    setProfileView("overview");
    setAuthNotice("");
    onEnterTabRef.current?.(tab);
  }, []);

  const clearAuthSession = useCallback(() => {
    sessionLockedRef.current = false;
    window.localStorage.removeItem(AUTH_SESSION_KEY);
    setCreatedProfile(null);
    setProfileType("client");
    setProfileView("overview");
    setAuthNotice("");
    setAuthMode("login");
    setSignupStep("role");
    onEnterTabRef.current?.("profile");
  }, []);

  const lockSession = useCallback(() => {
    sessionLockedRef.current = true;
  }, []);

  useEffect(() => {
    const bootId = ++authBootRef.current;
    const isStale = () => bootId !== authBootRef.current;

    async function loadSavedData() {
      try {
        // Same race window as HomeApp: /me + /salons in parallel, then public directories, then lock check.
        const [meResult, salonsPayload] = await Promise.all([
          getAuthMe(),
          fetch("/api/salons").then((response) => response.json()).catch(() => ({}))
        ]);
        if (isStale()) return;

        await onPublicBootRef.current?.({ isStale, bootId, salonsPayload });
        if (isStale()) return;

        if (sessionLockedRef.current) {
          return;
        }

        // HomeApp shape: mePayload.profile || mePayload.data?.user
        const rawProfile = meResult.payload?.profile || meResult.data?.user || meResult.data?.profile || null;
        const savedProfile = normalizeProfile(rawProfile);

        if (savedProfile) {
          sessionLockedRef.current = true;
          writeAuthSession(savedProfile);
          setCreatedProfile(savedProfile);
          setProfileType(savedProfile.type);
          onEnterTabRef.current?.("profile");

          await onAuthenticatedRef.current?.(savedProfile, { source: "boot", bootId, isStale });
          if (isStale()) return;
        } else {
          setCreatedProfile(null);
          onEnterTabRef.current?.("profile");
          setAuthMode(readAuthSession() ? "login" : "signup");
          if (readAuthSession()) window.localStorage.removeItem(AUTH_SESSION_KEY);
          await onGuestBootRef.current?.();
        }
      } catch {
        if (isStale()) return;
        onShellNoticeRef.current?.("اتصال به سرور برقرار نشد؛ دوباره صفحه را باز کن.");
      } finally {
        if (bootId === authBootRef.current) {
          setAuthChecked(true);
        }
      }
    }

    loadSavedData();
  }, []);

  async function handleLoginSubmit(event) {
    event.preventDefault();
    if (authBusyRef.current) return;
    authBusyRef.current = true;
    setAuthBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    setAuthNotice("");
    try {
      const { ok, payload } = await apiLogin({ phone: data.phone, password: data.password });
      if (!ok) {
        setAuthNotice(payload.error || "ورود انجام نشد.");
        if (payload.code === "not_found") {
          window.setTimeout(() => {
            setAuthMode("signup");
            setSignupStep("role");
          }, 1200);
        }
        return;
      }
      const profile = normalizeProfile(payload.profile || payload.data?.user);
      if (!profile) {
        setAuthNotice("ورود انجام نشد؛ دوباره امتحان کن.");
        return;
      }
      try {
        window.localStorage.setItem("zibaban_last_phone", String(data.phone || "").trim());
      } catch {
        // ignore
      }
      enterAuthenticatedSession(profile, "profile");
      await onAuthenticatedRef.current?.(profile, { source: "login" });
      onShellNoticeRef.current?.("با موفقیت وارد شدی.");
    } catch {
      setAuthNotice("ورود انجام نشد؛ دوباره امتحان کن.");
    } finally {
      authBusyRef.current = false;
      setAuthBusy(false);
    }
  }

  async function handleProfileSubmit(event, type) {
    event.preventDefault();
    if (authBusyRef.current) return;
    authBusyRef.current = true;
    setAuthBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    setAuthNotice("");
    if (!String(data.password || "").trim()) {
      setAuthNotice("رمز عبور را وارد کن.");
      authBusyRef.current = false;
      setAuthBusy(false);
      return;
    }
    if (String(data.password).trim().length < 8) {
      setAuthNotice("رمز عبور باید حداقل ۸ کاراکتر باشد.");
      authBusyRef.current = false;
      setAuthBusy(false);
      return;
    }
    if (!String(data.phone || "").trim()) {
      setAuthNotice("شماره تماس را وارد کن.");
      authBusyRef.current = false;
      setAuthBusy(false);
      return;
    }
    try {
      const { ok, payload } = await apiRegister({ type, data, phone: data.phone, password: data.password });
      if (!ok) {
        setAuthNotice(payload.error || "ثبت‌نام انجام نشد؛ دوباره امتحان کن.");
        return;
      }

      const profile = normalizeProfile(payload.profile || payload.data?.user);
      if (!profile?.data?.phone) {
        setAuthNotice("ثبت‌نام در دیتابیس ذخیره نشد؛ دوباره امتحان کن.");
        return;
      }

      enterAuthenticatedSession(profile, "profile");
      await onAuthenticatedRef.current?.(profile, { source: "register" });
      onShellNoticeRef.current?.("حساب ساخته شد و آماده استفاده است.");
    } catch {
      setAuthNotice("ثبت‌نام انجام نشد؛ دوباره امتحان کن.");
      onShellNoticeRef.current?.("ذخیره پروفایل انجام نشد؛ دوباره امتحان کن.");
    } finally {
      authBusyRef.current = false;
      setAuthBusy(false);
    }
  }

  async function logoutAccount() {
    try {
      await apiLogout();
    } catch {
      // ignore
    }
    clearAuthSession();
    await onLoggedOutRef.current?.();
    onShellNoticeRef.current?.("از حساب خارج شدی.");
  }

  /** Permanent. Requires re-entering the current password (server-enforced
   *  in DELETE /api/profile) so a hijacked/stolen session cookie alone can't
   *  destroy the account -- same re-auth bar the password-change branch of
   *  POST /api/profile already requires. Returns { ok: false, error } on a
   *  wrong password (caller shows it inline and keeps the confirm dialog
   *  open) instead of clearing the session -- only a genuine success falls
   *  through to the same client-side cleanup logoutAccount uses (session is
   *  already gone server-side once the user row is deleted; see migration
   *  v34 for what this does and doesn't take down with it). */
  async function deleteAccountPermanently(password) {
    const { ok, payload } = await apiDeleteAccount(password);
    if (!ok) {
      return { ok: false, error: payload?.error || "حذف حساب انجام نشد." };
    }
    clearAuthSession();
    await onLoggedOutRef.current?.();
    onShellNoticeRef.current?.("حساب شما برای همیشه حذف شد.");
    return { ok: true };
  }

  return {
    authChecked,
    createdProfile,
    setCreatedProfile,
    profileType,
    setProfileType,
    profileView,
    setProfileView,
    authMode,
    setAuthMode,
    signupStep,
    setSignupStep,
    authNotice,
    setAuthNotice,
    authBusy,
    authBootRef,
    sessionLockedRef,
    lockSession,
    enterAuthenticatedSession,
    clearAuthSession,
    handleLoginSubmit,
    handleProfileSubmit,
    logoutAccount,
    deleteAccountPermanently,
    normalizeProfile,
    writeAuthSession
  };
}
