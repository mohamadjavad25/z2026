import { useCallback } from "react";
import { updateSalonCollabs, getSalonInvites, createSalonInvite, deleteSalonInvite } from "../../shared/api/salons";
import { getApiErrorMessage } from "../../shared/lib/apiNotify";
import { getArtists } from "../../shared/api/artists";

export function useSalonInviteActions({
  shellNotify,
  safeSalonStaffList,
  createdProfile,
  artistInviteBusyId,
  salonRequestBusyIdRef,
  setSalonRequestBusyId,
  setSalonCollabRequestList,
  setSalonStaffList,
  setSelectedStaffName,
  setArtistInviteOpen,
  setNearbyArtistsLoading,
  setSalonArtistInviteList,
  setNearbyArtists,
  setArtistInviteBusyId
}) {
  const updateSalonCollabRequest = useCallback(async (id, status) => {
    if (!id || salonRequestBusyIdRef.current) return;
    const busyKey = `collab:${id}`;
    salonRequestBusyIdRef.current = busyKey;
    setSalonRequestBusyId(busyKey);
    try {
      const { ok, payload } = await updateSalonCollabs({ id, status });
      if (!ok) {
        shellNotify(getApiErrorMessage(payload, "به‌روزرسانی پیشنهاد همکاری انجام نشد."));
        return;
      }
      setSalonCollabRequestList(payload.data?.collabs || []);
      if (Array.isArray(payload.data?.staff)) {
        setSalonStaffList(payload.data.staff);
        setSelectedStaffName((current) => current || payload.data.staff[0]?.name || "");
      }
      shellNotify(status === "تایید شد"
        ? (payload.data?.staffCreated ? "پیشنهاد تایید شد و آرتیست به پرسنل اضافه شد." : "پیشنهاد تایید شد؛ این آرتیست قبلا در پرسنل بود.")
        : "پیشنهاد همکاری رد شد.");
    } catch {
      shellNotify("به‌روزرسانی پیشنهاد همکاری انجام نشد.");
    } finally {
      salonRequestBusyIdRef.current = "";
      setSalonRequestBusyId("");
    }
  }, [shellNotify]);

  const openNearbyArtistInvite = useCallback(async () => {
    setArtistInviteOpen(true);
    setNearbyArtistsLoading(true);
    try {
      const [artistsRes, invitesRes] = await Promise.all([getArtists(), getSalonInvites()]);
      const invites = Array.isArray(invitesRes.data?.invites) ? invitesRes.data.invites : [];
      setSalonArtistInviteList(invites);
      const artists = Array.isArray(artistsRes.data?.artists) ? artistsRes.data.artists : [];
      const staffIds = new Set(
        safeSalonStaffList
          .map((person) => Number(person.artist_user_id || person.artistUserId || 0))
          .filter(Boolean)
      );
      const pendingInviteIds = new Set(
        invites
          .filter((item) => item.status === "در انتظار تایید")
          .map((item) => Number(item.artistId || 0))
          .filter(Boolean)
      );
      const staffNames = new Set(
        safeSalonStaffList
          .map((person) => String(person.artist_name || person.name || "").trim())
          .filter(Boolean)
      );
      const salonArea = String(createdProfile?.data?.area || "").trim();
      const filtered = artists
        .filter((artist) => {
          const id = Number(artist.id || 0);
          const name = String(artist.name || "").trim();
          if (id && staffIds.has(id)) return false;
          if (id && pendingInviteIds.has(id)) return false;
          if (name && staffNames.has(name)) return false;
          // An artist with no bio/specialty set hasn't filled in anything
          // a salon could actually invite them to collaborate on yet.
          if (!artist.bio || !artist.service) return false;
          return true;
        })
        .map((artist) => {
          const area = String(artist.area || "").trim();
          const sameArea = Boolean(salonArea && area && (area.includes(salonArea) || salonArea.includes(area)));
          return { ...artist, isNearby: sameArea };
        })
        .sort((a, b) => Number(b.isNearby) - Number(a.isNearby) || String(a.name || "").localeCompare(String(b.name || ""), "fa"));
      setNearbyArtists(filtered);
    } catch {
      setNearbyArtists([]);
      shellNotify("لیست آرتیست‌ها دریافت نشد؛ دوباره امتحان کن.");
    } finally {
      setNearbyArtistsLoading(false);
    }
  }, [safeSalonStaffList, createdProfile?.data?.area, shellNotify]);

  const inviteNearbyArtist = useCallback(async (artist, terms = {}) => {
    if (!artist?.id || artistInviteBusyId) return;
    setArtistInviteBusyId(String(artist.id));
    try {
      const { ok, payload } = await createSalonInvite({
        artist_user_id: artist.id,
        role: artist.service || "آرتیست",
        bio: artist.bio || artist.area || "دعوت‌شده از آرتیست‌های نزدیک",
        access_level: "همکار",
        days: terms.days || "",
        from: terms.from || "",
        to: terms.to || "",
        share: terms.share || "",
        capacity: terms.capacity || ""
      });
      if (!ok) {
        shellNotify(payload.error || "دعوت آرتیست انجام نشد.");
        return;
      }
      setSalonArtistInviteList(Array.isArray(payload.data?.invites) ? payload.data.invites : []);
      setNearbyArtists((current) => current.filter((item) => Number(item.id) !== Number(artist.id)));
      shellNotify(`دعوت برای «${artist.name || "آرتیست"}» ارسال شد؛ تا تایید آرتیست نهایی نیست.`);
    } catch {
      shellNotify("دعوت آرتیست انجام نشد؛ دوباره امتحان کن.");
    } finally {
      setArtistInviteBusyId("");
    }
  }, [artistInviteBusyId, shellNotify]);

  const cancelSalonArtistInvite = useCallback(async (inviteId) => {
    try {
      const { ok, payload } = await deleteSalonInvite(inviteId);
      if (!ok) {
        shellNotify(payload.error || "لغو دعوت انجام نشد.");
        return;
      }
      setSalonArtistInviteList(Array.isArray(payload.data?.invites) ? payload.data.invites : []);
      shellNotify("دعوت لغو شد.");
    } catch {
      shellNotify("لغو دعوت انجام نشد؛ دوباره امتحان کن.");
    }
  }, [shellNotify]);

  return {
    updateSalonCollabRequest,
    openNearbyArtistInvite,
    inviteNearbyArtist,
    cancelSalonArtistInvite
  };
}
