# -*- coding: utf-8 -*-
from pathlib import Path

path = Path(r"C:\Users\novin\Desktop\zibaban\app\page.jsx")
text = path.read_text(encoding="utf-8")


def replace_once(old, new, label):
    global text
    if old not in text:
        print("MISS", label)
        return False
    text = text.replace(old, new, 1)
    print("OK", label)
    return True


# --- refresh role data helpers inserted before refreshSalonSystemData ---
refresh_helpers = '''
  async function refreshExploreFeed() {
    try {
      const response = await fetch("/api/explore/posts");
      const payload = await response.json();
      const posts = (payload.data?.posts || payload.posts || []).map(mapExplorePost).filter(Boolean);
      setExplorePostList(posts);
      if (Array.isArray(payload.data?.savedTitles)) {
        setSavedPostTitles(payload.data.savedTitles.map(String));
      }
      if (payload.data?.ratings && typeof payload.data.ratings === "object") {
        setExplorePostRatings(payload.data.ratings);
      }
    } catch {
      // keep current feed
    }
  }

  async function refreshShopDirectory() {
    try {
      const response = await fetch("/api/shops");
      const payload = await response.json();
      const shops = (payload.data?.shops || payload.shops || []).map(mapShopCard).filter(Boolean);
      setShopDirectory(shops);
    } catch {
      // keep current shops
    }
  }

  async function refreshArtistWorkspace() {
    try {
      const [postsRes, meRes] = await Promise.all([
        fetch("/api/posts"),
        fetch("/api/artist/me")
      ]);
      if (postsRes.ok) {
        const postsPayload = await postsRes.json();
        setArtistPortfolioItems((postsPayload.data?.posts || []).map(mapPortfolioItem).filter(Boolean));
      }
      if (meRes.ok) {
        const mePayload = await meRes.json();
        setArtistServiceList(mePayload.data?.services || []);
        setArtistBookingList((mePayload.data?.bookings || []).map(mapArtistBooking).filter(Boolean));
      }
      if (createdProfile?.data?.name || createdProfile?.type === "artist") {
        // reviews for own public profile use user id when available later
      }
    } catch {
      // ignore
    }
  }

  async function refreshShopWorkspace() {
    try {
      const response = await fetch("/api/shop/me");
      if (!response.ok) return;
      const payload = await response.json();
      setShopCatalog((payload.data?.products || []).map(mapShopProduct).filter(Boolean));
      setShopOrderList(payload.data?.orders || []);
    } catch {
      // ignore
    }
  }

  async function refreshFollows() {
    try {
      const response = await fetch("/api/follows");
      if (!response.ok) return;
      const payload = await response.json();
      const ids = (payload.data?.followingIds || []).map(String);
      setFollowedArtists(ids);
      setFollowedSalons(ids);
    } catch {
      // ignore
    }
  }

'''

anchor = "  async function refreshSalonSystemData() {"
if "async function refreshExploreFeed()" not in text:
    if anchor in text:
        text = text.replace(anchor, refresh_helpers + anchor, 1)
        print("OK refresh helpers")
    else:
        print("MISS refreshSalonSystemData")

# --- loadSavedData ---
old_load = '''  useEffect(() => {
    const bootId = ++authBootRef.current;

    async function loadSavedData() {
      try {
        const [profileResponse, walletResponse, salonsResponse] = await Promise.all([
          fetch("/api/profile"),
          fetch("/api/wallet"),
          fetch("/api/salons")
        ]);
        const passportResponse = await fetch("/api/beauty-passport");
        if (bootId !== authBootRef.current) return;

        const profilePayload = await profileResponse.json();
        const walletPayload = await walletResponse.json();
        const salonsPayload = await salonsResponse.json();
        const passportPayload = await passportResponse.json();
        if (bootId !== authBootRef.current) return;

        // Signup/login won the race while boot request was in flight.
        if (sessionLockedRef.current) {
          setShellBalance(walletPayload.shellBalance || 0);
          setWalletTransactions(walletPayload.transactions || []);
          setSalonDirectory(salonsPayload.salons || []);
          setBeautyPassport(passportPayload.passport || null);
          return;
        }

        const savedProfile = normalizeProfile(profilePayload.profile);
        const hasSession = Boolean(readAuthSession());

        if (savedProfile && hasSession) {
          sessionLockedRef.current = true;
          setCreatedProfile(savedProfile);
          setProfileType(savedProfile.type);
          setActiveTab("feed");
        } else if (savedProfile && !hasSession) {
          setCreatedProfile(null);
          setActiveTab("profile");
          setAuthMode("login");
        } else {
          setCreatedProfile(null);
          setActiveTab("profile");
          setAuthMode("signup");
          if (hasSession) {
            window.localStorage.removeItem(AUTH_SESSION_KEY);
          }
        }
        setShellBalance(walletPayload.shellBalance || 0);
        setWalletTransactions(walletPayload.transactions || []);
        setSalonDirectory(salonsPayload.salons || []);
        setBeautyPassport(passportPayload.passport || null);
        if (savedProfile?.type === "salon" && hasSession) {
          await refreshSalonSystemData();
        }
      } catch {
        if (bootId !== authBootRef.current) return;
        setShellNotice("ذخیره‌سازی محلی آماده نشد؛ دوباره صفحه را باز کن.");
      } finally {
        if (bootId === authBootRef.current) {
          setAuthChecked(true);
        }
      }
    }

    loadSavedData();
  }, []);'''

