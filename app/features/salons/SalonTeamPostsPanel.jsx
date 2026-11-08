"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { decideSalonTeamPost, getSalonTeamPosts } from "../../shared/api/salons";
import { thumbUrl } from "../../shared/lib/mediaUrl";
import { toPersianDigits } from "../../shared/lib/digits";
import { ProfileSheet } from "../profile/ProfileSheet";

/**
 * The team's works on the salon's own «نمونه‌کار» tab (owner's choice 2026-11-08, «طرح اول»): no box any more. Works the
 * team's artists sent wait behind one pink row («۲ نمونه‌کار منتظر جوابته») that opens them one at a time; the ones
 * the salon added sit in its own grid with the artist's name on the tile, as clients see them, and tapping one offers
 * «از صفحه‌م بردار». The artist's work itself is never touched. With nothing waiting and nothing added, nothing shows.
 */
export function useSalonTeamWorks(onNotify) {
  const [state, setState] = useState({ requests: [], approved: [] });
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const result = await getSalonTeamPosts().catch(() => null);
    if (result?.ok) setState({ requests: result.data?.requests || [], approved: result.data?.approved || [] });
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = useCallback(async (postId, action) => {
    if (busyId) return false;
    setBusyId(postId);
    try {
      const result = await decideSalonTeamPost(postId, action);
      const data = result?.data;
      if (data?.requests) setState({ requests: data.requests || [], approved: data.approved || [] });
      if (!result?.ok) {
        onNotify?.(result?.payload?.error || "نشد؛ دوباره بزن.");
        return false;
      }
      onNotify?.(action === "approve" ? "اضافه شد؛ توی صفحه‌ت با اسم آرتیست دیده می‌شه." : action === "remove" ? "از صفحه‌ت برداشته شد." : "باشه، اضافه نشد.");
      return true;
    } catch {
      onNotify?.("اینترنتت کنده؛ دوباره بزن.");
      return false;
    } finally {
      setBusyId(null);
    }
  }, [busyId, onNotify]);

  return { ...state, busyId, decide };
}

/** Approved team works as gallery tiles: the artist's name on the tile, the work's own date for the order. */
export function teamWorkItems(approved) {
  return (approved || []).map((post) => ({
    id: `team-${post.postId}`,
    teamPostId: post.postId,
    teamArtistName: post.artistName,
    title: "",
    image: post.image,
    createdAt: post.createdAt || post.sentAt || null
  }));
}

/** The salon's works and the team's, in the order clients see them on the salon's page (SalonClientPage). */
export function mergeSalonWorks(salonWorks, teamWorks) {
  if (!teamWorks.length) return salonWorks;
  const time = (item) => new Date(item.createdAt || item.created_at || 0).getTime() || 0;
  return [...salonWorks, ...teamWorks].sort((a, b) => (
    Number(Boolean(b.featured && !b.teamPostId)) - Number(Boolean(a.featured && !a.teamPostId))
  ) || time(b) - time(a));
}

/** One pink row while team works wait; it opens them one at a time with «اضافه کن» / «نه». */
export function SalonTeamRequests({ team }) {
  const [open, setOpen] = useState(false);
  const { requests, busyId, decide } = team;
  const current = requests[0] || null;
  const total = requests.length;

  useEffect(() => {
    if (open && !current) setOpen(false);
  }, [open, current]);

  if (!total) return null;
  const first = requests[0];

  return (
    <>
      <button type="button" className="teamWaitRow" onClick={() => setOpen(true)}>
        {first.image ? <img src={thumbUrl(first.image, 120)} alt="" loading="lazy" /> : <i aria-hidden="true" />}
        <span>{toPersianDigits(String(total))} نمونه‌کار منتظر جوابته</span>
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
      <ProfileSheet
        open={open && Boolean(current)}
        kicker={total > 1 ? `۱ از ${toPersianDigits(String(total))}` : "از تیم"}
        title={current?.artistName || ""}
        panelClassName="teamWorkSheet"
        onClose={() => setOpen(false)}
      >
        {current ? (
          <div className="teamWorkSheetBody">
            {current.image ? <img src={thumbUrl(current.image, 720)} alt={current.title || "نمونه‌کار"} /> : <i aria-hidden="true" />}
            {current.title ? <p>{current.title}</p> : null}
            <div className="teamWorkSheetActions">
              <button type="button" className="is-yes" disabled={Boolean(busyId)} onClick={() => decide(current.postId, "approve")}>اضافه کن</button>
              <button type="button" disabled={Boolean(busyId)} onClick={() => decide(current.postId, "decline")}>نه</button>
            </div>
          </div>
        ) : null}
      </ProfileSheet>
    </>
  );
}

/** A team work on the salon's grid, tapped: the picture, its artist and «از صفحه‌م بردار», which asks once more. */
export function SalonTeamWorkSheet({ team, item, onClose }) {
  const [confirming, setConfirming] = useState(false);
  const { busyId, decide } = team;

  useEffect(() => { setConfirming(false); }, [item?.teamPostId]);

  async function remove() {
    if (await decide(item.teamPostId, "remove")) onClose();
  }

  return (
    <ProfileSheet open={Boolean(item)} kicker="از تیم" title={item?.teamArtistName || ""} panelClassName="teamWorkSheet" onClose={onClose}>
      {item ? (
        <div className="teamWorkSheetBody">
          {item.image ? <img src={thumbUrl(item.image, 720)} alt={item.teamArtistName || "نمونه‌کار"} /> : <i aria-hidden="true" />}
          {confirming ? (
            <div className="teamWorkSheetActions">
              <button type="button" className="is-yes" disabled={Boolean(busyId)} onClick={remove}>آره، بردار</button>
              <button type="button" disabled={Boolean(busyId)} onClick={() => setConfirming(false)}>نه، بمونه</button>
            </div>
          ) : (
            <button type="button" className="teamWorkRemove" disabled={Boolean(busyId)} onClick={() => setConfirming(true)}>از صفحه‌م بردار</button>
          )}
        </div>
      ) : null}
    </ProfileSheet>
  );
}
