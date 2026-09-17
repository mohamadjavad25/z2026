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


replace_once(
    """  const isFollowingPublicArtist = selectedPublicArtist
    ? followedArtists.includes(selectedPublicArtist.name)
    : false;""",
    """  const isFollowingPublicArtist = selectedPublicArtist
    ? followedArtists.includes(String(selectedPublicArtist.id || selectedPublicArtist.name))
      || followedArtists.includes(selectedPublicArtist.name)
    : false;""",
    "isFollowingPublicArtist"
)

# Artist booking create
replace_once(
    """  function handleArtistBookingCreate(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const client = String(data.client || "").trim();
    const phone = String(data.phone || "").trim();
    const service = String(data.service || "").trim();
    const time = String(data.time || "").trim();
    const date = String(data.date || "امروز").trim();
    if (!client || !service || !time) {
      setAppToast("نام، خدمت و ساعت را کامل کن.");
      return;
    }
    const taken = artistBookingList.some((item) => item.time === time && item.date === date);
    if (taken) {
      setAppToast("این ساعت در این روز قبلاً رزرو شده.");
      return;
    }
    setArtistBookingList((prev) => [
      {
        id: `artist-booking-${Date.now()}`,
        time,
        date,
        client,
        phone,
        service,
        status: "تایید",
        history: "day",
        visits: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1]
      },
      ...prev
    ]);
    setArtistBookingCreateOpen(false);
    setArtistBookingRailOpen(true);
    setAppToast(`نوبت ${time} برای ${client} ثبت شد.`);
    event.currentTarget.reset();
  }""",
    """  async function handleArtistBookingCreate(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const client = String(data.client || "").trim();
    const phone = String(data.phone || "").trim();
    const service = String(data.service || "").trim();
    const time = String(data.time || "").trim();
    const date = String(data.date || "امروز").trim();
    if (!client || !service || !time) {
      setAppToast("نام، خدمت و ساعت را کامل کن.");
      return;
    }
    const taken = artistBookingList.some((item) => item.time === time && item.date === date);
    if (taken) {
      setAppToast("این ساعت در این روز قبلاً رزرو شده.");
      return;
    }
    try {
      const response = await fetch("/api/artist/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "booking", client, phone, service, time, date, status: "تایید" })
      });
      const payload = await response.json();
      if (!response.ok) {
        setAppToast(payload.error || "ثبت نوبت انجام نشد.");
        return;
      }
      await refreshArtistWorkspace();
      setArtistBookingCreateOpen(false);
      setArtistBookingRailOpen(true);
      setAppToast(`نوبت ${time} برای ${client} ثبت شد.`);
      event.currentTarget.reset();
    } catch {
      setAppToast("ثبت نوبت انجام نشد.");
    }
  }""",
    "handleArtistBookingCreate"
)

replace_once(
    """  function addArtistService(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const name = String(data.name || "").trim();
    const price = String(data.price || "").trim();
    const duration = String(data.duration || "").trim();
    const hint = String(data.hint || "").trim();
    if (!name) {
      setAppToast("نام خدمت را وارد کن.");
      return;
    }
    setArtistServiceList((prev) => [
      ...prev,
      {
        id: `artist-service-${Date.now()}`,
        name,
        price: price || "توافقی",
        duration: duration || "۶۰ دقیقه",
        hint: hint || "خدمت سفارشی",
        tone: "soft"
      }
    ]);
    setArtistServiceCreateOpen(false);
    setAppToast(`خدمت «${name}» اضافه شد.`);
    event.currentTarget.reset();
  }""",
    """  async function addArtistService(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const name = String(data.name || "").trim();
    const price = String(data.price || "").trim();
    const duration = String(data.duration || "").trim();
    const hint = String(data.hint || "").trim();
    if (!name) {
      setAppToast("نام خدمت را وارد کن.");
      return;
    }
    try {
      const response = await fetch("/api/artist/me", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          price: price || "توافقی",
          duration: duration || "۶۰ دقیقه",
          hint: hint || "خدمت سفارشی",
          tone: "soft"
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        setAppToast(payload.error || "افزودن خدمت انجام نشد.");
        return;
      }
      await refreshArtistWorkspace();
      setArtistServiceCreateOpen(false);
      setAppToast(`خدمت «${name}» اضافه شد.`);
      event.currentTarget.reset();
    } catch {
      setAppToast("افزودن خدمت انجام نشد.");
    }
  }""",
    "addArtistService"
)