new_load = '''  useEffect(() => {
    const bootId = ++authBootRef.current;

    async function loadSavedData() {
      try {
        const [meResponse, salonsResponse] = await Promise.all([
          fetch("/api/auth/me"),
          fetch("/api/salons")
        ]);
        if (bootId !== authBootRef.current) return;

        const mePayload = await meResponse.json();
        const salonsPayload = await salonsResponse.json();
        if (bootId !== authBootRef.current) return;

        await refreshExploreFeed();
        await refreshShopDirectory();
        if (bootId !== authBootRef.current) return;

        setSalonDirectory(salonsPayload.salons || salonsPayload.data?.salons || []);

        if (sessionLockedRef.current) {
          return;
        }

        const savedProfile = normalizeProfile(mePayload.profile || mePayload.data?.user);
        if (savedProfile) {
          sessionLockedRef.current = true;
          writeAuthSession(savedProfile);
          setCreatedProfile(savedProfile);
          setProfileType(savedProfile.type);
          setActiveTab("feed");

          const [walletResponse, passportResponse] = await Promise.all([
            fetch("/api/wallet"),
            fetch("/api/beauty-passport")
          ]);
          if (bootId !== authBootRef.current) return;
          const walletPayload = walletResponse.ok ? await walletResponse.json() : {};
          const passportPayload = passportResponse.ok ? await passportResponse.json() : {};
          setShellBalance(walletPayload.shellBalance || walletPayload.data?.shellBalance || 0);
          setWalletTransactions(walletPayload.transactions || walletPayload.data?.transactions || []);
          setBeautyPassport(passportPayload.passport || passportPayload.data?.passport || null);

          await refreshFollows();
          if (savedProfile.type === "salon") await refreshSalonSystemData();
          if (savedProfile.type === "artist") await refreshArtistWorkspace();
          if (savedProfile.type === "shop") await refreshShopWorkspace();
        } else {
          setCreatedProfile(null);
          setActiveTab("profile");
          setAuthMode(readAuthSession() ? "login" : "signup");
          if (readAuthSession()) window.localStorage.removeItem(AUTH_SESSION_KEY);
          setShellBalance(0);
          setWalletTransactions([]);
          setBeautyPassport(null);
        }
      } catch {
        if (bootId !== authBootRef.current) return;
        setShellNotice("اتصال به سرور برقرار نشد؛ دوباره صفحه را باز کن.");
      } finally {
        if (bootId === authBootRef.current) {
          setAuthChecked(true);
        }
      }
    }

    loadSavedData();
  }, []);'''

replace_once(old_load, new_load, "loadSavedData")

# --- login: after success refresh role data ---
old_login_tail = '''      enterAuthenticatedSession(profile, "feed");
      if (profile?.type === "salon") {
        await refreshSalonSystemData();
      }
      setShellNotice("با موفقیت وارد شدی.");'''

new_login_tail = '''      enterAuthenticatedSession(profile, "feed");
      await refreshExploreFeed();
      await refreshShopDirectory();
      await refreshFollows();
      try {
        const [walletResponse, passportResponse, salonsResponse] = await Promise.all([
          fetch("/api/wallet"),
          fetch("/api/beauty-passport"),
          fetch("/api/salons")
        ]);
        const walletPayload = walletResponse.ok ? await walletResponse.json() : {};
        const passportPayload = passportResponse.ok ? await passportResponse.json() : {};
        const salonsPayload = await salonsResponse.json();
        setShellBalance(walletPayload.shellBalance || walletPayload.data?.shellBalance || 0);
        setWalletTransactions(walletPayload.transactions || walletPayload.data?.transactions || []);
        setBeautyPassport(passportPayload.passport || passportPayload.data?.passport || null);
        setSalonDirectory(salonsPayload.salons || salonsPayload.data?.salons || []);
      } catch {
        // ignore secondary loads
      }
      if (profile?.type === "salon") await refreshSalonSystemData();
      if (profile?.type === "artist") await refreshArtistWorkspace();
      if (profile?.type === "shop") await refreshShopWorkspace();
      setShellNotice("با موفقیت وارد شدی.");'''

