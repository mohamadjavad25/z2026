import { useCallback } from "react";
import { updateSalonStaff as updateSalonStaffApi, deleteSalonStaff, joinSalonTeamAsOwner as joinSalonTeamAsOwnerApi, updateSalonHours, createSalonService as createSalonServiceApi, updateSalonService as updateSalonServiceApi, deleteSalonService as deleteSalonServiceApi } from "../../shared/api/salons";
import { notifyFromResponse, getApiErrorMessage } from "../../shared/lib/apiNotify";

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
      if (!notifyFromResponse(shellNotify, result, { failure: "به‌روزرسانی پرسنل انجام نشد؛ دوباره امتحان کن." })) {
        return;
      }
      const nextStaff = Array.isArray(result.payload.data?.staff) ? result.payload.data.staff : [];
      setSalonStaffList(nextStaff);
      setSelectedStaffName((current) => patch.name || current || nextStaff[0]?.name || "");
      // Renaming the manager's own row moves their bookings to the new name on the server.
      if (patch.name && person.is_owner) refreshSalonSystemData();
      if (notice) shellNotify(notice);
    } catch {
      shellNotify("به‌روزرسانی پرسنل انجام نشد؛ دوباره امتحان کن.");
    }
  }, [safeSalonStaffList, shellNotify, refreshSalonSystemData]);

  // The manager joins their own team, so they can be assigned to services and booked like anyone else.
  const joinSalonTeamAsOwner = useCallback(async ({ name, role } = {}) => {
    try {
      const result = await joinSalonTeamAsOwnerApi({ name, role });
      if (!notifyFromResponse(shellNotify, result, { failure: "اضافه شدن به تیم انجام نشد؛ دوباره امتحان کن." })) {
        return false;
      }
      const nextStaff = Array.isArray(result.payload.data?.staff) ? result.payload.data.staff : [];
      setSalonStaffList(nextStaff);
      shellNotify("حالا خودت هم عضو تیمی؛ می‌توانی خدمات را به خودت بدهی و برای خودت رزرو ثبت کنی.");
      return true;
    } catch {
      shellNotify("اضافه شدن به تیم انجام نشد؛ دوباره امتحان کن.");
      return false;
    }
  }, [setSalonStaffList, shellNotify]);

  const removeSalonStaff = useCallback(async (name) => {
    const person = safeSalonStaffList.find((item) => item.name === name);
    if (!person?.id) return;
    const question = person.is_owner
      ? "خودت از تیم خارج شوی؟ خدماتی که به خودت داده بودی بدون آرتیست می‌مانند؛ رزروهای قبلی سر جایشان می‌مانند."
      : `«${person.name}» از پرسنل حذف شود؟ این کار قابل بازگشت نیست.`;
    if (typeof window !== "undefined" && !window.confirm(question)) {
      return;
    }
    try {
      const { ok, payload } = await deleteSalonStaff(person.id);
      if (!ok) {
        shellNotify(payload.error || "حذف پرسنل انجام نشد؛ دوباره امتحان کن.");
        return;
      }
      const nextStaff = Array.isArray(payload.data?.staff) ? payload.data.staff : [];
      setSalonStaffList(nextStaff);
      setSelectedStaffName(nextStaff[0]?.name || "");
      if (payload.data?.artistNotified) {
        if (typeof onArtistCollabOffersPatch === "function") {
          onArtistCollabOffersPatch((items) => items.map((offer) => (
            Number(offer.salonId) === Number(createdProfile?.id)
            && Number(offer.artistId || 0) === Number(payload.data?.artistUserId || person.artist_user_id || 0)
              ? { ...offer, status: "پایان یافت" }
              : offer
          )));
        }
        shellNotify(`همکاری با «${name}» پایان یافت و در پروفایل آرتیست اطلاع داده شد.`);
      } else {
        shellNotify(`همکاری با «${name}» پایان یافت و از پرسنل حذف شد.`);
      }
    } catch {
      shellNotify("حذف پرسنل انجام نشد؛ دوباره امتحان کن.");
    }
  }, [safeSalonStaffList, createdProfile?.id, onArtistCollabOffersPatch, shellNotify]);

  const updateSalonHour = useCallback(async (hour, patch) => {
    const nextHour = { ...hour, ...patch };
    try {
      const result = await updateSalonHours(nextHour);
      if (!notifyFromResponse(shellNotify, result, { failure: "به‌روزرسانی تقویم سالن انجام نشد؛ دوباره امتحان کن." })) {
        return;
      }
      setSalonHoursList(result.payload.data?.hours || []);
      shellNotify(`تقویم ${nextHour.day} در دیتابیس سالن ذخیره شد.`);
    } catch {
      shellNotify("به‌روزرسانی تقویم سالن انجام نشد؛ دوباره امتحان کن.");
    }
  }, [shellNotify]);

  const updateSalonHoursPreset = useCallback(async (preset) => {
    const weekendDays = new Set(["پنجشنبه", "جمعه"]);
    const nextHours = salonHoursList.map((hour) => {
      const isWeekend = weekendDays.has(hour.day);
      if (preset === "standard") {
        return { ...hour, open_time: "۱۰:۰۰", close_time: "۲۰:۰۰", capacity: 8, active: !isWeekend };
      }
      if (preset === "extended") {
        return { ...hour, open_time: "۱۰:۰۰", close_time: "۲۲:۰۰", capacity: 12, active: true };
      }
      return { ...hour, open_time: "۱۲:۰۰", close_time: "۱۸:۰۰", capacity: 5, active: isWeekend };
    });
    try {
      const results = await Promise.all(nextHours.map((hour) => updateSalonHours(hour)));
      const failed = results.find((item) => !item.ok);
      if (failed) {
        shellNotify(getApiErrorMessage(failed.payload, "ذخیره گزینه کلی ساعت کاری انجام نشد؛ دوباره امتحان کن."));
        return;
      }
      const latestHours = results[results.length - 1]?.payload?.data?.hours || nextHours;
      setSalonHoursList(latestHours);
      shellNotify("گزینه کلی ساعت کاری روی تقویم سالن اعمال شد.");
    } catch {
      shellNotify("ذخیره گزینه کلی ساعت کاری انجام نشد؛ دوباره امتحان کن.");
    }
  }, [salonHoursList, shellNotify]);

  /**
   * Copies one day's open/close time + capacity onto every other open day,
   * in one batch — the tedious part of the hours editor was setting the
   * same start/end time on each day one at a time; this is the "apply to
   * the rest of the week" shortcut for that. Closed days are left alone.
   */
  const copySalonHourToOpenDays = useCallback(async (sourceHour) => {
    const targets = salonHoursList.filter((hour) => hour.active);
    try {
      // Sequential on purpose (not Promise.all): several concurrent
      // authenticated PATCHes racing the session-touch poll (GET
      // /api/artist/me-equivalent presence heartbeat) could land out of
      // order and make the client-side hours list flicker/reset mid-update.
      let latestHours = salonHoursList;
      for (const hour of targets) {
        const nextHour = { ...hour, open_time: sourceHour.open_time, close_time: sourceHour.close_time, capacity: sourceHour.capacity };
        const result = await updateSalonHours(nextHour);
        if (!result.ok) {
          shellNotify(getApiErrorMessage(result.payload, "اعمال ساعت به بقیه روزها انجام نشد؛ دوباره امتحان کن."));
          return;
        }
        latestHours = result.payload.data?.hours || latestHours;
      }
      setSalonHoursList(latestHours);
      shellNotify("ساعت روی بقیه روزهای باز اعمال شد.");
    } catch {
      shellNotify("اعمال ساعت به بقیه روزها انجام نشد؛ دوباره امتحان کن.");
    }
  }, [salonHoursList, shellNotify]);

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
        shellNotify(payload.error || "ذخیره خدمت انجام نشد؛ دوباره امتحان کن.");
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
      shellNotify("خدمت جدید در دیتابیس سالن ذخیره شد.");
      event.currentTarget.reset();
    } catch {
      shellNotify("ذخیره خدمت انجام نشد؛ دوباره امتحان کن.");
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
        shellNotify(payload.error || "انتخاب آرتیست انجام نشد؛ دوباره امتحان کن.");
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
      shellNotify(artistName ? `آرتیست «${artistName}» برای «${service.name}» انتخاب شد.` : `آرتیست خدمت «${service.name}» برداشته شد.`);
    } catch {
      shellNotify("انتخاب آرتیست انجام نشد؛ دوباره امتحان کن.");
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
        shellNotify(error?.message || "انتخاب آرتیست ذخیره نشد؛ دوباره امتحان کن.");
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
      || window.confirm(target ? `«${target.name}» حذف شود؟ این کار قابل بازگشت نیست.` : "این خدمت حذف شود؟ این کار قابل بازگشت نیست.");
    if (!confirmed) return false;
    try {
      const result = await deleteSalonServiceApi(id);
      if (!notifyFromResponse(shellNotify, result, { failure: "حذف خدمت انجام نشد؛ دوباره امتحان کن." })) {
        return false;
      }
      if (Array.isArray(result.payload.data?.services)) {
        setSalonServiceList(result.payload.data.services);
      }
      await refreshSalonSystemData();
      shellNotify("خدمت حذف شد.");
      return true;
    } catch {
      shellNotify("حذف خدمت انجام نشد؛ دوباره امتحان کن.");
      return false;
    }
  }, [salonServiceList, refreshSalonSystemData, shellNotify]);

  return {
    updateSalonStaff,
    removeSalonStaff,
    joinSalonTeamAsOwner,
    updateSalonHour,
    updateSalonHoursPreset,
    copySalonHourToOpenDays,
    addSalonService,
    assignSalonServiceArtist,
    toggleSalonServiceArtist,
    deleteSalonService
  };
}
