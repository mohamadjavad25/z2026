"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../shared/api/client";
import { usePolling } from "../../shared/lib/usePolling";

/**
 * The salon's or artist's followers (GET /api/followers): every follow is a
 * contact, shown on the customers page and flagged on its nav button while new.
 *
 * Opening the customers page marks everyone as seen on the server (so the nav
 * dot goes away on every device), but the people who were new when the page
 * opened stay marked «new» until the owner leaves it -- otherwise the section
 * they came to look at would empty itself the moment it appeared.
 *
 * @param {{ enabled: boolean, pageOpen: boolean }} options
 *   enabled: the signed-in account is a salon or an artist
 *   pageOpen: the customers tab is the visible one
 */
export function useOwnerFollowers({ enabled, pageOpen }) {
  const [followers, setFollowers] = useState([]);
  const [unseen, setUnseen] = useState(0);
  const [freshIds, setFreshIds] = useState(() => new Set());

  const refresh = useCallback(async () => {
    const { ok, payload } = await apiFetch("/api/followers");
    if (!ok) return;
    setFollowers(Array.isArray(payload.data?.followers) ? payload.data.followers : []);
    setUnseen(Number(payload.data?.unseen) || 0);
  }, []);
  usePolling(refresh, 30000, enabled);

  useEffect(() => {
    if (!enabled) {
      setFollowers([]);
      setUnseen(0);
      setFreshIds(new Set());
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    if (!pageOpen) {
      setFreshIds((current) => (current.size ? new Set() : current));
      return;
    }
    if (!unseen) return;
    const newIds = followers.filter((follower) => follower.isNew).map((follower) => follower.userId);
    setFreshIds((current) => (newIds.every((id) => current.has(id)) ? current : new Set([...current, ...newIds])));
    setUnseen(0);
    // The server now has them as seen; do the same here so leaving and re-opening the page does not show them as new again.
    setFollowers((current) => current.map((follower) => (follower.isNew ? { ...follower, isNew: false } : follower)));
    apiFetch("/api/followers/seen", { method: "POST", body: "{}" }).catch(() => {});
  }, [enabled, pageOpen, followers, unseen]);

  const list = useMemo(
    () => followers.map((follower) => ({ ...follower, isNew: follower.isNew || freshIds.has(follower.userId) })),
    [followers, freshIds]
  );

  return { followers: list, unseenCount: pageOpen ? 0 : unseen, refreshFollowers: refresh };
}
