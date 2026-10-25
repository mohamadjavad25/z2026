import { useMemo, useCallback } from "react";
import { saveArtistHoursWeek as saveArtistHoursWeekRequest } from "../../shared/api/artists";

export function useArtistHours({
  artistHoursList,
  shellNotify,
  setArtistHoursList
}) {
  const activeArtistHours = useMemo(() => artistHoursList.filter((item) => item.active), [artistHoursList]);

  /** The hours sheet's «ذخیره»: the whole week in one request. true when it was saved. */
  const saveArtistHoursWeek = useCallback(async (hours) => {
    try {
      const result = await saveArtistHoursWeekRequest(hours);
      if (!result.ok) {
        shellNotify(result.payload?.error || "ساعت کاری ذخیره نشد؛ دوباره بزن.");
        return false;
      }
      setArtistHoursList(result.payload.data?.hours || []);
      shellNotify("ساعت کاری ذخیره شد.");
      return true;
    } catch {
      shellNotify("ساعت کاری ذخیره نشد؛ دوباره بزن.");
      return false;
    }
  }, [shellNotify, setArtistHoursList]);

  return {
    activeArtistHours,
    saveArtistHoursWeek
  };
}
