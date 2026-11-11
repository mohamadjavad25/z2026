import { useState } from "react";
import { createArtistMe, deleteArtistMe } from "../../shared/api/artists";
import { timeLabelToMinutes } from "../../shared/lib/time";

/** The artist's own collaboration offers to salons (the old free-text proposal): the draft, sending and deleting. Part of useArtistWorkspace. */
export function useArtistCollabOffers({ createdProfile, salonDirectory, artistServiceList, notify }) {
  const [artistCollabOffers, setArtistCollabOffers] = useState([]);
  const [artistCollabDraft, setArtistCollabDraft] = useState({
    salonId: "",
    days: "شنبه، دوشنبه، چهارشنبه",
    from: "۱۰:۰۰",
    to: "۱۸:۰۰",
    share: "۴۰",
    capacity: "۴"
  });

  async function addArtistCollabOffer(event) {
    event.preventDefault();
    const salon = salonDirectory.find((item) => (
      String(item.id) === String(artistCollabDraft.salonId)
      || String(item.source_key) === String(artistCollabDraft.salonId)
      || item.name === artistCollabDraft.salonId
    )) || salonDirectory[0];
    if (!salon) {
      notify("هنوز سالنی پیدا نشد.");
      return;
    }
    const service = String(createdProfile?.data?.service || artistServiceList[0]?.name || "").trim();
    const days = String(artistCollabDraft.days || "").trim();
    const from = String(artistCollabDraft.from || "").trim();
    const to = String(artistCollabDraft.to || "").trim();
    const share = String(artistCollabDraft.share || "").trim();
    const capacity = String(artistCollabDraft.capacity || "").trim();
    if (!service || !days || !from || !to || !share) {
      notify(service ? "روز، ساعت و سهمت رو کامل کن." : "اول کارهات یا یه خدمت رو بذار.");
      return;
    }
    if (timeLabelToMinutes(to) <= timeLabelToMinutes(from)) {
      notify("ساعت آخر باید بعد از اول باشه.");
      return;
    }
    try {
      const { ok, payload } = await createArtistMe({
        kind: "collab",
        salonId: salon.id,
        salonName: salon.name || "سالن منتخب",
        area: salon.area || salon.city || "",
        service,
        days,
        from,
        to,
        share,
        capacity: capacity || "۱",
        status: "آماده ارسال"
      });
      if (!ok) {
        notify(payload.error || "پیشنهاد همکاری نرفت؛ دوباره بزن.");
        return;
      }
      setArtistCollabOffers((items) => ([payload.data?.collab, ...items].filter(Boolean)));
      notify(`پیشنهاد همکاریت رفت برای «${salon.name || "سالن"}».`);
    } catch {
      notify("پیشنهاد همکاری نرفت؛ دوباره بزن.");
    }
  }

  async function deleteArtistCollabOffer(id) {
    if (typeof window !== "undefined" && !window.confirm("این پیشنهاد همکاری پاک بشه؟")) {
      return;
    }
    try {
      const { ok, payload } = await deleteArtistMe({ kind: "collab", id });
      if (!ok) {
        notify(payload.error || "پاک نشد؛ دوباره بزن.");
        return;
      }
      setArtistCollabOffers((items) => items.filter((item) => item.id !== id));
      notify("پیشنهاد همکاری پاک شد.");
    } catch {
      notify("پاک نشد؛ دوباره بزن.");
    }
  }

  return {
    artistCollabOffers,
    setArtistCollabOffers,
    artistCollabDraft,
    setArtistCollabDraft,
    addArtistCollabOffer,
    deleteArtistCollabOffer
  };
}
