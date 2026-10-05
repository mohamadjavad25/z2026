import { createPost, updatePost, deletePost } from "../../shared/api/posts";
import { mapPortfolioItem } from "../posts/mappers";

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
  setArtistPortfolioItems
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
    if (!title || !tag) {
      notify("عنوان و دسته لازم است.");
      return;
    }
    if (!image) {
      notify("تصویر نمونه‌کار لازم است.");
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
        notify(payload.error || "ذخیره نمونه‌کار انجام نشد.");
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
      setEditingArtistWork(null);
      notify("نمونه‌کار ذخیره شد.");
      void syncArtistPosts().catch(() => {});
    } catch {
      notify("ذخیره نمونه‌کار انجام نشد.");
    } finally {
      setArtistWorkSaving(false);
    }
  }

  async function deleteArtistWork() {
    if (!editingArtistWork?.id) return;
    if (typeof window !== "undefined" && !window.confirm("این پست از گالری نمونه‌کار حذف شود؟")) {
      return;
    }
    if (artistWorkSaving) return;
    const id = editingArtistWork.id;
    setArtistWorkSaving(true);
    try {
      const { ok, payload } = await deletePost(id);
      if (!ok) {
        notify(payload.error || "حذف انجام نشد.");
        return;
      }
      setArtistPortfolioItems((items) => items.filter((item) => String(item.id) !== String(id)));
      setEditingArtistWork(null);
      setPreviewingArtistWorkId((prev) => (prev === id ? null : prev));
      notify("نمونه‌کار از گالری حذف شد.");
      void syncArtistPosts().catch(() => {});
    } catch {
      notify("حذف انجام نشد.");
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
