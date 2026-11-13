"use client";

import { useCallback, useState } from "react";
import { guessBeautyEmojiId } from "../../shared/constants/beautyEmoji";
import { findClientServiceByName, packageParts } from "../../shared/constants/clientServices";
import { SERVICE_CATALOG } from "../../shared/constants/serviceCatalog";

const EMPTY_DRAFT = { id: null, name: "", price: "", duration: "۶۰ دقیقه", hint: "", emoji: "", badge: "" };

/**
 * Artist/salon "add or edit a service" composer: the create-sheet open/mode/
 * draft state, plus the submit (custom + preset) and edit/open/close actions.
 * Whether a service is saved via the salon or the artist upsert call depends
 * on `createdProfile.type`.
 *
 * Depends on pieces owned by useArtistWorkspace (artistServiceList,
 * upsertArtistOwnerService) and useSalonWorkspace (salonServiceList,
 * upsertSalonOwnerService) — this hook must be called after both, with their
 * return values passed in.
 *
 * @param {{
 *   createdProfile?: { type?: string } | null,
 *   artistServiceList?: Array<Record<string, unknown>>,
 *   salonServiceList?: Array<Record<string, unknown>>,
 *   upsertArtistOwnerService: (body: object, opts?: { editingId?: unknown }) => Promise<boolean>,
 *   upsertSalonOwnerService: (body: object, opts?: { editingId?: unknown }) => Promise<boolean>,
 *   onNotice?: (msg: string) => void
 * }} options
 */