replace_once(
    """  function editArtistService(item) {
    const name = window.prompt("نام خدمت", item.name);
    if (name === null) return;
    const price = window.prompt("قیمت", item.price || "");
    if (price === null) return;
    const duration = window.prompt("زمان انجام", item.duration || "");
    if (duration === null) return;
    const hint = window.prompt("توضیح کوتاه", item.hint || "");
    if (hint === null) return;
    const nextName = String(name).trim();
    if (!nextName) {
      setAppToast("نام خدمت نمی‌تواند خالی باشد.");
      return;
    }
    setArtistServiceList((prev) => prev.map((service) => (
      service.id === item.id
        ? {
            ...service,
            name: nextName,
            price: String(price).trim() || service.price,
            duration: String(duration).trim() || service.duration,
            hint: String(hint).trim() || service.hint
          }
        : service
    )));
    setAppToast("خدمت به‌روزرسانی شد.");
  }

  function deleteArtistService(id) {
    setArtistServiceList((prev) => prev.filter((service) => service.id !== id));
    setAppToast("خدمت حذف شد.");
  }""",
    """  async function editArtistService(item) {
    const name = window.prompt("نام خدمت", item.name);
    if (name === null) return;
    const price = window.prompt("قیمت", item.price || "");
    if (price === null) return;
    const duration = window.prompt("زمان انجام", item.duration || "");
    if (duration === null) return;
    const hint = window.prompt("توضیح کوتاه", item.hint || "");
    if (hint === null) return;
    const nextName = String(name).trim();
    if (!nextName) {
      setAppToast("نام خدمت نمی‌تواند خالی باشد.");
      return;
    }
    try {
      const response = await fetch("/api/artist/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          name: nextName,
          price: String(price).trim() || item.price,
          duration: String(duration).trim() || item.duration,
          hint: String(hint).trim() || item.hint
        })
      });
      if (!response.ok) {
        const payload = await response.json();
        setAppToast(payload.error || "ویرایش خدمت انجام نشد.");
        return;
      }
      await refreshArtistWorkspace();
      setAppToast("خدمت به‌روزرسانی شد.");
    } catch {
      setAppToast("ویرایش خدمت انجام نشد.");
    }
  }

  async function deleteArtistService(id) {
    try {
      const response = await fetch("/api/artist/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (!response.ok) {
        const payload = await response.json();
        setAppToast(payload.error || "حذف خدمت انجام نشد.");
        return;
      }
      await refreshArtistWorkspace();
      setAppToast("خدمت حذف شد.");
    } catch {
      setAppToast("حذف خدمت انجام نشد.");
    }
  }""",
    "edit/deleteArtistService"
)

