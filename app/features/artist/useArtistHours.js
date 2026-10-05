import { useMemo, useCallback } from "react";
import { SALON_HOUR_TIME_OPTIONS } from "../../shared/lib/time";
import { updateArtistHours } from "../../shared/api/artists";

export function useArtistHours({
  artistHoursList,
  selectedArtistHourDay,
  shellNotify,
  setArtistHoursList
}) {
  const artistHoursPresets = [
    { id: "standard", label: "معمولی", detail: "شنبه تا چهارشنبه • ۱۰ تا ۲۰ • ظرفیت ۸" },
    { id: "extended", label: "پرفشار", detail: "همه روزها باز • ۱۰ تا ۲۲ • ظرفیت ۱۲" },
    { id: "weekend", label: "آخر هفته", detail: "پنجشنبه و جمعه • ۱۲ تا ۱۸ • ظرفیت ۵" }
  ];

  const activeArtistHoursPreset = useMemo(() => {
    if (!artistHoursList.length) return null;
    const weekendDays = new Set(["پنجشنبه", "جمعه"]);
    const matches = (predicate) => artistHoursList.every(predicate);
    if (matches((hour) => {
      const isWeekend = weekendDays.has(hour.day);
      return hour.open_time === "۱۰:۰۰" && hour.close_time === "۲۰:۰۰" && Number(hour.capacity) === 8 && Boolean(hour.active) === !isWeekend;
    })) return "standard";
    if (matches((hour) => hour.open_time === "۱۰:۰۰" && hour.close_time === "۲۲:۰۰" && Number(hour.capacity) === 12 && Boolean(hour.active))) return "extended";
    if (matches((hour) => {
      const isWeekend = weekendDays.has(hour.day);
      return hour.open_time === "۱۲:۰۰" && hour.close_time === "۱۸:۰۰" && Number(hour.capacity) === 5 && Boolean(hour.active) === isWeekend;
    })) return "weekend";
    return null;
  }, [artistHoursList]);
  const activeArtistHoursPresetMeta = artistHoursPresets.find((preset) => preset.id === activeArtistHoursPreset) || null;
  const activeArtistHours = useMemo(() => artistHoursList.filter((item) => item.active), [artistHoursList]);
  const weeklyArtistCapacityTotal = activeArtistHours.reduce((total, item) => total + Number(item.capacity || 0), 0);
  const selectedArtistHour = useMemo(() => {
    if (!artistHoursList.length) return null;
    return artistHoursList.find((hour) => hour.day === selectedArtistHourDay)
      || artistHoursList.find((hour) => hour.active)
      || artistHoursList[0]
      || null;
  }, [artistHoursList, selectedArtistHourDay]);
  const artistHourTimeOptions = useMemo(() => {
    const options = [...SALON_HOUR_TIME_OPTIONS];
    [selectedArtistHour?.open_time, selectedArtistHour?.close_time].forEach((value) => {
      if (value && !options.includes(value)) options.push(value);
    });
    return options;
  }, [selectedArtistHour]);

  const updateArtistHour = useCallback(async (hour, patch) => {
    const nextHour = { ...hour, ...patch };
    try {
      const result = await updateArtistHours(nextHour);
      if (!result.ok) {
        shellNotify(result.payload?.error || "به‌روزرسانی ساعت کاری انجام نشد؛ دوباره امتحان کن.");
        return;
      }
      setArtistHoursList(result.payload.data?.hours || []);
    } catch {
      shellNotify("به‌روزرسانی ساعت کاری انجام نشد؛ دوباره امتحان کن.");
    }
  }, [shellNotify]);

  const updateArtistHoursPreset = useCallback(async (preset) => {
    const weekendDays = new Set(["پنجشنبه", "جمعه"]);
    const nextHours = artistHoursList.map((hour) => {
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
      const results = await Promise.all(nextHours.map((hour) => updateArtistHours(hour)));
      const failed = results.find((item) => !item.ok);
      if (failed) {
        shellNotify(failed.payload?.error || "ذخیره گزینه کلی ساعت کاری انجام نشد؛ دوباره امتحان کن.");
        return;
      }
      const latestHours = results[results.length - 1]?.payload?.data?.hours || nextHours;
      setArtistHoursList(latestHours);
    } catch {
      shellNotify("ذخیره گزینه کلی ساعت کاری انجام نشد؛ دوباره امتحان کن.");
    }
  }, [artistHoursList, shellNotify]);

  /**
   * Copies one day's open/close time + capacity onto every other open day —
   * the "apply to the rest of the week" shortcut, so setting hours doesn't
   * mean repeating the same start/end time pick for each day one at a time.
   * Closed days are left alone.
   */
  const copyArtistHourToOpenDays = useCallback(async (sourceHour) => {
    const targets = artistHoursList.filter((hour) => hour.active);
    try {
      // Sequential on purpose (not Promise.all): several concurrent
      // authenticated PATCHes racing the session-touch poll (GET
      // /api/artist/me, see presence heartbeat) could land out of order and
      // make the client-side hours list flicker/reset mid-update.
      let latestHours = artistHoursList;
      for (const hour of targets) {
        const nextHour = { ...hour, open_time: sourceHour.open_time, close_time: sourceHour.close_time, capacity: sourceHour.capacity };
        const result = await updateArtistHours(nextHour);
        if (!result.ok) {
          shellNotify(result.payload?.error || "اعمال ساعت به بقیه روزها انجام نشد؛ دوباره امتحان کن.");
          return;
        }
        latestHours = result.payload.data?.hours || latestHours;
      }
      setArtistHoursList(latestHours);
      shellNotify("ساعت روی بقیه روزهای باز اعمال شد.");
    } catch {
      shellNotify("اعمال ساعت به بقیه روزها انجام نشد؛ دوباره امتحان کن.");
    }
  }, [artistHoursList, shellNotify]);

  return {
    artistHoursPresets,
    activeArtistHoursPreset,
    activeArtistHoursPresetMeta,
    activeArtistHours,
    weeklyArtistCapacityTotal,
    selectedArtistHour,
    artistHourTimeOptions,
    updateArtistHour,
    updateArtistHoursPreset,
    copyArtistHourToOpenDays
  };
}
