import { useState } from "react";
import { createArtistMe } from "../../shared/api/artists";
import { timeLabelToMinutes } from "../../shared/lib/time";
import { persianWeekdayIndex } from "../../shared/lib/persianCalendar";
import { ALL_BREAK_DAYS } from "../../shared/lib/artistBreak";

/** The artist's break: the saved daily window, its editor, and «الان استراحت می‌کنم». Part of useArtistWorkspace. */
export function useArtistBreak({ artistHoursList, notify }) {
  const [artistBreakSaving, setArtistBreakSaving] = useState(false);
  const [artistBreakTime, setArtistBreakTime] = useState(null);
  const [artistBreakEditorOpen, setArtistBreakEditorOpen] = useState(false);
  const [artistBreakDraft, setArtistBreakDraft] = useState({ start: "", end: "", days: ALL_BREAK_DAYS });

  function openArtistBreakEditor() {
    // A window already saved opens as it is; a new one starts empty (two taps pick it) on the artist's open days.
    const openDays = artistHoursList.filter((item) => item?.active).map((item) => persianWeekdayIndex(item.day)).sort((a, b) => a - b);
    const hasWindow = Boolean(artistBreakTime?.start && artistBreakTime?.end);
    setArtistBreakDraft({
      start: hasWindow ? artistBreakTime.start : "",
      end: hasWindow ? artistBreakTime.end : "",
      days: hasWindow && Array.isArray(artistBreakTime.days) ? artistBreakTime.days : (openDays.length ? openDays : ALL_BREAK_DAYS)
    });
    setArtistBreakEditorOpen(true);
  }

  function closeArtistBreakEditor() {
    setArtistBreakEditorOpen(false);
  }

  async function saveArtistBreakTime() {
    if (artistBreakSaving) return;
    if (timeLabelToMinutes(artistBreakDraft.end) <= timeLabelToMinutes(artistBreakDraft.start)) {
      notify("آخر استراحت باید بعد از اولش باشه.");
      return;
    }
    setArtistBreakSaving(true);
    try {
      const { ok, payload } = await createArtistMe({
        kind: "break",
        startTime: artistBreakDraft.start,
        endTime: artistBreakDraft.end,
        days: artistBreakDraft.days
      });
      if (!ok) {
        notify(payload.error || "استراحت ذخیره نشد؛ دوباره بزن.");
        return;
      }
      setArtistBreakTime(payload.data?.breakTime || {
        start: artistBreakDraft.start,
        end: artistBreakDraft.end,
        days: artistBreakDraft.days,
        now: artistBreakTime?.now || null
      });
      setArtistBreakEditorOpen(false);
      notify(`تایم استراحت ${artistBreakDraft.start} تا ${artistBreakDraft.end} ذخیره شد.`);
    } catch {
      notify("استراحت ذخیره نشد؛ دوباره بزن.");
    } finally {
      setArtistBreakSaving(false);
    }
  }

  async function clearArtistBreakTime() {
    if (artistBreakSaving) return;
    setArtistBreakSaving(true);
    try {
      const { ok, payload } = await createArtistMe({ kind: "break", clear: true });
      if (!ok) {
        notify("استراحت پاک نشد؛ دوباره بزن.");
        return;
      }
      // A «now» break running today stays.
      setArtistBreakTime(payload?.data?.breakTime || null);
      setArtistBreakEditorOpen(false);
      notify("استراحت پاک شد.");
    } catch {
      notify("استراحت پاک نشد؛ دوباره بزن.");
    } finally {
      setArtistBreakSaving(false);
    }
  }

  // «الان استراحت می‌کنم»: 15, 30 or 60 minutes from now, today only; 0 ends it.
  async function startArtistBreakNow(minutes) {
    if (artistBreakSaving) return;
    setArtistBreakSaving(true);
    try {
      const { ok, payload } = await createArtistMe({ kind: "break-now", minutes });
      if (!ok) {
        notify(payload?.error || "استراحت ثبت نشد؛ دوباره بزن.");
        return;
      }
      const next = payload?.data?.breakTime || null;
      setArtistBreakTime(next);
      setArtistBreakEditorOpen(false);
      notify(minutes ? `استراحتی تا ${next?.now?.end || ""}؛ تا اون موقع کسی ازت نوبت نمی‌گیره.` : "استراحت تموم شد.");
    } catch {
      notify("استراحت ثبت نشد؛ دوباره بزن.");
    } finally {
      setArtistBreakSaving(false);
    }
  }

  return {
    artistBreakTime,
    setArtistBreakTime,
    artistBreakEditorOpen,
    setArtistBreakEditorOpen,
    artistBreakDraft,
    setArtistBreakDraft,
    artistBreakSaving,
    openArtistBreakEditor,
    closeArtistBreakEditor,
    saveArtistBreakTime,
    clearArtistBreakTime,
    startArtistBreakNow
  };
}
