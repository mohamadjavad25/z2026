"use client";

import { playSound } from "../../shared/lib/sounds";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createArtistBooking, getArtist, toggleFollow } from "../../shared/api/artists";
import { toggleSave } from "../../shared/api/saves";
import { getApiErrorMessage } from "../../shared/lib/apiNotify";
import { parseServiceDurationMinutes } from "../../shared/lib/time";
import { mapSharedPost } from "../posts/mappers";
import { isPublicArtistSlotBlocked } from "./bookingUtils";
import { salonClientBookingDays, getPublicArtistServices } from "./constants";

/**
 * Public artist profile modal (customer view) — gallery, follow, booking.
 *
 * Does NOT own artist-owner workspace (portfolio CRUD, /api/artist/me schedule, …).
 *
 * Opening a post stays in HomeApp (resolvePostOwner + salon vs artist branch);
 * HomeApp calls openPublicArtistProfile(artistStub) when the target is an artist.
 *
 * Booking uses POST /api/artist/bookings (public/client path), not owner /api/artist/me.
 *
 * @param {{
 *   createdProfile?: { id?: number|string, type?: string, data?: Record<string, unknown> } | null,
 *   followedArtists?: string[],
 *   setFollowedArtists?: (updater: unknown) => void,
 *   setFollowedSalons?: (updater: unknown) => void,
 *   onNotice?: (msg: string) => void,
 *   onSelectPost?: (post: Record<string, unknown> | null) => void,
 *   onBeforeOpen?: () => void,
 *   onArtistBookingCreated?: (artistUserId: number|string) => void | Promise<void>
 * }} options
 */