replace_once(
    """  function syncArtistWorkToExplore(item) {
    const salon = createdProfile?.data?.name || "آرتیست";
    if (item.inExplore) {
      const post = {
        title: item.title,
        salon,
        area: createdProfile?.data?.area || "آرتیست",
        tag: item.tag,
        meta: item.caption || "",
        saves: item.saves || "۰",
        views: item.views || "۰",
        rating: item.rating || "۴.۸",
        comments: "۰",
        color: "teal",
        badge: item.featured ? "ویترین" : "گالری",
        tile: "tile4",
        image: item.image,
        portfolioId: item.id
      };
      setPublishedAiPosts((prev) => [post, ...prev.filter((p) => p.portfolioId !== item.id)]);
    } else {
      setPublishedAiPosts((prev) => prev.filter((p) => p.portfolioId !== item.id));
    }
  }

  function resolveExploreArtist(post) {
    if (!post) return null;
    const fromCatalog = exploreArtistCatalog[post.salon];
    const fromDirectory = salonDirectory.find((salon) => salon.name === post.salon);

    if (createdProfile?.data?.name === post.salon && (createdProfile.type === "artist" || createdProfile.type === "salon")) {
      return {
        name: createdProfile.data.name,
        area: createdProfile.data.area || post.area || "",
        role: createdProfile.data.service || createdProfile.data.tag || post.tag || (createdProfile.type === "salon" ? "سالن زیبایی" : "آرتیست"),
        rating: post.rating || "۴.۸",
        bio: createdProfile.data.bio || post.meta || "",
        source: createdProfile,
        kind: "self",
        entityType: createdProfile.type
      };
    }

    const entityType = fromCatalog?.type || (fromDirectory ? "salon" : "artist");

    if (entityType === "salon") {
      return {
        name: fromDirectory?.name || fromCatalog?.name || post.salon || "سالن",
        area: fromDirectory?.area || fromCatalog?.area || post.area || "",
        role: fromCatalog?.role || fromDirectory?.specialty || fromDirectory?.tag || post.tag || "سالن زیبایی",
        rating: fromDirectory?.rating || fromCatalog?.rating || post.rating || "۴.۸",
        bio: fromCatalog?.bio || fromDirectory?.bio || post.meta || "",
        source: fromDirectory || null,
        kind: "salon",
        entityType: "salon"
      };
    }

    return {
      name: fromCatalog?.name || post.salon || "آرتیست",
      area: fromCatalog?.area || post.area || "",
      role: fromCatalog?.role || post.tag || "آرتیست",
      rating: fromCatalog?.rating || post.rating || "۴.۸",
      bio: fromCatalog?.bio || post.meta || "",
      source: fromDirectory || null,
      kind: "artist",
      entityType: "artist"
    };
  }

  function openExploreArtistProfile(post) {
    const artist = resolveExploreArtist(post);
    setSelectedPost(null);
    if (!artist) return;

    if (artist.kind === "self") {
      goToTab("profile");
      return;
    }

    if (artist.kind === "salon") {
      setSelectedPublicArtist(null);
      if (artist.source) {
        setSelectedSalon(artist.source);
      } else {
        setSelectedSalon({
          name: artist.name,
          area: artist.area,
          tag: artist.role,
          rating: artist.rating,
          open: "امروز",
          post_count: 0,
          follower_count: 0,
          following_count: 0,
          portfolio: []
        });
      }
      goToTab("salons");
      return;
    }

    setSelectedSalon(null);
    setPublicArtistView("gallery");
    setPublicArtistGalleryFilter("همه");
    setPublicArtistBookingDay(artistBookingDays[0]);
    setPublicArtistBookingSlot("");
    setPublicArtistSelectedServiceId("");
    setSelectedPublicArtist(artist);
  }""",
    """  async function syncArtistWorkToExplore() {
    await refreshExploreFeed();
    if (createdProfile?.type === "artist") {
      await refreshArtistWorkspace();
    }
  }

  function resolveExploreArtist(post) {
    if (!post) return null;
    const fromDirectory = salonDirectory.find((salon) => salon.name === post.salon || salon.id === post.ownerUserId);

    if (createdProfile && (post.ownerUserId === createdProfile.id || createdProfile.data?.name === post.salon)
      && (createdProfile.type === "artist" || createdProfile.type === "salon")) {
      return {
        id: createdProfile.id,
        name: createdProfile.data.name,
        area: createdProfile.data.area || post.area || "",
        role: createdProfile.data.service || post.tag || (createdProfile.type === "salon" ? "سالن زیبایی" : "آرتیست"),
        rating: post.rating || "",
        bio: createdProfile.data.bio || post.meta || "",
        source: createdProfile,
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
        rating: fromDirectory?.rating || post.rating || "",
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
      rating: post.rating || "",
      bio: post.ownerBio || post.meta || "",
      source: null,
      kind: "artist",
      entityType: "artist"
    };
  }

  async function openExploreArtistProfile(post) {
    const artist = resolveExploreArtist(post);
    setSelectedPost(null);
    if (!artist) return;

    if (artist.kind === "self") {
      goToTab("profile");
      return;
    }

    if (artist.kind === "salon") {
      setSelectedPublicArtist(null);
      if (artist.source) {
        setSelectedSalon(artist.source);
      } else {
        setSelectedSalon({
          id: artist.id,
          name: artist.name,
          area: artist.area,
          tag: artist.role,
          rating: artist.rating,
          open: "امروز",
          post_count: 0,
          follower_count: 0,
          following_count: 0,
          portfolio: []
        });
      }
      goToTab("salons");
      return;
    }

    setSelectedSalon(null);
    setPublicArtistView("gallery");
    setPublicArtistGalleryFilter("همه");
    setPublicArtistBookingDay(artistBookingDays[0]);
    setPublicArtistBookingSlot("");
    setPublicArtistSelectedServiceId("");
    setSelectedPublicArtist(artist);
    if (artist.id) {
      try {
        const response = await fetch(`/api/artists/${artist.id}`);
        if (response.ok) {
          const payload = await response.json();
          const full = payload.data?.artist;
          if (full) {
            setSelectedPublicArtist(full);
            setArtistReviewList(full.reviews || []);
            if (full.isFollowing) {
              setFollowedArtists((items) => (
                items.includes(String(full.id)) ? items : [...items, String(full.id)]
              ));
            }
          }
        }
      } catch {
        // keep stub artist
      }
    }
  }""",
    "resolve/open artist"
)

