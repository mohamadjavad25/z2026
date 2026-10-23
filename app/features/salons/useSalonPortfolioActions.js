import { useCallback } from "react";
import { updateSalonPortfolio, createSalonPortfolio, deleteSalonPortfolio as deleteSalonPortfolioApi, updateSalonService as updateSalonServiceApi, createSalonService as createSalonServiceApi } from "../../shared/api/salons";

export function useSalonPortfolioActions({
  salonServiceList,
  portfolioSaving,
  salonWorkDraft,
  salonPortfolioList,
  shellNotify,
  refreshSalonSystemData,
  onPostsChanged,
  syncSalonDirectory,
  setSalonWorkTagMenuOpen,
  setSalonWorkDraft,
  setPortfolioSaving,
  setSalonPortfolioList
}) {
  const resetPortfolioComposer = useCallback(() => {
    setSalonWorkTagMenuOpen(false);
    setSalonWorkDraft(null);
    setPortfolioSaving(false);
  }, []);

  const openPortfolioComposer = useCallback((item = null) => {
    setSalonWorkTagMenuOpen(false);
    if (item) {
      setSalonWorkDraft({
        id: item.id,
        title: item.title || "",
        tag: item.tag || "",
        caption: item.caption || "",
        image: item.image || "",
        isPublic: item.isPublic !== false,
        featured: Boolean(item.featured)
      });
      return;
    }
    setSalonWorkDraft({
      id: "new",
      title: "",
      tag: salonServiceList[0]?.name || "",
      caption: "",
      image: "",
      isPublic: true,
      featured: false
    });
  }, [salonServiceList]);

  const clearSalonWorkImage = useCallback(() => {
    setSalonWorkDraft((prev) => (prev ? { ...prev, image: "" } : prev));
  }, []);

  const addSalonPortfolio = useCallback(async (event) => {
    event.preventDefault();
    if (portfolioSaving || !salonWorkDraft) return;
    const title = String(salonWorkDraft.title || "").trim();
    const tag = String(salonWorkDraft.tag || "").trim();
    const image = String(salonWorkDraft.image || "").trim();
    const caption = String(salonWorkDraft.caption || "").trim();
    const isPublic = salonWorkDraft.isPublic !== false;
    const featured = Boolean(salonWorkDraft.featured);
    if (!image) {
      shellNotify("اول یه عکس انتخاب کن.");
      return;
    }
    if (!title) {
      shellNotify("یه عنوان بنویس.");
      return;
    }
    // A category is asked for only when the menu has services to pick from.
    const hasServices = salonServiceList.some((item) => String(item?.name || "").trim());
    if (!tag && hasServices) {
      shellNotify("بگو این کار مال کدوم خدمته.");
      return;
    }

    const isNew = String(salonWorkDraft.id).startsWith("new-") || salonWorkDraft.id === "new";
    setPortfolioSaving(true);
    try {
      if (!isNew) {
        const { ok, payload } = await updateSalonPortfolio({
          id: salonWorkDraft.id,
          title,
          tag,
          ...(image.startsWith("data:") ? { image } : {}),
          caption,
          isPublic,
          featured
        });
        if (!ok) {
          shellNotify(payload.error || "ذخیره نشد؛ دوباره بزن.");
          return;
        }
        const savedItem = payload.data?.item;
        if (savedItem) {
          setSalonPortfolioList((items) => items.map((item) => (String(item.id) === String(savedItem.id) ? { ...item, ...savedItem } : item)));
        }
        shellNotify(isPublic ? "ذخیره شد." : "ذخیره شد؛ فقط خودت می‌بینیش.");
        void Promise.all([
          refreshSalonSystemData(),
          typeof onPostsChanged === "function" ? onPostsChanged() : null
        ]).catch(() => {});
      } else {
        const { ok, payload } = await createSalonPortfolio({
          title,
          tag,
          image,
          caption,
          isPublic,
          featured
        });
        if (!ok) {
          shellNotify(payload.error || "نمونه‌کار ذخیره نشد؛ دوباره بزن.");
          return;
        }
        // Show the new post immediately from the API response; the heavy
        // refreshes (workspace, public directory) run in the background.
        const createdItem = payload.data?.item;
        if (createdItem) setSalonPortfolioList((items) => [createdItem, ...items]);
        shellNotify(isPublic ? "نمونه‌کارت رفت توی ویترین!" : "ذخیره شد؛ فقط خودت می‌بینیش.");
        void Promise.all([
          refreshSalonSystemData(),
          typeof onPostsChanged === "function" ? onPostsChanged() : null
        ]).catch(() => {});
      }
      resetPortfolioComposer();
    } catch {
      shellNotify(isNew ? "نمونه‌کار ذخیره نشد؛ دوباره بزن." : "ذخیره نشد؛ دوباره بزن.");
    } finally {
      setPortfolioSaving(false);
    }
  }, [portfolioSaving, salonWorkDraft, salonServiceList, salonPortfolioList.length, shellNotify, refreshSalonSystemData, onPostsChanged, syncSalonDirectory, resetPortfolioComposer]);

  const deleteSalonPortfolio = useCallback(async (id) => {
    if (!id) return;
    if (typeof window !== "undefined" && !window.confirm("این نمونه‌کار پاک بشه؟")) return;
    try {
      const { ok, payload } = await deleteSalonPortfolioApi(id);
      if (!ok) {
        shellNotify(payload.error || "پاک نشد؛ دوباره بزن.");
        return;
      }
      setSalonPortfolioList((items) => items.filter((item) => String(item.id) !== String(id)));
      if (salonWorkDraft?.id === id) resetPortfolioComposer();
      shellNotify("نمونه‌کار پاک شد.");
      void Promise.all([
        refreshSalonSystemData(),
        typeof onPostsChanged === "function" ? onPostsChanged() : null
      ]).catch(() => {});
    } catch {
      shellNotify("پاک نشد؛ دوباره بزن.");
    }
  }, [shellNotify, refreshSalonSystemData, onPostsChanged, salonWorkDraft, resetPortfolioComposer]);

  const deleteSalonPortfolioFromComposer = useCallback(async () => {
    if (!salonWorkDraft?.id) return;
    const isNew = String(salonWorkDraft.id).startsWith("new-") || salonWorkDraft.id === "new";
    if (isNew) {
      resetPortfolioComposer();
      return;
    }
    await deleteSalonPortfolio(salonWorkDraft.id);
  }, [salonWorkDraft, resetPortfolioComposer, deleteSalonPortfolio]);

  /** Shared service composer's salon branch (artistServiceCreateOpen/Mode/Draft stay in HomeApp). */
  const upsertSalonOwnerService = useCallback(async (body, { editingId } = {}) => {
    try {
      const { ok, payload } = editingId
        ? await updateSalonServiceApi({ id: editingId, ...body })
        : await createSalonServiceApi(body);
      if (!ok) {
        shellNotify(payload.error || (editingId ? "خدمت ذخیره نشد؛ دوباره بزن." : "خدمت اضافه نشد؛ دوباره بزن."));
        return false;
      }
      await refreshSalonSystemData();
      return true;
    } catch {
      shellNotify(editingId ? "خدمت ذخیره نشد؛ دوباره بزن." : "خدمت اضافه نشد؛ دوباره بزن.");
      return false;
    }
  }, [shellNotify, refreshSalonSystemData]);

  return {
    resetPortfolioComposer,
    openPortfolioComposer,
    clearSalonWorkImage,
    addSalonPortfolio,
    deleteSalonPortfolio,
    deleteSalonPortfolioFromComposer,
    upsertSalonOwnerService
  };
}