replace_once(old_login_tail, new_login_tail, "login refresh")

# --- register via /api/auth/register ---
old_register = '''    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data })
      });
      const payload = await response.json();
      if (!response.ok) {
        setAuthNotice(payload.error || "ثبت‌نام انجام نشد؛ دوباره امتحان کن.");
        return;
      }

      // Confirm persistence before entering the app.
      const verifyResponse = await fetch("/api/profile");
      const verifyPayload = await verifyResponse.json();
      const profile = normalizeProfile(verifyPayload.profile || payload.profile);
      if (!profile?.data?.phone) {
        setAuthNotice("ثبت‌نام در دیتابیس ذخیره نشد؛ دوباره امتحان کن.");
        return;
      }

      enterAuthenticatedSession(profile, "feed");
      if (type === "salon") {
        await refreshSalonSystemData();
      }
      setShellNotice("پروفایل در دیتابیس ذخیره شد.");
    } catch {
      setAuthNotice("ثبت‌نام انجام نشد؛ دوباره امتحان کن.");
      setShellNotice("ذخیره پروفایل انجام نشد؛ دوباره امتحان کن.");
    }'''

new_register = '''    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, data, phone: data.phone, password: data.password })
      });
      const payload = await response.json();
      if (!response.ok) {
        setAuthNotice(payload.error || "ثبت‌نام انجام نشد؛ دوباره امتحان کن.");
        return;
      }

      const profile = normalizeProfile(payload.profile || payload.data?.user);
      if (!profile?.data?.phone) {
        setAuthNotice("ثبت‌نام در دیتابیس ذخیره نشد؛ دوباره امتحان کن.");
        return;
      }

      enterAuthenticatedSession(profile, "feed");
      await refreshExploreFeed();
      await refreshShopDirectory();
      if (type === "salon") await refreshSalonSystemData();
      if (type === "artist") await refreshArtistWorkspace();
      if (type === "shop") await refreshShopWorkspace();
      setShellNotice("حساب ساخته شد و آماده استفاده است.");
    } catch {
      setAuthNotice("ثبت‌نام انجام نشد؛ دوباره امتحان کن.");
      setShellNotice("ذخیره پروفایل انجام نشد؛ دوباره امتحان کن.");
    }'''

replace_once(old_register, new_register, "register")

# --- logout ---
old_logout = '''  async function logoutAccount() {
    clearAuthSession();
    setModelSheetOpen(false);
    setProfileEditOpen(false);
    setProfileEditAvatar("");
    setShellNotice("از حساب خارج شدی.");
  }'''

new_logout = '''  async function logoutAccount() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    clearAuthSession();
    setExplorePostList([]);
    setShopDirectory([]);
    setShopCatalog([]);
    setShopOrderList([]);
    setArtistPortfolioItems([]);
    setArtistServiceList([]);
    setArtistBookingList([]);
    setArtistReviewList([]);
    setSavedPostTitles([]);
    setFollowedArtists([]);
    setFollowedSalons([]);
    setShellBalance(0);
    setWalletTransactions([]);
    setBeautyPassport(null);
    setModelSheetOpen(false);
    setProfileEditOpen(false);
    setProfileEditAvatar("");
    setShellNotice("از حساب خارج شدی.");
    await refreshExploreFeed();
    await refreshShopDirectory();
  }'''

replace_once(old_logout, new_logout, "logout")

# --- toggleSavedPost async with API ---
old_toggle_save = '''  function toggleSavedPost(title) {
    setSavedPostTitles((titles) => {
      if (titles.includes(title)) {
        return titles.filter((item) => item !== title);
      }
      return [...titles, title];
    });
  }'''

new_toggle_save = '''  async function toggleSavedPost(titleOrId, post) {
    const key = post?.id != null ? String(post.id) : String(titleOrId);
    const title = post?.title || titleOrId;
    setSavedPostTitles((titles) => {
      if (titles.includes(key) || titles.includes(title)) {
        return titles.filter((item) => item !== key && item !== title);
      }
      return [key, ...titles];
    });
    if (post?.id != null) {
      try {
        const response = await fetch(`/api/posts/${post.id}/save`, { method: "POST" });
        if (!response.ok) throw new Error("save failed");
        await refreshExploreFeed();
      } catch {
        setAppToast("ذخیره در سرور انجام نشد.");
      }
    }
  }'''