replace_once(
    """  function confirmPublicArtistBooking() {
    if (!selectedPublicArtist) return;
    const service = publicArtistServices.find((item) => item.id === publicArtistSelectedServiceId)
      || publicArtistServices[0];
    if (!service) {
      setAppToast("اول یک خدمت انتخاب کن.");
      return;
    }
    if (!publicArtistBookingDay || !publicArtistBookingSlot) {
      setAppToast("اول روز و ساعت نوبت را انتخاب کن.");
      return;
    }
    setAppToast(
      `رزرو «${service.name}» · ${publicArtistBookingDay} ساعت ${publicArtistBookingSlot} برای «${selectedPublicArtist.name}» ثبت شد.`
    );
  }

  function toggleFollowPublicArtist(artist) {
    if (!artist?.name) return;
    const nextFollowed = !followedArtists.includes(artist.name);
    setFollowedArtists((items) => (
      nextFollowed
        ? [...items, artist.name]
        : items.filter((name) => name !== artist.name)
    ));
    setAppToast(
      nextFollowed
        ? `آرتیست «${artist.name}» را دنبال کردی.`
        : `دنبال کردن «${artist.name}» لغو شد.`
    );
  }""",
    """  async function confirmPublicArtistBooking() {
    if (!selectedPublicArtist) return;
    const service = publicArtistServices.find((item) => item.id === publicArtistSelectedServiceId)
      || publicArtistServices[0];
    if (!service) {
      setAppToast("اول یک خدمت انتخاب کن.");
      return;
    }
    if (!publicArtistBookingDay || !publicArtistBookingSlot) {
      setAppToast("اول روز و ساعت نوبت را انتخاب کن.");
      return;
    }
    if (!selectedPublicArtist.id) {
      setAppToast("آرتیست نامعتبر است.");
      return;
    }
    try {
      const response = await fetch("/api/artist/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artistUserId: selectedPublicArtist.id,
          service: service.name,
          bookingDate: publicArtistBookingDay,
          time: publicArtistBookingSlot,
          clientName: createdProfile?.data?.name || "",
          clientPhone: createdProfile?.data?.phone || ""
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        setAppToast(payload.error || "رزرو انجام نشد.");
        return;
      }
      setAppToast(
        `رزرو «${service.name}» · ${publicArtistBookingDay} ساعت ${publicArtistBookingSlot} برای «${selectedPublicArtist.name}» ثبت شد.`
      );
    } catch {
      setAppToast("رزرو انجام نشد.");
    }
  }

  async function toggleFollowPublicArtist(artist) {
    if (!artist?.id && !artist?.name) return;
    const key = String(artist.id || artist.name);
    const nextFollowed = !(followedArtists.includes(key) || followedArtists.includes(artist.name));
    setFollowedArtists((items) => (
      nextFollowed
        ? [...items.filter((item) => item !== artist.name), key]
        : items.filter((item) => item !== key && item !== artist.name)
    ));
    if (artist.id) {
      try {
        await fetch("/api/follows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetUserId: artist.id })
        });
      } catch {
        setAppToast("فالو در سرور ذخیره نشد.");
        return;
      }
    }
    setAppToast(
      nextFollowed
        ? `آرتیست «${artist.name}» را دنبال کردی.`
        : `دنبال کردن «${artist.name}» لغو شد.`
    );
  }""",
    "booking/follow public artist"
)

