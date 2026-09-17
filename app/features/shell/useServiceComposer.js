"use client";

import { useCallback, useState } from "react";

const EMPTY_DRAFT = { id: null, name: "", price: "", duration: "۶۰ دقیقه", hint: "" };

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
      notify("نام خدمت را وارد کن.");
      return;
    }
    const body = {
      name,
      price: price || "توافقی",
      duration: duration || "۶۰ دقیقه",
      hint: hint || "خدمت سفارشی",
      tone: "soft"
    };
    try {
      const ok = isSalonService
        ? await upsertSalonOwnerService(body, { editingId })
        : await upsertArtistOwnerService(body, { editingId });
      if (!ok) return;
      closeArtistServiceCreate();
      notify(editingId ? "خدمت به‌روزرسانی شد." : `خدمت «${name}» اضافه شد.`);
    } catch {
      notify(editingId ? "ویرایش خدمت انجام نشد." : "افزودن خدمت انجام نشد.");
    }
  }, [createdProfile, artistServiceDraft, upsertSalonOwnerService, upsertArtistOwnerService, closeArtistServiceCreate, notify]);

  const addArtistServicePreset = useCallback(async (service) => {
    if (!service?.name) return;
    const isSalonService = createdProfile?.type === "salon";
    const existingServices = isSalonService ? salonServiceList : artistServiceList;
    if (existingServices.some((item) => item.name === service.name)) {
      notify("این خدمت قبلا در منو هست.");
      return;
    }
    const body = {
      name: service.name,
      price: service.price,
      duration: service.duration,
      hint: service.hint,
      badge: service.badge,
      tone: service.tone || "soft"
    };
    try {
      const ok = isSalonService
        ? await upsertSalonOwnerService(body)
        : await upsertArtistOwnerService(body);
      if (!ok) return;
      closeArtistServiceCreate();
      notify(`خدمت «${service.name}» اضافه شد.`);
    } catch {
      notify("افزودن خدمت انجام نشد.");
    }
  }, [createdProfile, salonServiceList, artistServiceList, upsertSalonOwnerService, upsertArtistOwnerService, closeArtistServiceCreate, notify]);

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
      hint: item.hint || ""
    });
    setArtistServiceCreateOpen(true);
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
    openArtistServiceCreate,
    openSalonServiceCreate,
    closeArtistServiceCreate,
    editArtistService
  };
}
