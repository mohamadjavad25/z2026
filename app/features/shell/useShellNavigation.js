import { useEffect, useState, useMemo } from "react";
import { apiFetch } from "../../shared/api/client";
import { getSaves } from "../../shared/api/saves";
import { ProfileSavedPosts } from "../profile/ProfileSavedPosts";

export function useShellNavigation({
  authCascadeRef,
  refreshSavedPosts,
  setSalonDirectory,
  refreshSalonSystemData,
  refreshArtistWorkspace,
  refreshClientBookings,
  resetPostActivity,
  resetSalonClient,
  resetPublicArtistProfile,
  resetArtistWorkspace,
  resetSalonWorkspace,
  setSavedArtists,
  createdProfile,
  appToast,
  activeTab,
  profileView,
  salonTool,
  salonWorkspace,
  selectedSalon,
  selectedPublicArtist,
  salonPortfolioList,
  selectedPost,
  beautyPassport,
  setFollowedArtists,
  setFollowedSalons,
  setSavedSalonKeys,
  setSavedProfiles,
  toggleSaveSalon,
  toggleSavePublicArtist,
  setScheduleNow,
  setAppToast,
  setActiveTab,
  salonDirectory,
  salonStaffList,
  salonServiceList,
  closePublicArtistProfile,
  setSalonClientTab,
  setSelectedSalon,
  openPublicArtistProfile,
  setSelectedPost,
  setSelectedArtistProfile,
  shareSalonProfile,
  savedPosts,
  savedProfiles,
  openPost,
  toggleSavedPost,
  publicArtistPortfolio
}) {
function getPassportMatch(post) {
    if (!beautyPassport?.active) return null;
    const scores = {
      "ناخن": "۹۲٪",
      "مو": "۸۸٪",
      "میکاپ": "۹۰٪",
      "ابرو": "۸۶٪",
      "پوست": "۸۴٪",
      "صورت": "۸۷٪",
      "عروس": "۸۳٪"
    };
    return scores[post.tag] || "۸۵٪";
  }

  function getPortfolioCardStyle(item) {
    return item.image
      ? { backgroundImage: `linear-gradient(180deg, rgba(12, 14, 16, 0.04) 0%, transparent 46%, rgba(12, 14, 16, 0.68) 100%), url("${item.image}")` }
      : { backgroundImage: `url("/gallery-tile-empty.webp")` };
  }


  async function refreshFollows() {
    try {
      const { ok, payload } = await apiFetch("/api/follows");
      if (!ok) return;
      const ids = (payload.data?.followingIds || []).map(String);
      setFollowedArtists(ids);
      setFollowedSalons(ids);
    } catch {
      // ignore
    }
  }

  // Seeds real saved-salon/saved-artist state from the server — mirrors
  // refreshFollows above (same "one id list feeds both salon + artist local
  // state" shape, since a save target can be either type). Also stashes the
  // full card arrays for the "ذخیره‌شده‌ها" profile tab so it doesn't have to
  // derive from whatever's currently loaded in salonDirectory.
  async function refreshSaves() {
    try {
      const { ok, data } = await getSaves();
      if (!ok) return;
      const ids = (data?.savedTargetIds || []).map(String);
      setSavedSalonKeys(ids);
      setSavedArtists(ids);
      setSavedProfiles({ salons: data?.salons || [], artists: data?.artists || [] });
    } catch {
      // ignore
    }
  }

  // toggleSaveSalon/toggleSavePublicArtist only update the id-only
  // savedSalonKeys/savedArtists lists (for button state elsewhere) — they
  // don't know about savedProfiles' full card arrays, which only the
  // "ذخیره‌شده‌ها" tab renders. Without this, removing a card from that tab
  // toggled the DB correctly but left the stale card on screen until the
  // next full refreshSaves() (e.g. a reload) — DB and UI silently diverged.
  function removeSavedSalon(salon) {
    toggleSaveSalon(salon);
    const key = String(salon.id || salon.source_key || salon.name);
    setSavedProfiles((prev) => ({
      ...prev,
      salons: prev.salons.filter((item) => String(item.id || item.source_key || item.name) !== key)
    }));
  }

  function removeSavedArtist(artist) {
    toggleSavePublicArtist(artist);
    const key = String(artist.id || artist.name);
    setSavedProfiles((prev) => ({
      ...prev,
      artists: prev.artists.filter((item) => String(item.id || item.name) !== key)
    }));
  }

  authCascadeRef.current = {
    refreshSavedPosts,
    setSalonDirectory,
    refreshFollows,
    refreshSaves,
    refreshSalonSystemData,
    refreshArtistWorkspace,
    refreshClientBookings,
    resetPostActivity,
    resetSalonClient,
    resetPublicArtistProfile,
    resetArtistWorkspace,
    resetSalonWorkspace,
    setSavedArtists
  };

  useEffect(() => {
    if (createdProfile?.type !== "salon" && createdProfile?.type !== "artist") return undefined;
    setScheduleNow(new Date());
    const timer = window.setInterval(() => setScheduleNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, [createdProfile?.type]);

  useEffect(() => {
    if (!appToast) return undefined;
    const timer = window.setTimeout(() => setAppToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [appToast]);



  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const resetPageScroll = () => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      document.querySelectorAll(".workspace, .contentGrid, .mobilePage.is-active, .profilePanel.is-active, .salonPanel.is-active, .feedPanel.is-active").forEach((node) => {
        node.scrollTop = 0;
      });
    };
    resetPageScroll();
    const frame = window.requestAnimationFrame(resetPageScroll);
    const timer = window.setTimeout(resetPageScroll, 80);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [
    activeTab,
    profileView,
    salonTool,
    salonWorkspace,
    selectedSalon?.id,
    selectedSalon?.source_key,
    selectedPublicArtist?.id
  ]);

  function goToTab(tab) {
    if (!createdProfile) {
      setActiveTab("profile");
      return;
    }
    setActiveTab(tab);
  }

  function resolvePostOwner(post) {
    if (!post) return null;
    const fromDirectory = salonDirectory.find((salon) => (
      salon.name === post.salon
      || String(salon.id) === String(post.ownerUserId)
      || String(salon.source_key) === String(post.ownerUserId)
    ));
    const isOwnPost = Boolean(
      createdProfile
      && (createdProfile.type === "artist" || createdProfile.type === "salon")
      && (
        String(post.ownerUserId) === String(createdProfile.id)
        || createdProfile.data?.name === post.salon
      )
    );

    if (isOwnPost) {
      return {
        id: createdProfile.id,
        name: createdProfile.data.name,
        area: createdProfile.data.area || post.area || "",
        role: createdProfile.data.service || post.tag || (createdProfile.type === "salon" ? "سالن زیبایی" : "آرتیست"),
        bio: createdProfile.data.bio || post.meta || "",
        source: createdProfile.type === "salon"
          ? (fromDirectory || null)
          : createdProfile,
        kind: "self",
        entityType: createdProfile.type
      };
    }

    if (post.ownerType === "salon" || fromDirectory) {
      return {
        id: fromDirectory?.id || post.ownerUserId,
        name: fromDirectory?.name || post.salon || "سالن",
        area: fromDirectory?.area || post.area || "",
        role: fromDirectory?.tag || post.tag || "سالن زیبایی",
        bio: fromDirectory?.bio || post.meta || "",
        source: fromDirectory || null,
        kind: "salon",
        entityType: "salon"
      };
    }

    return {
      id: post.ownerUserId,
      name: post.salon || "آرتیست",
      area: post.area || "",
      role: post.ownerService ? `آرتیست ${post.ownerService}` : (post.tag || "آرتیست"),
      bio: post.ownerBio || post.meta || "",
      source: null,
      kind: "artist",
      entityType: "artist"
    };
  }

  function buildOwnPublicSalon() {
    const fromDirectory = salonDirectory.find((salon) => (
      String(salon.id) === String(createdProfile?.id)
      || String(salon.source_key) === String(createdProfile?.id)
      || salon.name === createdProfile?.data?.name
    ));
    if (fromDirectory) {
      return {
        ...fromDirectory,
        portfolio: fromDirectory.portfolio?.length ? fromDirectory.portfolio : salonPortfolioList,
        staff: fromDirectory.staff?.length ? fromDirectory.staff : salonStaffList,
        services: fromDirectory.services?.length ? fromDirectory.services : salonServiceList
      };
    }
    if (createdProfile?.type !== "salon") return null;
    return {
      id: createdProfile.id,
      source_key: String(createdProfile.id),
      name: createdProfile.data?.name || "سالن",
      area: createdProfile.data?.area || "",
      tag: createdProfile.data?.tag || createdProfile.data?.service || "سالن زیبایی",
      open: createdProfile.data?.open || "امروز",
      bio: createdProfile.data?.bio || "",
      avatar: createdProfile.data?.avatar || "",
      post_count: salonPortfolioList.length,
      follower_count: Number(createdProfile.data?.follower_count || 0),
      following_count: Number(createdProfile.data?.following_count || 0),
      portfolio: salonPortfolioList,
      staff: salonStaffList,
      services: salonServiceList
    };
  }

  // Hoisted out of openPostOwnerProfile (below) so it can also be reused
  // as the "رزرو دوباره" (book again) navigation from the client's own
  // bookings/orders activity view — see rebookSalonFromBooking.
  const openSalonProfile = async (salonLike) => {
      closePublicArtistProfile();
      setSalonClientTab("gallery");

      const matchesSalon = (salon) => (
        String(salon.id || "") === String(salonLike.id || "")
        || String(salon.source_key || "") === String(salonLike.id || "")
        || String(salon.id || "") === String(salonLike.source_key || "")
        || salon.name === salonLike.name
      );
      const fallbackSalon = salonLike.source || {
        id: salonLike.id,
        source_key: salonLike.source_key || String(salonLike.id || ""),
        name: salonLike.name,
        area: salonLike.area,
        tag: salonLike.role || salonLike.tag,
        open: salonLike.open || "امروز",
        bio: salonLike.bio || "",
        avatar: salonLike.avatar || "",
        post_count: salonLike.post_count || 0,
        follower_count: salonLike.follower_count || 0,
        following_count: salonLike.following_count || 0,
        portfolio: salonLike.portfolio || [],
        services: salonLike.services || [],
        staff: salonLike.staff || []
      };

      // Show the page right away from what we already have, then refine it:
      // the old flow awaited two sequential round trips before anything moved.
      const localSalon = salonDirectory.find(matchesSalon);
      let nextSalon = localSalon || fallbackSalon;
      setSelectedSalon(nextSalon);
      goToTab("salons");

      if (!localSalon) {
        try {
          const { ok, payload } = await apiFetch("/api/salons");
          if (ok) {
            const list = payload.salons || payload.data?.salons || [];
            if (list.length) {
              setSalonDirectory(list);
              nextSalon = list.find(matchesSalon) || nextSalon;
            }
          }
        } catch {
          // keep the resolved salon from the current post/directory
        }
      }

      // The list stays light; pull the full detail for the public page.
      if (nextSalon?.id) {
        try {
          const detailResult = await apiFetch("/api/salons/" + encodeURIComponent(nextSalon.id));
          if (detailResult.ok) {
            const detailPayload = detailResult.payload;
            const detail = detailPayload.data?.salon || detailPayload.salon;
            if (detail && typeof detail === "object") {
              nextSalon = { ...nextSalon, ...detail };
            }
          }
        } catch {
          // keep the resolved salon from the list/directory
        }
      }

      setSelectedSalon(nextSalon);
  };

  // "رزرو دوباره" — reopens the salon a past booking was made with, using the
  // salon fields the booking row already carries (see listClientSalonBookings
  // in app/lib/db/repos/salons/bookings.js: salon_user_id/salonName/etc).
  function rebookSalonFromBooking(booking) {
    if (!booking) return;
    const salonId = booking.salon_user_id || booking.sourceSalonUserId || booking.salonUserId || "";
    if (!salonId) {
      setAppToast("این رزرو به یک حساب سالن وصل نیست.");
      return;
    }
    openSalonProfile({
      id: salonId,
      source_key: String(salonId),
      name: booking.salonName || booking.salon_name || "",
      area: booking.salonArea || booking.salon_area || "",
      avatar: booking.salonAvatar || booking.salon_avatar || ""
    });
  }

  // "رزرو دوباره" for a direct-artist booking (see listClientArtistBookings
  // in app/lib/db/repos/artists.js) — opens the artist's own public
  // profile (PublicArtistModal), not a salon page. The row's name/area/
  // avatar are reused under salonName/salonArea/salonAvatar for display,
  // but the routing id is its own artistUserId/sourceArtistUserId field
  // — never aliased to salon_user_id, so this never gets confused with
  // rebookSalonFromBooking above.
  function rebookArtistFromBooking(booking) {
    if (!booking) return;
    const artistId = booking.artistUserId || booking.sourceArtistUserId || "";
    if (!artistId) {
      setAppToast("این رزرو به یک حساب آرتیست وصل نیست.");
      return;
    }
    openPublicArtistProfile({
      id: artistId,
      name: booking.salonName || booking.salon_name || "",
      area: booking.salonArea || booking.salon_area || "",
      avatar: booking.salonAvatar || booking.salon_avatar || ""
    });
  }

  // Client's own bookings/activity view ("فعالیت من") mixes salon bookings
  // and direct-artist bookings in one list (see refreshClientBookings in
  // useSalonDirectory.js). "رزرو دوباره" on a merged row must route to the
  // right profile type per row, not assume salon — dispatch on
  // bookingSource here rather than in ClientBookingsPanel/
  // ClientBookingSettingsModal (presentational; no data-shape branching there).
  function rebookFromBooking(booking) {
    if (!booking) return;
    if (booking.bookingSource === "artist") {
      rebookArtistFromBooking(booking);
      return;
    }
    rebookSalonFromBooking(booking);
  }

  async function openPostOwnerProfile(post) {
    const artist = resolvePostOwner(post);
    setSelectedPost(null);
    if (!artist) return;

    if (artist.kind === "self" && artist.entityType === "salon") {
      const ownSalon = artist.source || buildOwnPublicSalon();
      if (ownSalon) {
        await openSalonProfile(ownSalon);
        return;
      }
    }

    if (artist.kind === "self" && artist.entityType === "artist") {
      await openPublicArtistProfile({
        ...artist,
        kind: "artist",
        entityType: "artist"
      });
      return;
    }

    if (artist.kind === "self") {
      goToTab("profile");
      return;
    }

    if (artist.kind === "salon") {
      await openSalonProfile(artist);
      return;
    }

    await openPublicArtistProfile(artist);
  }

  function openSalonStaffPublicProfile(person) {
    if (!person) return;
    const artistId = Number(person.artist_user_id || 0) || null;
    if (!artistId && !person.has_artist_profile) {
      setSelectedArtistProfile(person);
      return;
    }
    openPublicArtistProfile({
      id: artistId,
      name: person.artist_name || person.name,
      area: person.artist_area || "",
      role: person.role || person.artist_service || "آرتیست",
      bio: person.artist_bio || person.bio || "",
      avatar: person.avatar || person.staff_avatar || "",
      phone: person.artist_phone || person.phone || "",
      kind: "artist",
      entityType: "artist"
    });
  }

  async function shareSalonOwnerProfile() {
    await shareSalonProfile(createdProfile?.data?.name || "سالن");
  }

  const renderSavedPosts = () => (
    <ProfileSavedPosts
      posts={savedPosts}
      salons={savedProfiles.salons}
      artists={savedProfiles.artists}
      onSelectPost={openPost}
      onRemovePost={(item) => toggleSavedPost(item.title, item)}
      onSelectSalon={selectSalonWithDetail}
      onRemoveSalon={removeSavedSalon}
      onSelectArtist={openPublicArtistProfile}
      onRemoveArtist={removeSavedArtist}
    />
  );

  const [salonPreviewWorkId, setSalonPreviewWorkId] = useState(null);
  const salonPreviewWork = useMemo(
    () => salonPortfolioList.find((item) => String(item.id) === String(salonPreviewWorkId)) || null,
    [salonPortfolioList, salonPreviewWorkId]
  );

  const selectedPostOwner = selectedPost ? resolvePostOwner(selectedPost) : null;

  // Neighbours to browse with the viewer arrows: the saved list when the post came from there.
  const selectedPostSiblings = (() => {
    if (!selectedPost) return [];
    const sameId = (item) => String(item.id) === String(selectedPost.id);
    if (savedPosts.some(sameId)) return savedPosts;
    if (publicArtistPortfolio.some(sameId)) return publicArtistPortfolio;
    return [];
  })();

  const selectSalonWithDetail = async (salon) => {
    if (!salon) return;
    setSalonClientTab("gallery");
    setSelectedSalon(salon);
    try {
      const { ok, payload } = await apiFetch("/api/salons/" + encodeURIComponent(salon.id));
      if (ok) {
        const detail = payload.data?.salon || payload.salon;
        if (detail && typeof detail === "object") {
          setSelectedSalon((current) => (
            current && String(current.id) === String(salon.id)
              ? { ...current, ...detail }
              : { ...salon, ...detail }
          ));
          if (typeof detail.isSaved === "boolean") {
            const salonKey = String(salon.id || salon.source_key || salon.name);
            setSavedSalonKeys((items) => {
              if (detail.isSaved) return items.includes(salonKey) ? items : [...items, salonKey];
              return items.includes(salonKey) ? items.filter((item) => item !== salonKey) : items;
            });
          }
        }
      }
    } catch {
      // keep the list row
    }
  };

  return {
    getPassportMatch,
    getPortfolioCardStyle,
    refreshSaves,
    goToTab,
    rebookFromBooking,
    openPostOwnerProfile,
    openSalonStaffPublicProfile,
    shareSalonOwnerProfile,
    renderSavedPosts,
    setSalonPreviewWorkId,
    salonPreviewWork,
    selectedPostOwner,
    selectedPostSiblings,
    selectSalonWithDetail
  };
}