replace_once(
    """  function saveArtistWork(event) {
    event.preventDefault();
    if (!editingArtistWork?.id) return;
    const title = String(editingArtistWork.title || "").trim();
    const tag = String(editingArtistWork.tag || "").trim();
    if (!title || !tag) {
      setAppToast("عنوان و دسته لازم است.");
      return;
    }
    const nextItem = {
      ...editingArtistWork,
      title,
      tag,
      caption: String(editingArtistWork.caption || "").trim(),
      inExplore: Boolean(editingArtistWork.inExplore),
      featured: Boolean(editingArtistWork.featured)
    };
    setArtistPortfolioItems((prev) => prev.map((item) => {
      if (item.id === nextItem.id) return { ...item, ...nextItem };
      if (nextItem.featured) return { ...item, featured: false };
      return item;
    }));
    syncArtistWorkToExplore(nextItem);
    setEditingArtistWork(null);
    setAppToast("نمونه‌کار ذخیره شد.");
  }

  function deleteArtistWork() {
    if (!editingArtistWork?.id) return;
    const id = editingArtistWork.id;
    setArtistPortfolioItems((prev) => prev.filter((item) => item.id !== id));
    setPublishedAiPosts((prev) => prev.filter((p) => p.portfolioId !== id));
    setEditingArtistWork(null);
    setPreviewingArtistWorkId((prev) => (prev === id ? null : prev));
    setAppToast("نمونه‌کار از گالری حذف شد.");
  }""",
    """  async function saveArtistWork(event) {
    event.preventDefault();
    if (!editingArtistWork?.id) return;
    const title = String(editingArtistWork.title || "").trim();
    const tag = String(editingArtistWork.tag || "").trim();
    if (!title || !tag) {
      setAppToast("عنوان و دسته لازم است.");
      return;
    }
    const body = {
      title,
      tag,
      caption: String(editingArtistWork.caption || "").trim(),
      image: editingArtistWork.image || "",
      inExplore: Boolean(editingArtistWork.inExplore),
      featured: Boolean(editingArtistWork.featured)
    };
    try {
      const isNew = String(editingArtistWork.id).startsWith("new-") || editingArtistWork.id === "new";
      const response = await fetch(isNew ? "/api/posts" : `/api/posts/${editingArtistWork.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) {
        setAppToast(payload.error || "ذخیره نمونه‌کار انجام نشد.");
        return;
      }
      await syncArtistWorkToExplore();
      setEditingArtistWork(null);
      setAppToast("نمونه‌کار ذخیره شد.");
    } catch {
      setAppToast("ذخیره نمونه‌کار انجام نشد.");
    }
  }

  async function deleteArtistWork() {
    if (!editingArtistWork?.id) return;
    const id = editingArtistWork.id;
    try {
      const response = await fetch(`/api/posts/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = await response.json();
        setAppToast(payload.error || "حذف انجام نشد.");
        return;
      }
      await syncArtistWorkToExplore();
      setEditingArtistWork(null);
      setPreviewingArtistWorkId((prev) => (prev === id ? null : prev));
      setAppToast("نمونه‌کار از گالری حذف شد.");
    } catch {
      setAppToast("حذف انجام نشد.");
    }
  }""",
    "save/delete artist work"
)

replace_once(
    """  function publishAiCreation() {
    if (!analysisReady) {
      setAppToast("اول یک اثر بساز.");
      return;
    }
    const baseTitle = String(styleText || "").trim().slice(0, 36) || "اثر AI جدید";
    const title = `${baseTitle}${baseTitle.length >= 36 ? "…" : ""}`;
    const post = {
      title,
      salon: createdProfile?.data?.name || "استودیو زیبابان",
      area: "AI",
      tag: aiStyleTag === "ادیتوریال" ? "میکاپ" : aiStyleTag,
      meta: `${styleText || activeAiStyle.hint} · ${activeAiLook.id}`,
      saves: "۰",
      comments: "۰",
      color: "teal",
      badge: activeAiLook.id,
      tile: "tile4",
      image: preview || activeAiLook.image
    };
    setPublishedAiPosts((prev) => [post, ...prev.filter((item) => item.title !== title)]);
    setAppToast("اثر در اکسپلور منتشر شد.");
    goToTab("feed");
  }""",
    """  async function publishAiCreation() {
    if (!analysisReady) {
      setAppToast("اول یک اثر بساز.");
      return;
    }
    if (!createdProfile) {
      setAppToast("برای انتشار وارد حساب شو.");
      setActiveTab("profile");
      return;
    }
    const baseTitle = String(styleText || "").trim().slice(0, 36) || "اثر AI جدید";
    const title = `${baseTitle}${baseTitle.length >= 36 ? "…" : ""}`;
    try {
      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          tag: aiStyleTag === "ادیتوریال" ? "میکاپ" : aiStyleTag,
          caption: `${styleText || activeAiStyle.hint} · ${activeAiLook.id}`,
          image: preview || activeAiLook.image,
          inExplore: true,
          featured: false
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        setAppToast(payload.error || "انتشار انجام نشد.");
        return;
      }
      await refreshExploreFeed();
      if (createdProfile.type === "artist") await refreshArtistWorkspace();
      setAppToast("اثر در اکسپلور منتشر شد.");
      goToTab("feed");
    } catch {
      setAppToast("انتشار انجام نشد.");
    }
  }""",
    "publishAiCreation"
)