export function useServiceComposer({
  createdProfile = null,
  artistServiceList = [],
  salonServiceList = [],
  upsertArtistOwnerService,
  upsertSalonOwnerService,
  onNotice
} = {}) {
  const notify = useCallback((message) => {
    if (typeof onNotice === "function" && message) onNotice(message);
  }, [onNotice]);

  const [artistServiceCreateOpen, setArtistServiceCreateOpen] = useState(false);
  const [artistServiceCreateMode, setArtistServiceCreateMode] = useState("preset");
  const [artistServiceDraft, setArtistServiceDraft] = useState(EMPTY_DRAFT);

  // A package was just added («پکیج مانیکور و پدیکور»): offer to put its parts on the menu too, so a client who wants
  // only one of them can book it (owner, 2026-11-12). { name, parts } or null.
  const [splitOffer, setSplitOffer] = useState(null);
  const offerSplit = useCallback((name, existing) => {
    const have = new Set(existing.map((item) => String(item.name || "").trim()));
    const parts = packageParts(name).filter((part) => !have.has(part));
    if (parts.length) setSplitOffer({ name, parts });
  }, []);
  const dismissSplit = useCallback(() => setSplitOffer(null), []);
  const acceptSplit = useCallback(async () => {
    const offer = splitOffer;
    setSplitOffer(null);
    if (!offer) return;
    const isSalonService = createdProfile?.type === "salon";
    let added = 0;
    for (const part of offer.parts) {
      const preset = SERVICE_CATALOG.find((row) => row.name === part);
      const known = findClientServiceByName(part);
      const body = {
        name: part,
        price: preset?.price || "",
        duration: preset?.duration || "۶۰ دقیقه",
        hint: preset?.hint || "",
        badge: preset?.badge || "",
        emoji: preset?.emoji || known?.icon || guessBeautyEmojiId(part) || "",
        tone: "soft"
      };
      try {
        const ok = isSalonService ? await upsertSalonOwnerService(body) : await upsertArtistOwnerService(body);
        if (ok) added += 1;
      } catch {
        // the next part still goes
      }
    }
    if (added) notify(added === offer.parts.length ? `${offer.parts.join(" و ")} جدا هم اضافه شد.` : "یکیشون اضافه نشد؛ از «خدمات» دوباره بزن.");
    else notify("اضافه نشد؛ دوباره بزن.");
  }, [splitOffer, createdProfile, upsertSalonOwnerService, upsertArtistOwnerService, notify]);

  const closeArtistServiceCreate = useCallback(() => {
    setArtistServiceCreateOpen(false);
    setArtistServiceCreateMode("preset");
    setArtistServiceDraft(EMPTY_DRAFT);
  }, []);

  const addArtistService = useCallback(async (event) => {
    event.preventDefault();
    const isSalonService = createdProfile?.type === "salon";
    const name = String(artistServiceDraft.name || "").trim();
    const price = String(artistServiceDraft.price || "").trim();
    const duration = String(artistServiceDraft.duration || "").trim();
    const hint = String(artistServiceDraft.hint || "").trim();
    const editingId = artistServiceDraft.id;
    if (!name) {
      notify("اسم خدمت چیه؟");
      return;
    }
    const body = {
      name,
      price: price || "توافقی",
      duration: duration || "۶۰ دقیقه",
      hint: hint || "خدمت سفارشی",
      // No icon picked -> store the name-based guess so the service (and every
      // booking made from it) carries a real, stable icon id.
      emoji: String(artistServiceDraft.emoji || guessBeautyEmojiId(name) || ""),
      badge: String(artistServiceDraft.badge || ""),
      tone: "soft",
      // The sample photos picked in the form (only when the owner touched them): linked posts and whether they replace the icon.
      ...(artistServiceDraft.photoDirty ? { photoPostIds: artistServiceDraft.photoIds || [], photoAsCover: artistServiceDraft.photoAsCover !== false } : {})
    };
    try {
      const ok = isSalonService
        ? await upsertSalonOwnerService(body, { editingId })
        : await upsertArtistOwnerService(body, { editingId });
      if (!ok) return;
      if (!editingId) offerSplit(name, isSalonService ? salonServiceList : artistServiceList);
      if (editingId) {
        closeArtistServiceCreate();
        notify("خدمت ذخیره شد.");
      } else {
        // Stay in the sheet: back to the catalog so the next service can be picked right away.
        setArtistServiceCreateMode("preset");
        setArtistServiceDraft(EMPTY_DRAFT);
        notify(`خدمت «${name}» اضافه شد.`);
      }
    } catch {
      notify(editingId ? "خدمت ذخیره نشد؛ دوباره بزن." : "خدمت اضافه نشد؛ دوباره بزن.");
    }
  }, [createdProfile, artistServiceDraft, upsertSalonOwnerService, upsertArtistOwnerService, closeArtistServiceCreate, notify, offerSplit, salonServiceList, artistServiceList]);

  const addArtistServicePreset = useCallback(async (service) => {
    if (!service?.name) return;
    const isSalonService = createdProfile?.type === "salon";
    const existingServices = isSalonService ? salonServiceList : artistServiceList;
    if (existingServices.some((item) => item.name === service.name)) {
      notify("این خدمت از قبل توی منوته.");
      return;
    }
    const body = {
      name: service.name,
      price: service.price,
      duration: service.duration,
      hint: service.hint,
      badge: service.badge,
      emoji: service.emoji || "",
      tone: service.tone || "soft"
    };
    try {
      const ok = isSalonService
        ? await upsertSalonOwnerService(body)
        : await upsertArtistOwnerService(body);
      if (!ok) return;
      offerSplit(service.name, existingServices);
      // Keep the catalog open so several services can be added in one go. No toast: the card turns
      // «اضافه شده» and the done bar counts it, and a sliding toast over the list was one more layer
      // in the Android static-band bug (docs/DEVLOG.md).
    } catch {
      notify("خدمت اضافه نشد؛ دوباره بزن.");
    }
  }, [createdProfile, salonServiceList, artistServiceList, upsertSalonOwnerService, upsertArtistOwnerService, notify, offerSplit]);

  const openArtistServiceCreate = useCallback(() => {
    setArtistServiceCreateMode("preset");
    setArtistServiceDraft(EMPTY_DRAFT);
    setArtistServiceCreateOpen(true);
  }, []);

  const openSalonServiceCreate = useCallback(() => {
    openArtistServiceCreate();
  }, [openArtistServiceCreate]);

  const editArtistService = useCallback((item) => {
    if (!item) return;
    setArtistServiceCreateMode("custom");
    setArtistServiceDraft({
      id: item.id,
      name: item.name || "",
      price: item.price || "",
      duration: item.duration || "۶۰ دقیقه",
      hint: item.hint || "",
      emoji: item.emoji || "",
      badge: item.badge || "",
      photoIds: (item.photos || []).map((photo) => photo.postId),
      photoPreview: item.photos || [],
      photoAsCover: item.photoAsCover !== false,
      photoDirty: false
    });
    setArtistServiceCreateOpen(true);
  }, []);

  // A catalog pick opens the editor pre-filled, so the owner can adjust the
  // name, price, duration, description and icon before it is added.
  const customizeServicePreset = useCallback((service) => {
    if (!service) return;
    setArtistServiceCreateMode("custom");
    setArtistServiceDraft({
      id: null,
      name: service.name || "",
      price: service.price || "",
      duration: service.duration || "۶۰ دقیقه",
      hint: service.hint || "",
      emoji: service.emoji || "",
      badge: service.badge || ""
    });
  }, []);

  return {
    artistServiceCreateOpen,
    setArtistServiceCreateOpen,
    artistServiceCreateMode,
    setArtistServiceCreateMode,
    artistServiceDraft,
    setArtistServiceDraft,
    addArtistService,
    addArtistServicePreset,
    customizeServicePreset,
    openArtistServiceCreate,
    openSalonServiceCreate,
    closeArtistServiceCreate,
    editArtistService,
    splitOffer,
    acceptSplit,
    dismissSplit
  };
}
