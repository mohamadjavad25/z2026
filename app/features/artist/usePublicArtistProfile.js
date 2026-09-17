"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createArtistBooking, getArtist, toggleFollow } from "../../shared/api/artists";
import { createReview, toggleReviewLike } from "../../shared/api/reviews";
import { getApiErrorMessage } from "../../shared/lib/apiNotify";
import { parseServiceDurationMinutes } from "../../shared/lib/time";
import { mapExplorePost } from "../explore/mappers";
import { isPublicArtistSlotBlocked } from "./bookingUtils";
import { salonClientBookingDays, getPublicArtistServices } from "./constants";

/**
 * Public artist profile modal (customer view) — gallery, reviews, follow, booking.
 *
 * Does NOT own artist-owner workspace (portfolio CRUD, /api/artist/me schedule, …).
 *
 * explorePostList / publishedAiPosts are read-only inputs for portfolio fallback merge.
 * Opening from Explore stays in HomeApp (resolveExploreArtist + salon vs artist branch);
 * HomeApp calls openPublicArtistProfile(artistStub) when the target is an artist.
 *
 * Booking uses POST /api/artist/bookings (public/client path), not owner /api/artist/me.
 *
 * @param {{
 *   createdProfile?: { id?: number|string, type?: string, data?: Record<string, unknown> } | null,
 *   explorePostList?: Array<Record<string, unknown>>,
 *   publishedAiPosts?: Array<Record<string, unknown>>,
 *   followedArtists?: string[],
 *   setFollowedArtists?: (updater: unknown) => void,
 *   setFollowedSalons?: (updater: unknown) => void,
 *   onNotice?: (msg: string) => void,
 *   onSelectExplorePost?: (post: Record<string, unknown> | null) => void,
 *   onBeforeOpen?: () => void,
 *   onArtistBookingCreated?: (artistUserId: number|string) => void | Promise<void>
 * }} options
 */