export function usePublicArtistProfile({
  createdProfile = null,
  followedArtists = [],
  setFollowedArtists,
  setFollowedSalons,
  onNotice,
  onSelectPost,
  onBeforeOpen,
  onArtistBookingCreated
} = {}) {
  const notify = useCallback((message) => {
    if (typeof onNotice === "function" && message) onNotice(message);
  }, [onNotice]);

  const [selectedPublicArtist, setSelectedPublicArtist] = useState(null);
  const [publicArtistView, setPublicArtistView] = useState("gallery");
  const [publicArtistGalleryFilter, setPublicArtistGalleryFilter] = useState("همه");
  const [publicArtistBookingDay, setPublicArtistBookingDay] = useState(salonClientBookingDays[0]);
  const [publicArtistBookingSlot, setPublicArtistBookingSlot] = useState("");
  const [publicArtistSelectedServiceId, setPublicArtistSelectedServiceId] = useState("");
  const [publicArtistBookingBusy, setPublicArtistBookingBusy] = useState(false);
  const publicArtistBookingBusyRef = useRef(false);

  const publicArtistPortfolio = useMemo(() => {
    if (!selectedPublicArtist?.name) return [];
    return (Array.isArray(selectedPublicArtist.posts) ? selectedPublicArtist.posts : [])
      .map(mapSharedPost)
      .filter(Boolean);
  }, [selectedPublicArtist]);

  const publicArtistGalleryTags = useMemo(() => {
    const tags = Array.from(new Set(publicArtistPortfolio.map((item) => item.tag).filter(Boolean)));
    return ["همه", ...tags];
  }, [publicArtistPortfolio]);

  const publicArtistGalleryItems = useMemo(() => {
    if (publicArtistGalleryFilter === "همه") return publicArtistPortfolio;
    return publicArtistPortfolio.filter((item) => item.tag === publicArtistGalleryFilter);
  }, [publicArtistPortfolio, publicArtistGalleryFilter]);

  const publicArtistFeatured = publicArtistGalleryItems[0] || null;
  const publicArtistGalleryRest = publicArtistGalleryItems.slice(1);

  const publicArtistServices = useMemo(
    () => (selectedPublicArtist ? getPublicArtistServices(selectedPublicArtist) : []),
    [selectedPublicArtist]
  );

  const isFollowingPublicArtist = selectedPublicArtist
    ? followedArtists.includes(String(selectedPublicArtist.id || selectedPublicArtist.name))
      || followedArtists.includes(selectedPublicArtist.name)
    : false;

  // Real persistence via POST /api/saves (saved_profiles table) — mirrors
  // toggleFollowPublicArtist's optimistic-update + revert-on-failure shape.
  // savedArtists is seeded both globally (HomeApp's refreshSaves, from
  // GET /api/saves' savedTargetIds — see setSavedArtists below) and per
  // profile-open (isSaved on the GET /api/artists/:id response, in
  // openPublicArtistProfile) so the button never drifts from the DB.
  const [savedArtists, setSavedArtists] = useState([]);
  const isSavedPublicArtist = selectedPublicArtist
    ? savedArtists.includes(String(selectedPublicArtist.id || selectedPublicArtist.name))
    : false;

  const toggleSavePublicArtist = useCallback(async (artist) => {
    if (!artist?.id && !artist?.name) return;
    const key = String(artist.id || artist.name);
    const previousSaved = savedArtists.includes(key);
    const willSave = !previousSaved;

    setSavedArtists((items) => (
      items.includes(key) ? items.filter((item) => item !== key) : [...items, key]
    ));

    if (!artist.id) {
      notify(willSave ? `پروفایل «${artist.name || "آرتیست"}» ذخیره شد.` : `پروفایل «${artist.name || "آرتیست"}» از ذخیره‌ها حذف شد.`);
      return;
    }

    try {
      const { ok, payload } = await toggleSave(artist.id);
      if (!ok) {
        setSavedArtists((items) => (
          previousSaved
            ? (items.includes(key) ? items : [...items, key])
            : items.filter((item) => item !== key)
        ));
        notify(getApiErrorMessage(payload, "ذخیره آرتیست انجام نشد؛ دوباره امتحان کن."));
        return;
      }
      notify(willSave ? `پروفایل «${artist.name || "آرتیست"}» ذخیره شد.` : `پروفایل «${artist.name || "آرتیست"}» از ذخیره‌ها حذف شد.`);
    } catch {
      setSavedArtists((items) => (
        previousSaved
          ? (items.includes(key) ? items : [...items, key])
          : items.filter((item) => item !== key)
      ));
      notify("ذخیره آرتیست انجام نشد؛ دوباره امتحان کن.");
    }
  }, [savedArtists, notify]);

  const publicArtistHeroImage = useMemo(() => {
    const cover = publicArtistPortfolio.find((item) => item.featured) || publicArtistPortfolio[0];
    return cover?.image || selectedPublicArtist?.avatar || "/explore-post-hair-balayage.webp";
  }, [selectedPublicArtist, publicArtistPortfolio]);

  useEffect(() => {
    if (!publicArtistGalleryTags.includes(publicArtistGalleryFilter)) {
      setPublicArtistGalleryFilter("همه");
    }
  }, [publicArtistGalleryTags, publicArtistGalleryFilter]);

  const applyPublicArtistPayload = useCallback((full) => {
    if (!full) return;
    setSelectedPublicArtist(full);
  }, []);

  const closePublicArtistProfile = useCallback(() => {
    setSelectedPublicArtist(null);
    setPublicArtistView("gallery");
    setPublicArtistGalleryFilter("همه");
    setPublicArtistBookingDay(salonClientBookingDays[0]);
    setPublicArtistBookingSlot("");
    setPublicArtistSelectedServiceId("");
  }, []);

  const openPublicArtistProfile = useCallback(async (artist) => {
    if (!artist) return;
    if (typeof onBeforeOpen === "function") onBeforeOpen();
    setPublicArtistView("gallery");
    setPublicArtistGalleryFilter("همه");
    setPublicArtistBookingDay(salonClientBookingDays[0]);
    setPublicArtistBookingSlot("");
    setPublicArtistSelectedServiceId("");
    setSelectedPublicArtist(artist);
    if (artist.id) {
      try {
        const { ok, data } = await getArtist(artist.id);
        if (ok && data?.artist) {
          applyPublicArtistPayload(data.artist);
          if (data.artist.isFollowing && typeof setFollowedArtists === "function") {
            setFollowedArtists((items) => (
              items.includes(String(data.artist.id)) ? items : [...items, String(data.artist.id)]
            ));
          }
          const artistKey = String(data.artist.id);
          setSavedArtists((items) => {
            if (data.artist.isSaved) {
              return items.includes(artistKey) ? items : [...items, artistKey];
            }
            return items.includes(artistKey) ? items.filter((item) => item !== artistKey) : items;
          });
        }
      } catch {
        // keep stub artist
      }
    }
  }, [applyPublicArtistPayload, setFollowedArtists, onBeforeOpen]);

  const confirmPublicArtistBooking = useCallback(async () => {
    if (!selectedPublicArtist) return;
    if (publicArtistBookingBusyRef.current) return;
    const service = publicArtistServices.find((item) => item.id === publicArtistSelectedServiceId)
      || publicArtistServices[0];
    if (!service) {
      notify("خدمتی برای رزرو موجود نیست.");
      return;
    }
    if (!publicArtistBookingSlot) {
      setPublicArtistView("booking");
      notify("اول روز و ساعت نوبت را انتخاب کن.");
      return;
    }
    if (!createdProfile?.data?.phone) {
      setPublicArtistView("booking");
      notify("برای رزرو، ابتدا شماره تماس را در پروفایلت ثبت کن.");
      return;
    }
    if (!selectedPublicArtist.id) {
      notify("آرتیست نامعتبر است.");
      return;
    }
    if (isPublicArtistSlotBlocked(
      selectedPublicArtist,
      publicArtistBookingDay,
      publicArtistBookingSlot,
      parseServiceDurationMinutes(service.duration)
    )) {
      notify("این بازه با نوبت دیگری تداخل دارد. ساعت دیگری انتخاب کن.");
      setPublicArtistBookingSlot("");
      return;
    }
    publicArtistBookingBusyRef.current = true;
    setPublicArtistBookingBusy(true);
    try {
      const durationMinutes = parseServiceDurationMinutes(service.duration);
      const { ok, status, payload } = await createArtistBooking({
        artistUserId: selectedPublicArtist.id,
        service: service.name,
        bookingDate: publicArtistBookingDay,
        time: publicArtistBookingSlot,
        durationMinutes,
        clientName: createdProfile?.data?.name || "",
        clientPhone: createdProfile?.data?.phone || ""
      });
      if (!ok) {
        if (payload?.code === "SLOT_TAKEN" || status === 409) {
          setSelectedPublicArtist((current) => (
            current
              ? {
                  ...current,
                  bookedSlots: payload?.data?.bookedSlots || [
                    ...(current.bookedSlots || []),
                    {
                      booking_date: publicArtistBookingDay,
                      time: publicArtistBookingSlot,
                      duration_minutes: durationMinutes,
                      status: "تازه"
                    }
                  ]
                }
              : current
          ));
          setPublicArtistBookingSlot("");
        }
        notify(getApiErrorMessage(payload, "رزرو انجام نشد."));
        return;
      }
      setSelectedPublicArtist((current) => (
        current
          ? {
              ...current,
              bookedSlots: payload?.data?.bookedSlots || [
                ...(current.bookedSlots || []),
                {
                  booking_date: publicArtistBookingDay,
                  time: publicArtistBookingSlot,
                  duration_minutes: durationMinutes,
                  status: "تازه"
                }
              ]
            }
          : current
      ));
      playSound("submit");
      // "و در انتظار تایید آرتیست است" (not just "ثبت شد") — the real status
      // here is "تازه" (pending, up to an hour before auto-expiry, see
      // bookingExpirySweep.js), same fix as the salon booking confirmation
      // toast in useSalonDirectory.js for the identical reason: "ثبت شد"
      // alone reads as a done deal and hides that a clock just started.
      notify(
        `رزرو «${service.name}» · ${publicArtistBookingDay} ساعت ${publicArtistBookingSlot} برای «${selectedPublicArtist.name}» ثبت شد و در انتظار تایید آرتیست است.`
      );
      setPublicArtistBookingSlot("");
      setPublicArtistView("services");
      if (typeof onArtistBookingCreated === "function") {
        try {
          await onArtistBookingCreated(selectedPublicArtist.id);
        } catch {
          // owner refresh is best-effort; booking already succeeded
        }
      }
    } catch {
      notify("رزرو انجام نشد.");
    } finally {
      publicArtistBookingBusyRef.current = false;
      setPublicArtistBookingBusy(false);
    }
  }, [
    selectedPublicArtist,
    publicArtistServices,
    publicArtistSelectedServiceId,
    publicArtistBookingSlot,
    publicArtistBookingDay,
    createdProfile,
    notify,
    onArtistBookingCreated
  ]);

  const toggleFollowPublicArtist = useCallback(async (artist) => {
    if (!artist?.id && !artist?.name) return;
    const key = String(artist.id || artist.name);
    const previousFollowed = followedArtists.includes(key) || followedArtists.includes(artist.name);
    const nextFollowed = !previousFollowed;

    function applyFollowed(followed) {
      if (typeof setFollowedArtists === "function") {
        setFollowedArtists((items) => (
          followed
            ? [...items.filter((item) => item !== artist.name && item !== key), key]
            : items.filter((item) => item !== key && item !== artist.name)
        ));
      }
      if (typeof setFollowedSalons === "function") {
        setFollowedSalons((items) => (
          followed
            ? [...items.filter((item) => item !== key), key]
            : items.filter((item) => item !== key)
        ));
      }
      setSelectedPublicArtist((current) => {
        if (!current || String(current.id || current.name) !== key) return current;
        const currentCount = Number(current.followers || 0);
        return {
          ...current,
          followers: Math.max(0, currentCount + (followed ? 1 : -1)),
          isFollowing: followed
        };
      });
    }

    applyFollowed(nextFollowed);
    if (artist.id) {
      try {
        const { ok, payload } = await toggleFollow({ targetUserId: artist.id });
        if (!ok) {
          applyFollowed(previousFollowed);
          notify(payload?.error || "فالو در سرور ذخیره نشد.");
          return;
        }
        const followerCount = payload?.data?.followerCount ?? payload?.data?.follower_count;
        if (followerCount != null) {
          setSelectedPublicArtist((current) => (
            current && String(current.id) === String(artist.id)
              ? { ...current, followers: Number(followerCount), isFollowing: Boolean(payload?.data?.following) }
              : current
          ));
        }
      } catch {
        applyFollowed(previousFollowed);
        notify("فالو در سرور ذخیره نشد.");
        return;
      }
    }
    notify(
      nextFollowed
        ? `آرتیست «${artist.name}» را دنبال کردی.`
        : `دنبال کردن «${artist.name}» لغو شد.`
    );
  }, [followedArtists, setFollowedArtists, setFollowedSalons, notify]);

  const shareArtistProfile = useCallback(async () => {
    if (!selectedPublicArtist) return;
    const name = selectedPublicArtist.name || "آرتیست";
    const shareText = `پروفایل آرتیست «${name}» در زیبابان`;
    const artistId = selectedPublicArtist.id;
    const shareUrl = typeof window !== "undefined"
      ? (artistId ? `${window.location.origin}/artists/${artistId}` : window.location.href)
      : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: name, text: shareText, url: shareUrl });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl || shareText);
        notify(`لینک پروفایل «${name}» کپی شد.`);
        return;
      }
    } catch {
      // user cancelled or share failed
      return;
    }
    notify(`لینک پروفایل «${name}» آماده اشتراک‌گذاری است.`);
  }, [selectedPublicArtist, notify]);

  const openPublicArtistWork = useCallback((item) => {
    if (!item) return;
    closePublicArtistProfile();
    if (typeof onSelectPost === "function") onSelectPost(item);
  }, [closePublicArtistProfile, onSelectPost]);

  const selectPublicArtistService = useCallback((serviceId) => {
    setPublicArtistSelectedServiceId(serviceId);
    setPublicArtistBookingSlot("");
    setPublicArtistView("booking");
  }, []);

  const resetPublicArtistProfile = useCallback(() => {
    closePublicArtistProfile();
  }, [closePublicArtistProfile]);

  return {
    selectedPublicArtist,
    setSelectedPublicArtist,
    publicArtistView,
    setPublicArtistView,
    publicArtistGalleryFilter,
    setPublicArtistGalleryFilter,
    publicArtistBookingDay,
    setPublicArtistBookingDay,
    publicArtistBookingSlot,
    setPublicArtistBookingSlot,
    publicArtistSelectedServiceId,
    publicArtistBookingBusy,
    publicArtistPortfolio,
    publicArtistGalleryTags,
    publicArtistGalleryItems,
    publicArtistFeatured,
    publicArtistGalleryRest,
    publicArtistServices,
    isFollowingPublicArtist,
    isSavedPublicArtist,
    savedArtists,
    setSavedArtists,
    publicArtistHeroImage,
    openPublicArtistProfile,
    closePublicArtistProfile,
    confirmPublicArtistBooking,
    toggleFollowPublicArtist,
    toggleSavePublicArtist,
    shareArtistProfile,
    openPublicArtistWork,
    selectPublicArtistService,
    resetPublicArtistProfile
  };
}
