"use client";

import { useCallback, useMemo, useState } from "react";
import { getExplorePosts, savePost } from "../../shared/api/posts";
import { mapExplorePost } from "./mappers";

/**
 * Explore feed: server posts, category filter, save UI, preview selection.
 * AI Studio posts are merged via `publishedAiPosts` input (read-only) — no import of AI hook.
 *
 * `savedPostTitles` lives here (source of truth from GET /api/explore/posts).
 * Cross-domain consumers (AI local-save, artist public gallery) read/call into this hook.
 *
 * @param {{
 *   createdProfile?: { type?: string, id?: number|string } | null,
 *   publishedAiPosts?: Array<Record<string, unknown>>,
 *   onNotice?: (msg: string) => void
 * }} options
 */
export function useExploreFeed({
  createdProfile: _createdProfile = null,
  publishedAiPosts = [],
  onNotice
} = {}) {
  const notify = useCallback((message) => {
    if (typeof onNotice === "function" && message) onNotice(message);
  }, [onNotice]);

  const [explorePostList, setExplorePostList] = useState([]);
  const [exploreLoading, setExploreLoading] = useState(true);
  const [exploreCategory, setExploreCategory] = useState("همه");
  const [savedPostTitles, setSavedPostTitles] = useState([]);
  const [selectedPost, setSelectedPost] = useState(null);

  const visibleExplorePosts = useMemo(() => {
    const all = [...publishedAiPosts, ...explorePostList];
    if (exploreCategory === "همه") return all;
    return all.filter((post) => post.tag === exploreCategory);
  }, [exploreCategory, publishedAiPosts, explorePostList]);

  const savedExplorePosts = useMemo(() => {
    const all = [...publishedAiPosts, ...explorePostList];
    return all.filter((post) => (
      post.id != null
        ? savedPostTitles.includes(String(post.id))
        : savedPostTitles.includes(post.title)
    ));
  }, [savedPostTitles, publishedAiPosts, explorePostList]);

  const selectedPostIsSaved = selectedPost
    ? selectedPost.id != null
      ? savedPostTitles.includes(String(selectedPost.id))
      : savedPostTitles.includes(selectedPost.title)
    : false;

  const refreshExploreFeed = useCallback(async () => {
    try {
      const { ok, data, payload } = await getExplorePosts();
      if (!ok) return;
      const posts = (data?.posts || payload?.posts || []).map(mapExplorePost).filter(Boolean);
      setExplorePostList(posts);
      if (Array.isArray(data?.savedTitles)) {
        setSavedPostTitles(data.savedTitles.map(String));
      }
    } catch {
      // keep current feed
    } finally {
      setExploreLoading(false);
    }
  }, []);

  const resetExploreFeed = useCallback(() => {
    setExplorePostList([]);
    setExploreLoading(true);
    setSavedPostTitles([]);
    setSelectedPost(null);
    setExploreCategory("همه");
  }, []);

  /** Local-only save key (AI Studio draft before server post id exists). */
  const rememberLocalSavedTitle = useCallback((title) => {
    const key = String(title || "").trim();
    if (!key) return;
    setSavedPostTitles((prev) => (prev.includes(key) ? prev : [key, ...prev]));
  }, []);

  const toggleSavedPost = useCallback(async (titleOrId, post) => {
    const key = post?.id != null ? String(post.id) : String(titleOrId);
    setSavedPostTitles((titles) => {
      if (titles.includes(key)) {
        return titles.filter((item) => item !== key);
      }
      return [key, ...titles];
    });
    if (post?.id != null) {
      try {
        const { ok } = await savePost(post.id);
        if (!ok) throw new Error("save failed");
        await refreshExploreFeed();
      } catch {
        notify("ذخیره در سرور انجام نشد.");
      }
    }
  }, [notify, refreshExploreFeed]);

  const selectExplorePost = useCallback((post) => {
    setSelectedPost(post || null);
  }, []);

  const shareExplorePost = useCallback(async (post) => {
    if (!post) return;
    const shareText = `${post.title} · ${post.salon || ""} — زیبابان`;
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: post.title,
          text: shareText,
          url: shareUrl
        });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`);
        notify("لینک مدل کپی شد.");
        return;
      }
    } catch {
      // user cancelled or share failed
    }
    notify("اشتراک‌گذاری آماده است.");
  }, [notify]);

  return {
    explorePostList,
    setExplorePostList,
    exploreLoading,
    exploreCategory,
    setExploreCategory,
    savedPostTitles,
    setSavedPostTitles,
    selectedPost,
    setSelectedPost,
    selectExplorePost,
    visibleExplorePosts,
    savedExplorePosts,
    selectedPostIsSaved,
    refreshExploreFeed,
    resetExploreFeed,
    rememberLocalSavedTitle,
    toggleSavedPost,
    shareExplorePost
  };
}