replace_once(old_toggle_save, new_toggle_save, "toggleSavedPost")

# --- confirmExploreRating ---
old_rate = '''  function confirmExploreRating(stars) {
    if (!exploreRatingPicker?.title || stars < 1) return;
    const title = exploreRatingPicker.title;
    setExplorePostRatings((prev) => ({ ...prev, [title]: stars }));
    setExploreRatingPicker(null);
    setAppToast(`${["", "۱", "۲", "۳", "۴", "۵"][stars]} ستاره ثبت شد. ممنون!`);
  }'''

new_rate = '''  async function confirmExploreRating(stars) {
    if (!exploreRatingPicker?.title || stars < 1) return;
    const title = exploreRatingPicker.title;
    const postId = exploreRatingPicker.postId;
    setExplorePostRatings((prev) => ({ ...prev, [title]: stars, ...(postId ? { [String(postId)]: stars } : {}) }));
    setExploreRatingPicker(null);
    setAppToast(`${["", "۱", "۲", "۳", "۴", "۵"][stars]} ستاره ثبت شد. ممنون!`);
    if (postId != null) {
      try {
        await fetch(`/api/posts/${postId}/rate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: stars })
        });
        await refreshExploreFeed();
      } catch {
        setAppToast("امتیاز در سرور ذخیره نشد.");
      }
    }
  }'''

replace_once(old_rate, new_rate, "confirmExploreRating")

# openExploreRatingPicker to include postId
old_picker = '''  function openExploreRatingPicker(post) {
    if (!post?.title) return;
    setExploreRatingPicker({
      title: post.title,
      current: explorePostRatings[post.title] || 0,
      hover: 0
    });
  }'''

new_picker = '''  function openExploreRatingPicker(post) {
    if (!post?.title) return;
    setExploreRatingPicker({
      title: post.title,
      postId: post.id,
      current: explorePostRatings[post.id] || explorePostRatings[post.title] || 0,
      hover: 0
    });
  }'''

replace_once(old_picker, new_picker, "openExploreRatingPicker")

# --- toggleFollowSalon ---
old_follow = '''  async function toggleFollowSalon(salon) {
    const nextFollowed = !followedSalons.includes(salon.source_key || salon.name);
    const followKey = salon.source_key || salon.name;

    setFollowedSalons((items) => {
      if (items.includes(followKey)) {
        return items.filter((item) => item !== followKey);
      }
      return [...items, followKey];
    });

    try {
      const response = await fetch("/api/salon-follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceKey: salon.source_key, followed: nextFollowed })
      });
      const payload = await response.json();
      if (payload.follow) {
        setSelectedSalon((current) => current ? { ...current, follower_count: payload.follow.follower_count } : current);
        setSalonDirectory((items) => items.map((item) => (
          item.source_key === payload.follow.source_key ? { ...item, follower_count: payload.follow.follower_count } : item
        )));
      }
    } catch {
      setShellNotice("ذخیره فالو انجام نشد؛ دوباره امتحان کن.");
    }
  }'''

new_follow = '''  async function toggleFollowSalon(salon) {
    const followKey = String(salon.id || salon.source_key || salon.name);
    const nextFollowed = !followedSalons.includes(followKey);

    setFollowedSalons((items) => {
      if (items.includes(followKey)) {
        return items.filter((item) => item !== followKey);
      }
      return [...items, followKey];
    });

    try {
      const response = await fetch("/api/salon-follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ salonUserId: salon.id || Number(salon.source_key), follow: nextFollowed })
      });
      const payload = await response.json();
      if (payload.follow || payload.data) {
        const follow = payload.follow || payload.data;
        setSelectedSalon((current) => current ? { ...current, follower_count: follow.follower_count ?? follow.followerCount } : current);
        setSalonDirectory((items) => items.map((item) => (
          String(item.id || item.source_key) === followKey
            ? { ...item, follower_count: follow.follower_count ?? follow.followerCount }
            : item
        )));
      }
    } catch {
      setShellNotice("ذخیره فالو انجام نشد؛ دوباره امتحان کن.");
    }
  }'''

replace_once(old_follow, new_follow, "toggleFollowSalon")

path.write_text(text, encoding="utf-8")
print("stage2 done")
