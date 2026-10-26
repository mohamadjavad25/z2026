import { useCallback } from "react";
import { updateSalonStaff as updateSalonStaffApi, deleteSalonStaff, joinSalonTeamAsOwner as joinSalonTeamAsOwnerApi, saveSalonHoursWeek as saveSalonHoursWeekRequest, createSalonService as createSalonServiceApi, updateSalonService as updateSalonServiceApi, deleteSalonService as deleteSalonServiceApi } from "../../shared/api/salons";
import { notifyFromResponse } from "../../shared/lib/apiNotify";
import { exitRefusalOf, openExitDialog } from "../exit/exitDialogBus";

export function useSalonCatalogActions({
  safeSalonStaffList,
  shellNotify,
  createdProfile,
  onArtistCollabOffersPatch,
  salonHoursList,
  syncSalonDirectory,
  syncSelectedSalon,
  refreshSalonSystemData,
  salonServiceList,
  setSalonStaffList,
  setSelectedStaffName,
  setSalonHoursList,
  setSalonServiceList,
  serviceArtistConfirmedRef,
  serviceArtistDesiredRef,
  serviceArtistChainRef,
  serviceArtistSavedAtRef
}) {
  const updateSalonStaff = useCallback(async (name, patch, notice) => {
    const person = safeSalonStaffList.find((item) => item.name === name);
    if (!person) return;
    try {
      const result = await updateSalonStaffApi({ ...person, ...patch });
      if (!notifyFromResponse(shellNotify, result, { failure: "تیم ذخیره نشد؛ دوباره بزن." })) {
        return;
      }
      const nextStaff = Array.isArray(result.payload.data?.staff) ? result.payload.data.staff : [];
      setSalonStaffList(nextStaff);
      setSelectedStaffName((current) => patch.name || current || nextStaff[0]?.name || "");
      // Renaming the manager's own row moves their bookings to the new name on the server.
      if (patch.name && person.is_owner) refreshSalonSystemData();
      if (notice) shellNotify(notice);
    } catch {
      shellNotify("تیم ذخیره نشد؛ دوباره بزن.");
    }
  }, [safeSalonStaffList, shellNotify, refreshSalonSystemData]);

  // The manager joins their own team (or edits their card there), so they can be assigned to services and
  // booked like anyone else. An empty body rejoins with what they entered before. Resolves to the saved
  // profile, or null when it failed.
  const joinSalonTeamAsOwner = useCallback(async (body = {}, notice = "حالا خودت هم توی تیمی؛ می‌تونی کارها رو به خودت بدی و برای خودت نوبت ثبت کنی.") => {
    try {
      const result = await joinSalonTeamAsOwnerApi(body);
      if (!notifyFromResponse(shellNotify, result, { failure: "نشد بری توی تیم؛ دوباره بزن." })) {
        return null;
      }
      const nextStaff = Array.isArray(result.payload.data?.staff) ? result.payload.data.staff : [];
      setSalonStaffList(nextStaff);
      // A new name moves the manager's bookings to it on the server.
      if (body.name) refreshSalonSystemData();
      if (notice) shellNotify(notice);
      return result.payload.data?.profile || {};
    } catch {
      shellNotify("نشد بری توی تیم؛ دوباره بزن.");
      return null;
    }
  }, [setSalonStaffList, shellNotify, refreshSalonSystemData]);

  // `confirmed`: the staff sheet already asked (and maybe took the salon's one-line `reason` for the artist).
  const removeSalonStaff = useCallback(async (name, { confirmed = false, reason = "" } = {}) => {
    const person = safeSalonStaffList.find((item) => item.name === name);
    if (!person?.id) return;
    const question = person.is_owner
      ? "خودت از تیم بری بیرون؟ کارتت می‌مونه و روشنش کنی برمی‌گردی. کارهایی که دستی به خودت داده بودی بدون آرتیست می‌مونن؛ نوبت‌های قبلی سر جاشون می‌مونن."
      : `«${person.name}» از تیم برداشته بشه؟ این کار برگشت نداره.`;
    if (!confirmed && typeof window !== "undefined" && !window.confirm(question)) {
      return;
    }
    // One try; a refusal because of confirmed bookings (owner's rules of 2026-10-22) opens the list dialog, whose
    // «ادامه» repeats this same try (with «لغو همهٔ نوبت‌ها» when chosen).
    const attempt = async ({ cancelAll = false } = {}) => {
      const result = await deleteSalonStaff(person.id, { cancelAll, reason });
      const { ok, payload } = result;
      if (!ok) {
        const refusal = exitRefusalOf(result);
        if (refusal) return { ok: false, plan: refusal.plan, message: refusal.message, refusal };
        return { ok: false, message: payload.error || "برداشته نشد؛ دوباره بزن." };
      }
      const nextStaff = Array.isArray(payload.data?.staff) ? payload.data.staff : [];
      setSalonStaffList(nextStaff);
      setSelectedStaffName(nextStaff[0]?.name || "");
      if (person.is_owner) {
        shellNotify("از تیم اومدی بیرون؛ هر وقت روشنش کنی با همین اطلاعات برمی‌گردی.");
      } else if (payload.data?.artistNotified) {
        if (typeof onArtistCollabOffersPatch === "function") {
          onArtistCollabOffersPatch((items) => items.map((offer) => (
            Number(offer.salonId) === Number(createdProfile?.id)
            && Number(offer.artistId || 0) === Number(payload.data?.artistUserId || person.artist_user_id || 0)
              ? { ...offer, status: "پایان یافت" }
              : offer
          )));
        }
        shellNotify(`همکاری با «${name}» تموم شد و بهش خبر دادیم.`);
      } else {
        shellNotify(`همکاری با «${name}» تموم شد و از تیم برداشته شد.`);
      }
      return { ok: true };
    };
    try {
      const result = await attempt();
      if (result.ok) return;
      if (result.refusal) {
        openExitDialog({
          scope: "staff",
          params: { staffId: person.id },
          plan: result.plan,
          message: result.message,
          title: person.is_owner ? "خودت بری بیرون از تیم؟" : `«${person.name}» از تیم برداشته بشه؟`,
          confirmLabel: person.is_owner ? "آره، برم بیرون" : "آره، بردار",
          retry: attempt
        });
        return;
      }
      shellNotify(result.message);
    } catch {
      shellNotify("برداشته نشد؛ دوباره بزن.");
    }
  }, [safeSalonStaffList, createdProfile?.id, onArtistCollabOffersPatch, shellNotify]);

  /** The hours sheet's «ذخیره»: the whole week in one request. true when it was saved. */
  const saveSalonHoursWeek = useCallback(async (hours) => {
    try {
      const result = await saveSalonHoursWeekRequest(hours);
      if (!notifyFromResponse(shellNotify, result, { failure: "ساعت کاری ذخیره نشد؛ دوباره بزن." })) return false;
      setSalonHoursList(result.payload.data?.hours || []);
      shellNotify("ساعت کاری ذخیره شد.");
      return true;
    } catch {
      shellNotify("ساعت کاری ذخیره نشد؛ دوباره بزن.");
      return false;
    }
  }, [shellNotify]);

  /** Dedicated salon "add service" form (name/price/duration only, no hint/tone). */
  const addSalonService = useCallback(async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const { ok, payload } = await createSalonServiceApi({
        name: data.name || "خدمت جدید",
        price: data.price || "",
        duration: data.duration || ""
      });
      if (!ok) {
        shellNotify(payload.error || "خدمت ذخیره نشد؛ دوباره بزن.");
        return;
      }
      const savedService = payload.data?.service;
      if (savedService?.name) {
        setSalonServiceList((items) => (
          items.some((item) => String(item.id) === String(savedService.id)) ? items : [...items, savedService]
        ));
        const ownSalonKey = String(createdProfile?.id || createdProfile?.data?.name || "");
        syncSalonDirectory((items) => items.map((salon) => {
          const isOwnSalon = String(salon.id || salon.source_key || salon.name) === ownSalonKey;
          if (!isOwnSalon) return salon;
          const services = Array.isArray(salon.services) ? salon.services : [];
          return services.some((service) => String(service.id) === String(savedService.id))
            ? salon
            : { ...salon, services: [...services, savedService] };
        }));
        syncSelectedSalon((current) => {
          if (!current) return current;
          const isOwnSalon = String(current.id || current.source_key || current.name) === ownSalonKey;
          if (!isOwnSalon) return current;
          const services = Array.isArray(current.services) ? current.services : [];
          return services.some((service) => String(service.id) === String(savedService.id))
            ? current
            : { ...current, services: [...services, savedService] };
        });
      }
      await refreshSalonSystemData();
      shellNotify("خدمت تازه ذخیره شد.");
      event.currentTarget.reset();
    } catch {
      shellNotify("خدمت ذخیره نشد؛ دوباره بزن.");
    }
  }, [createdProfile?.id, createdProfile?.data?.name, syncSalonDirectory, syncSelectedSalon, refreshSalonSystemData, shellNotify]);

  const assignSalonServiceArtist = useCallback(async (service, staffId) => {
    if (!service?.id) return;
    try {
      const { ok, payload } = await updateSalonServiceApi({
        id: service.id,
        name: service.name,
        price: service.price,
        duration: service.duration,
        staff_id: staffId,
        staff_ids: staffId ? [String(staffId)] : []
      });
      if (!ok) {
        shellNotify(payload.error || "آرتیست انتخاب نشد؛ دوباره بزن.");
        return;
      }
      const saved = payload.data?.service;
      if (saved) {
        const selectedPeople = staffId ? safeSalonStaffList.filter((person) => String(person.id) === String(staffId)) : [];
        const nextService = {
          ...saved,
          staff_id: staffId || null,
          staff_ids: selectedPeople.map((person) => String(person.id)),
          staff_members: selectedPeople,
          staff_names: selectedPeople.map((person) => person.name).filter(Boolean).join("، ")
        };
        setSalonServiceList((items) => items.map((item) => (
          String(item.id) === String(saved.id) ? { ...item, ...nextService } : item
        )));
        syncSalonDirectory((items) => items.map((salon) => {
          const services = Array.isArray(salon.services) ? salon.services : [];
          const hasService = services.some((item) => String(item.id) === String(saved.id));
          if (!hasService) return salon;
          return {
            ...salon,
            services: services.map((item) => String(item.id) === String(saved.id) ? { ...item, ...nextService } : item),
            staff: Array.isArray(salon.staff) && salon.staff.length ? salon.staff : safeSalonStaffList
          };
        }));
        syncSelectedSalon((current) => {
          if (!current) return current;
          const services = Array.isArray(current.services) ? current.services : [];
          const hasService = services.some((item) => String(item.id) === String(saved.id));
          if (!hasService) return current;
          return {
            ...current,
            services: services.map((item) => String(item.id) === String(saved.id) ? { ...item, ...nextService } : item),
            staff: Array.isArray(current.staff) && current.staff.length ? current.staff : safeSalonStaffList
          };
        });
      } else {
        await refreshSalonSystemData();
      }
      // The artist picker is a sheet that stays open so several artists can be ticked in a row.
      const artistName = saved?.staff_name || safeSalonStaffList.find((person) => String(person.id) === String(staffId))?.name;
      shellNotify(artistName ? `حالا «${artistName}» «${service.name}» رو انجام می‌ده.` : `آرتیست «${service.name}» برداشته شد.`);
    } catch {
      shellNotify("آرتیست انتخاب نشد؛ دوباره بزن.");
    }
  }, [safeSalonStaffList, syncSalonDirectory, syncSelectedSalon, refreshSalonSystemData, shellNotify]);

  // Artist ticks on a service: the screen updates the instant you tap, the server catches up in
  // order. `desired` is the latest wanted list per service (so two quick taps on different artists
  // both count even before the first save returns), `confirmed` the last list the server accepted
  // (what we fall back to if a save fails).
  const applyServiceArtists = useCallback((serviceId, nextIds, saved = null) => {
    const selectedPeople = safeSalonStaffList.filter((person) => nextIds.includes(String(person.id)));
    const patch = {
      ...(saved || {}),
      staff_id: nextIds[0] || null,
      staff_ids: nextIds,
      staff_members: selectedPeople,
      staff_names: selectedPeople.map((person) => person.name).filter(Boolean).join("، "),
      staff_name: selectedPeople[0]?.name || "",
      staff_role: selectedPeople[0]?.role || ""
    };
    const merge = (items) => items.map((item) => (String(item.id) === String(serviceId) ? { ...item, ...patch } : item));
    setSalonServiceList(merge);
    syncSalonDirectory((items) => items.map((salon) => {
      const services = Array.isArray(salon.services) ? salon.services : [];
      if (!services.some((item) => String(item.id) === String(serviceId))) return salon;
      return {
        ...salon,
        services: merge(services),
        staff: Array.isArray(salon.staff) && salon.staff.length ? salon.staff : safeSalonStaffList
      };
    }));
    syncSelectedSalon((current) => {
      if (!current) return current;
      const services = Array.isArray(current.services) ? current.services : [];
      if (!services.some((item) => String(item.id) === String(serviceId))) return current;
      return {
        ...current,
        services: merge(services),
        staff: Array.isArray(current.staff) && current.staff.length ? current.staff : safeSalonStaffList
      };
    });
  }, [safeSalonStaffList, syncSalonDirectory, syncSelectedSalon]);

  const toggleSalonServiceArtist = useCallback((service, staffId) => {
    if (!service?.id) return;
    const key = String(service.id);
    const fromService = Array.isArray(service.staff_ids)
      ? service.staff_ids.map(String)
      : String(service.staff_ids || "").trim()
        ? String(service.staff_ids).split(",").map((id) => id.trim()).filter(Boolean)
      : service.staff_id
        ? [String(service.staff_id)]
        : [];
    if (!serviceArtistConfirmedRef.current.has(key)) serviceArtistConfirmedRef.current.set(key, fromService);
    const currentIds = serviceArtistDesiredRef.current.get(key) ?? fromService;
    const id = String(staffId);
    const nextIds = currentIds.includes(id) ? currentIds.filter((item) => item !== id) : [...currentIds, id];
    serviceArtistDesiredRef.current.set(key, nextIds);
    serviceArtistSavedAtRef.current.delete(key);
    applyServiceArtists(service.id, nextIds);

    const previous = serviceArtistChainRef.current.get(key) || Promise.resolve();
    const next = previous.then(async () => {
      try {
        const { ok, payload } = await updateSalonServiceApi({
          id: service.id,
          name: service.name,
          price: service.price,
          duration: service.duration,
          staff_id: nextIds[0] || null,
          staff_ids: nextIds
        });
        if (!ok) throw new Error(payload?.error || "");
        serviceArtistConfirmedRef.current.set(key, nextIds);
      } catch (error) {
        const confirmed = serviceArtistConfirmedRef.current.get(key) || [];
        serviceArtistDesiredRef.current.set(key, confirmed);
        applyServiceArtists(service.id, confirmed);
        shellNotify(error?.message || "آرتیست ذخیره نشد؛ دوباره بزن.");
      }
      // Only the last save in the queue marks the service as settled; a refresh that starts after this
      // moment sees the saved data, any earlier one is overridden by the local list.
      if (serviceArtistChainRef.current.get(key) === next) serviceArtistSavedAtRef.current.set(key, Date.now());
    });
    serviceArtistChainRef.current.set(key, next);
    // Safety net: forget the override long after the last save even if no refresh ever came by.
    next.then(() => {
      window.setTimeout(() => {
        if (serviceArtistChainRef.current.get(key) !== next) return;
        serviceArtistChainRef.current.delete(key);
        serviceArtistDesiredRef.current.delete(key);
        serviceArtistConfirmedRef.current.delete(key);
        serviceArtistSavedAtRef.current.delete(key);
      }, 60000);
    });
  }, [applyServiceArtists, shellNotify]);

  const deleteSalonService = useCallback(async (id) => {
    const target = salonServiceList.find((item) => item.id === id);
    const confirmed = typeof window === "undefined"
      || window.confirm(target ? `«${target.name}» پاک بشه؟ این کار برگشت نداره.` : "این خدمت پاک بشه؟ این کار برگشت نداره.");
    if (!confirmed) return false;
    try {
      const result = await deleteSalonServiceApi(id);
      if (!notifyFromResponse(shellNotify, result, { failure: "خدمت پاک نشد؛ دوباره بزن." })) {
        return false;
      }
      if (Array.isArray(result.payload.data?.services)) {
        setSalonServiceList(result.payload.data.services);
      }
      await refreshSalonSystemData();
      shellNotify("خدمت پاک شد.");
      return true;
    } catch {
      shellNotify("خدمت پاک نشد؛ دوباره بزن.");
      return false;
    }
  }, [salonServiceList, refreshSalonSystemData, shellNotify]);

  return {
    updateSalonStaff,
    removeSalonStaff,
    joinSalonTeamAsOwner,
    saveSalonHoursWeek,
    addSalonService,
    assignSalonServiceArtist,
    toggleSalonServiceArtist,
    deleteSalonService
  };
}