export function usePublicArtistProfile({
  createdProfile = null,
  explorePostList = [],
  publishedAiPosts = [],
  followedArtists = [],
  setFollowedArtists,
  setFollowedSalons,
  onNotice,
  onSelectExplorePost,
  onBeforeOpen,
  onArtistBookingCreated
} = {}) {
  const notify = useCallback((message) => {
    if (typeof onNotice === "function" && message) onNotice(message);
  }, [onNotice]);

  const [selectedPublicArtist, setSelectedPublicArtist] = useState(null);
  const [publicArtistReviews, setPublicArtistReviews] = useState([]);
  const [publicArtistUserRating, setPublicArtistUserRating] = useState(0);
  const [publicArtistRatingHover, setPublicArtistRatingHover] = useState(0);
  const [publicArtistView, setPublicArtistView] = useState("gallery");
  const [publicArtistGalleryFilter, setPublicArtistGalleryFilter] = useState("همه");
  const [publicArtistBookingDay, setPublicArtistBookingDay] = useState(salonClientBookingDays[0]);
  const [publicArtistBookingSlot, setPublicArtistBookingSlot] = useState("");
  const [publicArtistSelectedServiceId, setPublicArtistSelectedServiceId] = useState("");
  const [publicArtistBookingBusy, setPublicArtistBookingBusy] = useState(false);
  const publicArtistBookingBusyRef = useRef(false);

  const publicArtistPortfolio = useMemo(() => {
    if (!selectedPublicArtist?.name) return [];
    const fromArtist = Array.isArray(selectedPublicArtist.posts)
      ? selectedPublicArtist.posts.map(mapExplorePost)
      : [];
    if (fromArtist.length) return fromArtist.filter(Boolean);
    const all = [...(publishedAiPosts || []), ...(explorePostList || [])];
    return all.filter((post) => (
      post.salon === selectedPublicArtist.name || post.ownerUserId === selectedPublicArtist.id
    ));
  }, [selectedPublicArtist, publishedAiPosts, explorePostList]);

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

  const publicArtistHeroImage = useMemo(() => {
    const poster = selectedPublicArtist?.storyPoster
      || selectedPublicArtist?.story_poster
      || selectedPublicArtist?.introPoster
      || selectedPublicArtist?.intro_poster
      || "";
    if (poster) return poster;
    const cover = publicArtistPortfolio.find((item) => item.featured) || publicArtistPortfolio[0];
    return cover?.image || selectedPublicArtist?.avatar || "/explore-post-hair-balayage.png";
  }, [selectedPublicArtist, publicArtistPortfolio]);

  useEffect(() => {
    if (!publicArtistGalleryTags.includes(publicArtistGalleryFilter)) {
      setPublicArtistGalleryFilter("همه");
    }
  }, [publicArtistGalleryTags, publicArtistGalleryFilter]);

  const applyPublicArtistPayload = useCallback((full) => {
    if (!full) return;
    const reviews = Array.isArray(full.reviews) ? full.reviews : [];
    setSelectedPublicArtist(full);
    setPublicArtistReviews(reviews);
    const myId = Number(createdProfile?.id || 0);
    const mine = myId
      ? reviews.find((review) => Number(review.author_user_id) === myId)
      : null;
    setPublicArtistUserRating(mine ? Math.round(Number(mine.rating) || 0) : 0);
    setPublicArtistRatingHover(0);
  }, [createdProfile?.id]);

  const closePublicArtistProfile = useCallback(() => {
    setSelectedPublicArtist(null);
    setPublicArtistView("gallery");
    setPublicArtistGalleryFilter("همه");
    setPublicArtistBookingDay(salonClientBookingDays[0]);
    setPublicArtistBookingSlot("");
    setPublicArtistSelectedServiceId("");
    setPublicArtistUserRating(0);
    setPublicArtistRatingHover(0);
    setPublicArtistReviews([]);
  }, []);

  const openPublicArtistProfile = useCallback(async (artist) => {
    if (!artist) return;
    if (typeof onBeforeOpen === "function") onBeforeOpen();
    setPublicArtistView("gallery");
    setPublicArtistGalleryFilter("همه");
    setPublicArtistBookingDay(salonClientBookingDays[0]);
    setPublicArtistBookingSlot("");
    setPublicArtistSelectedServiceId("");
    setPublicArtistUserRating(0);
    setPublicArtistRatingHover(0);
    setPublicArtistReviews([]);
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
        }
      } catch {
        // keep stub artist
      }
    }
  }, [applyPublicArtistPayload, setFollowedArtists, onBeforeOpen]);

  const confirmPublicArtistRating = useCallback(async (stars, text = "") => {
    if (!selectedPublicArtist || stars < 1) return;
    if (!selectedPublicArtist.id) {
      notify("آرتیست نامعتبر است.");
      return;
    }
    if (createdProfile?.id && Number(createdProfile.id) === Number(selectedPublicArtist.id)) {
      notify("نمی‌تونی به پروفایل خودت امتیاز بدی.");
      return;
    }

    const previous = publicArtistUserRating;
    setPublicArtistUserRating(stars);
    setPublicArtistRatingHover(0);

    try {
      const { ok, payload } = await createReview({
        targetUserId: selectedPublicArtist.id,
        rating: stars,
        text: text || "",
        service: ""
      });
      if (!ok) {
        setPublicArtistUserRating(previous);
        notify(payload?.error || "امتیاز در سرور ذخیره نشد.");
        return;
      }

      notify(`${["", "۱", "۲", "۳", "۴", "۵"][stars]} ستاره ثبت شد. ممنون!`);

      const refresh = await getArtist(selectedPublicArtist.id);
      if (refresh.ok && refresh.data?.artist) {
        applyPublicArtistPayload(refresh.data.artist);
        setPublicArtistUserRating(stars);
        return;
      }

      const review = payload?.data?.review;
      setSelectedPublicArtist((current) => (
        current
          ? {
              ...current,
              rating: payload?.data?.rating || current.rating,
              reviewCount: Number(payload?.data?.reviewCount || current.reviewCount || 0)
            }
          : current
      ));
      if (review) {
        setPublicArtistReviews((items) => {
          const nextItem = {
            id: review.id,
            author_user_id: review.author_user_id,
            name: review.name || createdProfile?.data?.name || "تو",
            rating: review.rating,
            text: review.text || "",
            service: review.service || ""
          };
          const index = items.findIndex((item) => (
            Number(item.id) === Number(review.id)
            || (review.author_user_id && Number(item.author_user_id) === Number(review.author_user_id))
          ));
          if (index >= 0) {
            return items.map((item, i) => (i === index ? { ...item, ...nextItem } : item));
          }
          return [{ ...nextItem, like_count: 0, liked_by_me: false }, ...items];
        });
      }
    } catch {
      setPublicArtistUserRating(previous);
      notify("امتیاز در سرور ذخیره نشد.");
    }
  }, [
    selectedPublicArtist,
    createdProfile,
    publicArtistUserRating,
    applyPublicArtistPayload,
    notify
  ]);

  const toggleLikePublicArtistReview = useCallback(async (reviewId) => {
    if (!reviewId) return;
    if (!createdProfile?.id) {
      notify("برای لایک کردن ابتدا وارد شو.");
      return;
    }

    let previousState = null;
    setPublicArtistReviews((items) => items.map((item) => {
      if (Number(item.id) !== Number(reviewId)) return item;
      previousState = { liked_by_me: item.liked_by_me, like_count: item.like_count };
      const nextLiked = !item.liked_by_me;
      const nextCount = Math.max(0, Number(item.like_count || 0) + (nextLiked ? 1 : -1));
      return { ...item, liked_by_me: nextLiked, like_count: nextCount };
    }));

    const revert = () => {
      setPublicArtistReviews((items) => items.map((item) => (
        Number(item.id) === Number(reviewId) && previousState ? { ...item, ...previousState } : item
      )));
    };

    try {
      const { ok, payload } = await toggleReviewLike(reviewId);
      if (!ok) {
        revert();
        notify(payload?.error || "لایک ثبت نشد.");
        return;
      }
      const { liked, likeCount } = payload?.data || {};
      setPublicArtistReviews((items) => items.map((item) => (
        Number(item.id) === Number(reviewId)
          ? { ...item, liked_by_me: Boolean(liked), like_count: Number(likeCount ?? item.like_count) }
          : item
      )));
    } catch {
      revert();
      notify("لایک ثبت نشد.");
    }
  }, [createdProfile, notify]);

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
      notify(
        `رزرو «${service.name}» · ${publicArtistBookingDay} ساعت ${publicArtistBookingSlot} برای «${selectedPublicArtist.name}» ثبت شد.`
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
    if (typeof onSelectExplorePost === "function") onSelectExplorePost(item);
  }, [closePublicArtistProfile, onSelectExplorePost]);

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
    publicArtistReviews,
    publicArtistUserRating,
    publicArtistRatingHover,
    setPublicArtistRatingHover,
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
    publicArtistHeroImage,
    openPublicArtistProfile,
    closePublicArtistProfile,
    confirmPublicArtistRating,
    toggleLikePublicArtistReview,
    confirmPublicArtistBooking,
    toggleFollowPublicArtist,
    shareArtistProfile,
    openPublicArtistWork,
    selectPublicArtistService,
    resetPublicArtistProfile
  };
}
