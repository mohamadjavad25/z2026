"use client";

import { useCallback, useMemo, useState } from "react";
import { getExplorePosts, getPostComments, ratePost, savePost } from "../../shared/api/posts";
import { mapExplorePost } from "./mappers";

/**
 * Explore feed: server posts, category filter, save/rate UI, preview selection.
 * AI Studio posts are merged via `publishedAiPosts` input (read-only) — no import of AI hook.
 *
 * `savedPostTitles` / ratings live here (source of truth from GET /api/explore/posts).
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
  const [explorePostRatings, setExplorePostRatings] = useState({});
  const [exploreRatingPicker, setExploreRatingPicker] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [selectedPostComments, setSelectedPostComments] = useState([]);

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

  const selectedPostUserRating = selectedPost
    ? explorePostRatings[selectedPost.id] || explorePostRatings[selectedPost.title] || 0
    : 0;

  const refreshExploreFeed = useCallback(async () => {
    try {
      const { ok, data, payload } = await getExplorePosts();
      if (!ok) return;
      const posts = (data?.posts || payload?.posts || []).map(mapExplorePost).filter(Boolean);
      setExplorePostList(posts);
      if (Array.isArray(data?.savedTitles)) {
        setSavedPostTitles(data.savedTitles.map(String));
      }
      if (data?.ratings && typeof data.ratings === "object") {
        setExplorePostRatings(data.ratings);
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
    setExplorePostRatings({});
    setExploreRatingPicker(null);
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

  const loadPostComments = useCallback(async (postId) => {
    if (postId == null) {
      setSelectedPostComments([]);
      return;
    }
    try {
      const { ok, payload } = await getPostComments(postId);
      setSelectedPostComments(ok ? payload?.data?.comments || [] : []);
    } catch {
      setSelectedPostComments([]);
    }
  }, []);

  const selectExplorePost = useCallback(async (post) => {
    setSelectedPost(post || null);
    if (post?.id != null) {
      await loadPostComments(post.id);
    } else {
      setSelectedPostComments([]);
    }
  }, [loadPostComments]);

  const openExploreRatingPicker = useCallback((post) => {
    if (!post?.title) return;
    setExploreRatingPicker({
      title: post.title,
      postId: post.id,
      current: explorePostRatings[post.id] || explorePostRatings[post.title] || 0,
      hover: 0
    });
  }, [explorePostRatings]);

  const closeExploreRatingPicker = useCallback(() => {
    setExploreRatingPicker(null);
  }, []);

  const setExploreRatingHover = useCallback((stars) => {
    setExploreRatingPicker((prev) => (prev ? { ...prev, hover: stars } : prev));
  }, []);

  const confirmExploreRating = useCallback(async (stars, comment) => {
    if (!exploreRatingPicker?.title || stars < 1) return;
    const title = exploreRatingPicker.title;
    const postId = exploreRatingPicker.postId;
    setExplorePostRatings((prev) => ({
      ...prev,
      [title]: stars,
      ...(postId ? { [String(postId)]: stars } : {})
    }));
    setExploreRatingPicker(null);
    const commentText = String(comment || "").trim();
    notify(commentText ? "امتیاز و نظرت ثبت شد. ممنون!" : `${["", "۱", "۲", "۳", "۴", "۵"][stars]} ستاره ثبت شد. ممنون!`);
    if (postId != null) {
      try {
        const { ok, payload } = await ratePost(postId, { rating: stars, comment: commentText });
        if (!ok) throw new Error(payload?.error || "rate failed");
        const ratedPost = payload?.data?.post;
        if (ratedPost) {
          setSelectedPost((current) => (
            current && Number(current.id) === Number(ratedPost.id)
              ? { ...current, ...ratedPost }
              : current
          ));
          await loadPostComments(ratedPost.id);
        }
        await refreshExploreFeed();
      } catch {
        notify("امتیاز در سرور ذخیره نشد.");
      }
    }
  }, [exploreRatingPicker, notify, refreshExploreFeed]);

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
    explorePostRatings,
    setExplorePostRatings,
    exploreRatingPicker,
    selectedPost,
    setSelectedPost,
    selectedPostComments,
    selectExplorePost,
    visibleExplorePosts,
    savedExplorePosts,
    selectedPostIsSaved,
    selectedPostUserRating,
    refreshExploreFeed,
    resetExploreFeed,
    rememberLocalSavedTitle,
    toggleSavedPost,
    openExploreRatingPicker,
    closeExploreRatingPicker,
    setExploreRatingHover,
    confirmExploreRating,
    shareExplorePost
  };
}
