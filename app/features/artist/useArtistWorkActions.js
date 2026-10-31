import { createPost, updatePost, deletePost } from "../../shared/api/posts";
import { mapPortfolioItem } from "../posts/mappers";
import { sendArtistTeamPost } from "../../shared/api/artists";

/**
 * Sends the post to (or takes it back from) each salon whose switch the artist changed in the sheet. → the first
 * refusal's text, or "" when all went through, and whether anything was sent.
 */
async function applySalonSends(postId, salonSends = {}) {
  let refusal = "";
  let sent = false;
  for (const [salonId, on] of Object.entries(salonSends)) {
    const result = await sendArtistTeamPost(postId, Number(salonId), on ? "send" : "withdraw").catch(() => null);
    if (!result?.ok) refusal = refusal || result?.payload?.error || "به سالن نرسید؛ دوباره بفرست.";
    else if (on) sent = true;
  }
  return { refusal, sent };
}

export function useArtistWorkActions({
  setPreviewingArtistWorkId,
  setArtistWorkTagMenuOpen,
  setEditingArtistWork,
  onPostsChanged,
  createdProfile,
  refreshArtistWorkspace,
  editingArtistWork,
  artistWorkSaving,
  setArtistWorkSaving,
  notify,
  setArtistPortfolioItems,
  artistServiceList = []
}) {
  function openArtistWorkPreview(item) {
    if (!item?.id) return;
    setPreviewingArtistWorkId(item.id);
  }

  function closeArtistWorkPreview() {
    setPreviewingArtistWorkId(null);
  }

  function openArtistWorkModal(item) {
    if (!item) return;
    setPreviewingArtistWorkId(null);
    setArtistWorkTagMenuOpen(false);
    setEditingArtistWork({
      id: item.id,
      title: item.title || "",
      tag: item.tag || "",
      caption: item.caption || "",
      image: item.image || "",
      saves: item.saves || "۰",
      views: item.views || "۰",
      isPublic: item.isPublic !== false,
      featured: Boolean(item.featured)
    });
  }

  function closeArtistWorkModal() {
    setArtistWorkTagMenuOpen(false);
    setEditingArtistWork(null);
  }

  function clearArtistWorkImage() {
    setEditingArtistWork((prev) => (prev ? { ...prev, image: "" } : prev));
  }

  async function syncArtistPosts() {
    if (typeof onPostsChanged === "function") {
      await onPostsChanged();
    }
    if (createdProfile?.type === "artist") {
      await refreshArtistWorkspace();
    }
  }

  async function saveArtistWork(event) {
    event.preventDefault();
    if (!editingArtistWork) return;
    const title = String(editingArtistWork.title || "").trim();
    const tag = String(editingArtistWork.tag || "").trim();
    const image = String(editingArtistWork.image || "").trim();
    // A category is asked for only when the menu has services to pick from.
    const hasServices = artistServiceList.some((item) => String(item?.name || "").trim());
    if (!title || (!tag && hasServices)) {
      notify(title ? "بگو مال کدوم خدمته." : "یه عنوان بنویس.");
      return;
    }
    if (!image) {
      notify("یه عکس از کارت بذار.");
      return;
    }
    const body = {
      title,
      tag,
      caption: String(editingArtistWork.caption || "").trim(),
      // Only a freshly picked/cropped picture is sent. An unchanged one is just its media
      // URL, and echoing that back used to overwrite the stored image.
      ...(image.startsWith("data:") ? { image } : {}),
      isPublic: editingArtistWork.isPublic !== false,
      featured: Boolean(editingArtistWork.featured)
    };
    if (artistWorkSaving) return;
    setArtistWorkSaving(true);
    try {
      const isNew = String(editingArtistWork.id).startsWith("new-") || editingArtistWork.id === "new";
      const { ok, payload } = isNew
        ? await createPost(body)
        : await updatePost(editingArtistWork.id, body);
      if (!ok) {
        notify(payload.error || "نمونه‌کار ذخیره نشد؛ دوباره بزن.");
        return;
      }
      // The API already returned the saved post: put it in the gallery and close
      // the sheet right away, then refresh the workspace in the background
      // instead of making the user wait for those two extra round trips.
      const saved = mapPortfolioItem(payload.data?.post);
      if (saved) {
        setArtistPortfolioItems((items) => (
          items.some((item) => String(item.id) === String(saved.id))
            ? items.map((item) => (String(item.id) === String(saved.id) ? saved : item))
            : [saved, ...items]
        ));
      }
      const sends = saved?.id ? await applySalonSends(saved.id, editingArtistWork.salonSends) : { refusal: "", sent: false };
      setEditingArtistWork(null);
      notify(sends.refusal || (sends.sent ? "ذخیره شد و رفت پیش سالن تا قبولش کنه." : "نمونه‌کارت ذخیره شد!"));
      void syncArtistPosts().catch(() => {});
    } catch {
      notify("نمونه‌کار ذخیره نشد؛ دوباره بزن.");
    } finally {
      setArtistWorkSaving(false);
    }
  }

  async function deleteArtistWork() {
    if (!editingArtistWork?.id) return;
    if (typeof window !== "undefined" && !window.confirm("این نمونه‌کار پاک بشه؟")) {
      return;
    }
    if (artistWorkSaving) return;
    const id = editingArtistWork.id;
    setArtistWorkSaving(true);
    try {
      const { ok, payload } = await deletePost(id);
      if (!ok) {
        notify(payload.error || "پاک نشد؛ دوباره بزن.");
        return;
      }
      setArtistPortfolioItems((items) => items.filter((item) => String(item.id) !== String(id)));
      setEditingArtistWork(null);
      setPreviewingArtistWorkId((prev) => (prev === id ? null : prev));
      notify("نمونه‌کار پاک شد.");
      void syncArtistPosts().catch(() => {});
    } catch {
      notify("پاک نشد؛ دوباره بزن.");
    } finally {
      setArtistWorkSaving(false);
    }
  }

  return {
    openArtistWorkPreview,
    closeArtistWorkPreview,
    openArtistWorkModal,
    closeArtistWorkModal,
    clearArtistWorkImage,
    syncArtistPosts,
    saveArtistWork,
    deleteArtistWork
  };
}
