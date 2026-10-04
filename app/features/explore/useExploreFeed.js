"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { getExplorePosts, getSavedPosts, setPostSaved, viewPost } from "../../shared/api/posts";
import { mapExplorePost } from "./mappers";

const FEED_PAGE_SIZE = 40;

function postUrl(post) {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/p/${post.id}`;
}

/**
 * Posts seen by a viewer: a bounded explore feed (used to resolve post -> owner and
 * for the public gallery fallback), the viewer's saved posts (their own endpoint, so
 * a saved post never vanishes because it left the feed), the open post, save with
 * optimistic update + rollback, view counting and sharing.
 *
 * @param {{ onNotice?: (msg: string) => void }} options
 */
export function useExploreFeed({ onNotice } = {}) {
  const notify = useCallback((message) => {
    if (typeof onNotice === "function" && message) onNotice(message);
  }, [onNotice]);

  const [explorePostList, setExplorePostList] = useState([]);
  const [exploreLoading, setExploreLoading] = useState(true);
  const [savedPostObjects, setSavedPostObjects] = useState([]);
  const [savedPostTitles, setSavedPostTitles] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);

  const feedRequestRef = useRef(0);
  const savingRef = useRef(new Set());
  const viewedRef = useRef(new Set());

  const savedExplorePosts = savedPostObjects;

  const selectedPostIsSaved = selectedPost ? savedPostTitles.includes(String(selectedPost.id)) : false;

  /** Merge fresh counts for one post into every list that shows it. */
  const patchPost = useCallback((id, patch) => {
    const apply = (list) => list.map((post) => (String(post.id) === String(id) ? { ...post, ...patch } : post));
    setExplorePostList(apply);
    setSavedPostObjects(apply);
    setSelectedPost((post) => (post && String(post.id) === String(id) ? { ...post, ...patch } : post));
  }, []);

  const refreshExploreFeed = useCallback(async () => {
    // Out-of-order guard: only the latest refresh may write state.
    const requestId = ++feedRequestRef.current;
    try {
      const [feedRes, savedRes] = await Promise.all([
        getExplorePosts({ limit: FEED_PAGE_SIZE }),
        getSavedPosts().catch(() => ({ ok: false }))
      ]);
      if (requestId !== feedRequestRef.current) return;
      if (feedRes.ok) {
        const posts = (feedRes.data?.posts || feedRes.payload?.posts || []).map(mapExplorePost).filter(Boolean);
        setExplorePostList(posts);
      }
      if (savedRes.ok) {
        const saved = (savedRes.data?.posts || []).map(mapExplorePost).filter(Boolean);
        setSavedPostObjects(saved);
        setSavedPostTitles(saved.map((post) => String(post.id)));
      }
    } catch {
      // keep current feed
    } finally {
      if (requestId === feedRequestRef.current) setExploreLoading(false);
    }
  }, []);

  const resetExploreFeed = useCallback(() => {
    feedRequestRef.current += 1;
    setExplorePostList([]);
    setExploreLoading(true);
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

  const selectExplorePost = useCallback((post) => {
    setSelectedPost(post || null);
    if (post) void recordPostView(post);
  }, [recordPostView]);

  const shareExplorePost = useCallback(async (post) => {
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

  const exploreByTag = useMemo(() => explorePostList, [explorePostList]);

  return {
    explorePostList,
    setExplorePostList,
    exploreLoading,
    savedPostTitles,
    setSavedPostTitles,
    selectedPost,
    setSelectedPost,
    selectExplorePost,
    visibleExplorePosts: exploreByTag,
    savedExplorePosts,
    selectedPostIsSaved,
    refreshExploreFeed,
    resetExploreFeed,
    toggleSavedPost,
    recordPostView,
    shareExplorePost
  };
}