# saveShopProduct
old_shop = '''  function saveShopProduct(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const name = String(data.name || "").trim();
    const price = String(data.price || "").trim();
    const description = String(data.description || "").trim();
    const stock = Math.max(0, Number(data.stock) || 0);
    if (!name || !price) {
      setAppToast("نام و قیمت محصول لازم است.");
      return;
    }
    if (!shopProductImage) {
      setAppToast("برای محصول یک تصویر آپلود کن.");
      return;
    }
    const tone = getShopProductTone(stock);
    const badge = resolveShopProductBadge(String(data.badge || ""), stock);
    const featured = data.featured === "on";
    const nextProduct = {
      id: editingShopProduct?.id || `p-${Date.now()}`,
      name,
      category: String(data.category || "میکاپ"),
      price,
      stock,
      sold: editingShopProduct?.sold || 0,
      badge,
      image: shopProductImage,
      description,
      featured,
      tone
    };
    setShopCatalog((prev) => {
      if (editingShopProduct) {
        return prev.map((item) => (item.id === editingShopProduct.id ? nextProduct : item));
      }
      return [nextProduct, ...prev];
    });
    setViewingShopProduct(nextProduct);
    setAppToast(
      featured
        ? `${name} در ویترین ویژه تایید شد.`
        : editingShopProduct
          ? `${name} به‌روزرسانی شد.`
          : `${name} با تصویر به کاتالوگ اضافه شد.`
    );
    closeShopProductSheet();
  }'''

new_shop = '''  async function saveShopProduct(event) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    const name = String(data.name || "").trim();
    const price = String(data.price || "").trim();
    const description = String(data.description || "").trim();
    const stock = Math.max(0, Number(data.stock) || 0);
    if (!name || !price) {
      setAppToast("نام و قیمت محصول لازم است.");
      return;
    }
    if (!shopProductImage) {
      setAppToast("برای محصول یک تصویر آپلود کن.");
      return;
    }
    const badge = resolveShopProductBadge(String(data.badge || ""), stock);
    const body = {
      id: editingShopProduct?.id,
      name,
      category: String(data.category || "میکاپ"),
      price,
      priceNum: Number(String(price).replace(/[^0-9]/g, "")) || 0,
      stock,
      badge,
      image: shopProductImage,
      description
    };
    try {
      const response = await fetch("/api/shop/me", {
        method: editingShopProduct ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await response.json();
      if (!response.ok) {
        setAppToast(payload.error || "ذخیره محصول انجام نشد.");
        return;
      }
      await refreshShopWorkspace();
      const nextProduct = mapShopProduct(payload.data?.product) || body;
      setViewingShopProduct(nextProduct);
      setAppToast(editingShopProduct ? `${name} به‌روزرسانی شد.` : `${name} به کاتالوگ اضافه شد.`);
      closeShopProductSheet();
    } catch {
      setAppToast("ذخیره محصول انجام نشد.");
    }
  }'''

replace_once(old_shop, new_shop, "saveShopProduct")

