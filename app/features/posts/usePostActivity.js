"use client";

import { useCallback, useRef, useState } from "react";
import { getSavedPosts, setPostSaved, viewPost } from "../../shared/api/posts";
import { mapSharedPost } from "./mappers";

function postUrl(post) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/p/${post.id}`;
}

/**
 * What a viewer does with other people's posts: their saved posts, the post currently
 * open, save with optimistic update + rollback, view counting and sharing.
 *
 * @param {{ onNotice?: (msg: string) => void }} options
 */
export function usePostActivity({ onNotice } = {}) {
  const notify = useCallback((message) => {
    if (typeof onNotice === "function" && message) onNotice(message);
  }, [onNotice]);

  const [savedPostObjects, setSavedPostObjects] = useState([]);
  const [savedPostTitles, setSavedPostTitles] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);

  const feedRequestRef = useRef(0);
  const savingRef = useRef(new Set());
  const viewedRef = useRef(new Set());

  const savedPosts = savedPostObjects;

  const selectedPostIsSaved = selectedPost ? savedPostTitles.includes(String(selectedPost.id)) : false;

  /** Merge fresh counts for one post into every list that shows it. */
  const patchPost = useCallback((id, patch) => {
    const apply = (list) => list.map((post) => (String(post.id) === String(id) ? { ...post, ...patch } : post));
    setSavedPostObjects(apply);
    setSelectedPost((post) => (post && String(post.id) === String(id) ? { ...post, ...patch } : post));
  }, []);

  const refreshSavedPosts = useCallback(async () => {
    // Out-of-order guard: only the latest refresh may write state.
    const requestId = ++feedRequestRef.current;
    try {
      const { ok, data } = await getSavedPosts();
      if (!ok || requestId !== feedRequestRef.current) return; // guests get 401 and have none
      const saved = (data?.posts || []).map(mapSharedPost).filter(Boolean);
      setSavedPostObjects(saved);
      setSavedPostTitles(saved.map((post) => String(post.id)));
    } catch {
      // keep what we have
    }
  }, []);

  const resetPostActivity = useCallback(() => {
    feedRequestRef.current += 1;
    setSavedPostObjects([]);
    setSavedPostTitles([]);
    setSelectedPost(null);
    viewedRef.current = new Set();
  }, []);

  /**
   * Save / unsave. The UI flips instantly; the request sets the state explicitly (so a retry
   * or double tap can't flip it back), and any failure rolls the UI back and says so.
   */
  const toggleSavedPost = useCallback(async (_titleOrId, post) => {
    if (post?.id == null) return;
    const key = String(post.id);
    if (savingRef.current.has(key)) return;
    savingRef.current.add(key);
    const wasSaved = savedPostTitles.includes(key);
    const nextSaved = !wasSaved;
    const previousObjects = savedPostObjects;
    const previousTitles = savedPostTitles;

    setSavedPostTitles(nextSaved ? [key, ...previousTitles] : previousTitles.filter((item) => item !== key));
    setSavedPostObjects(nextSaved
      ? [{ ...post }, ...previousObjects.filter((item) => String(item.id) !== key)]
      : previousObjects.filter((item) => String(item.id) !== key));
    try {
      const { ok, payload } = await setPostSaved(post.id, nextSaved);
      if (!ok) throw new Error(payload?.error || "save failed");
      const count = payload?.data?.savesCount;
      if (count != null) patchPost(post.id, { saves: String(count) });
    } catch {
      setSavedPostTitles(previousTitles);
      setSavedPostObjects(previousObjects);
      notify(nextSaved ? "ذخیره نشد؛ دوباره امتحان کن." : "حذف از ذخیره‌شده‌ها انجام نشد؛ دوباره امتحان کن.");
    } finally {
      savingRef.current.delete(key);
    }
  }, [notify, patchPost, savedPostObjects, savedPostTitles]);

  /** Count a view once per post per session; the server also dedupes per viewer per day. */
  const recordPostView = useCallback(async (post) => {
    if (post?.id == null) return;
    const key = String(post.id);
    if (viewedRef.current.has(key)) return;
    viewedRef.current.add(key);
    try {
      const { ok, payload } = await viewPost(post.id);
      const counted = payload?.data?.post;
      if (ok && counted) patchPost(post.id, { views: String(counted.views ?? ""), saves: String(counted.saves ?? "") });
    } catch {
      viewedRef.current.delete(key);
    }
  }, [patchPost]);

  const openPost = useCallback((post) => {
    setSelectedPost(post || null);
    if (post) void recordPostView(post);
  }, [recordPostView]);

  const sharePost = useCallback(async (post) => {
    if (!post) return;
    const url = postUrl(post);
    const title = post.title || "نمونه‌کار";
    const text = `${title}${post.salon ? ` · ${post.salon}` : ""} — زیبابان`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        notify("لینک این نمونه‌کار کپی شد.");
        return;
      }
    } catch (error) {
      if (error?.name === "AbortError") return; // the user closed the share sheet
    }
    notify("اشتراک‌گذاری انجام نشد؛ لینک را دستی کپی کن.");
  }, [notify]);

  return {
    savedPostTitles,
    setSavedPostTitles,
    selectedPost,
    setSelectedPost,
    openPost,
    savedPosts,
    selectedPostIsSaved,
    refreshSavedPosts,
    resetPostActivity,
    toggleSavedPost,
    recordPostView,
    sharePost
  };
}