replace_once(
    """  function deleteShopProduct(productId) {
    const target = shopCatalog.find((item) => item.id === productId);
    setShopCatalog((prev) => prev.filter((item) => item.id !== productId));
    setAppToast(target ? `${target.name} حذف شد.` : "محصول حذف شد.");
    if (editingShopProduct?.id === productId) closeShopProductSheet();
    if (viewingShopProduct?.id === productId) closeShopProductDetail();
  }""",
    """  async function deleteShopProduct(productId) {
    const target = shopCatalog.find((item) => item.id === productId);
    try {
      const response = await fetch("/api/shop/me", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: productId })
      });
      if (!response.ok) {
        const payload = await response.json();
        setAppToast(payload.error || "حذف محصول انجام نشد.");
        return;
      }
      await refreshShopWorkspace();
      setAppToast(target ? `${target.name} حذف شد.` : "محصول حذف شد.");
      if (editingShopProduct?.id === productId) closeShopProductSheet();
      if (viewingShopProduct?.id === productId) closeShopProductDetail();
    } catch {
      setAppToast("حذف محصول انجام نشد.");
    }
  }""",
    "deleteShopProduct"
)

# Empty explore state + save with post object
replace_once(
    """            <div className="feedCards">
              {visibleExplorePosts.map((item) => {
                const isSaved = savedPostTitles.includes(item.title);
                return (
                  <article
                    className={`feedCard ${item.color}${item.image ? " hasImage" : ` ${item.tile}`}`}
                    key={item.title}
                    onClick={() => setSelectedPost(item)}
                    aria-label={item.title}
                  >
                    {item.image && <img className="feedCardImage" src={item.image} alt="" aria-hidden="true" />}
                    <button
                      type="button"
                      className={`saveChip ${isSaved ? "saved" : ""}`}
                      aria-label={isSaved ? "حذف از ذخیره‌شده‌ها" : "ذخیره مدل"}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSavedPost(item.title);
                      }}
                    >""",
    """            <div className="feedCards">
              {visibleExplorePosts.length === 0 ? (
                <div className="emptySalonDirectory">
                  <Sparkles size={22} />
                  <b>هنوز پستی در اکسپلور نیست</b>
                  <p>با ثبت‌نام آرتیست و انتشار نمونه‌کار، اینجا پر می‌شود.</p>
                </div>
              ) : null}
              {visibleExplorePosts.map((item) => {
                const isSaved = savedPostTitles.includes(String(item.id)) || savedPostTitles.includes(item.title);
                return (
                  <article
                    className={`feedCard ${item.color}${item.image ? " hasImage" : ` ${item.tile}`}`}
                    key={item.id || item.title}
                    onClick={() => setSelectedPost(item)}
                    aria-label={item.title}
                  >
                    {item.image && <img className="feedCardImage" src={item.image} alt="" aria-hidden="true" />}
                    <button
                      type="button"
                      className={`saveChip ${isSaved ? "saved" : ""}`}
                      aria-label={isSaved ? "حذف از ذخیره‌شده‌ها" : "ذخیره مدل"}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSavedPost(item.title, item);
                      }}
                    >""",
    "explore empty + save"
)

# shops empty - find shops list rendering
# normalizeProfile should keep id
replace_once(
    """  function normalizeProfile(profile) {
    if (!profile) return null;
    return {
      type: profile.type,
      data: {
        name: profile.name || "",
        area: profile.area || "",
        service: profile.service || "",
        phone: profile.phone || "",
        email: profile.email || "",
        avatar: profile.avatar || ""
      }
    };
  }""",
    """  function normalizeProfile(profile) {
    if (!profile) return null;
    return {
      id: profile.id,
      type: profile.type,
      data: {
        name: profile.name || "",
        area: profile.area || "",
        service: profile.service || "",
        phone: profile.phone || "",
        email: profile.email || "",
        avatar: profile.avatar || "",
        bio: profile.bio || ""
      }
    };
  }""",
    "normalizeProfile id"
)

# isFollowingSelectedSalon key
replace_once(
    "const isFollowingSelectedSalon = selectedSalon ? followedSalons.includes(selectedSalon.source_key || selectedSalon.name) : false;",
    "const isFollowingSelectedSalon = selectedSalon ? followedSalons.includes(String(selectedSalon.id || selectedSalon.source_key || selectedSalon.name)) : false;",
    "isFollowingSelectedSalon"
)

# toggleSavedPost in modal
text = text.replace("toggleSavedPost(selectedPost.title)", "toggleSavedPost(selectedPost.title, selectedPost)")
text = text.replace("toggleSavedPost(item.title);", "toggleSavedPost(item.title, item);")

path.write_text(text, encoding="utf-8")
print("stage3 done")
