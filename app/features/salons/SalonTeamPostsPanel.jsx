"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import { decideSalonTeamPost, getSalonTeamPosts } from "../../shared/api/salons";
import { thumbUrl } from "../../shared/lib/mediaUrl";
import { toPersianDigits } from "../../shared/lib/digits";

/**
 * Above the salon's own «نمونه‌کارها» (owner's decision 2026-10-26): posts the team's artists sent to go on the
 * salon's page wait here for «اضافه کن» or «نه», and the ones already added can be taken off again («از صفحه‌م
 * بردار»). The artist's post itself is never touched. With nothing waiting and nothing added, nothing shows.
 */
export function SalonTeamPostsPanel({ onNotify }) {
  const [state, setState] = useState({ requests: [], approved: [] });
  const [busyId, setBusyId] = useState(null);
  const [confirmId, setConfirmId] = useState(null);

  const load = useCallback(async () => {
    const result = await getSalonTeamPosts().catch(() => null);
    if (result?.ok) setState({ requests: result.data?.requests || [], approved: result.data?.approved || [] });
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function decide(postId, action) {
    if (busyId) return;
    setBusyId(postId);
    try {
      const result = await decideSalonTeamPost(postId, action);
      const data = result?.data;
      if (data?.requests) setState({ requests: data.requests || [], approved: data.approved || [] });
      if (!result?.ok) {
        onNotify?.(result?.payload?.error || "نشد؛ دوباره بزن.");
        return;
      }
      setConfirmId(null);
      onNotify?.(action === "approve" ? "اضافه شد؛ توی صفحه‌ت با اسم آرتیست دیده می‌شه." : action === "remove" ? "از صفحه‌ت برداشته شد." : "باشه، اضافه نشد.");
    } catch {
      onNotify?.("اینترنتت کنده؛ دوباره بزن.");
    } finally {
      setBusyId(null);
    }
  }

  const { requests, approved } = state;
  if (!requests.length && !approved.length) return null;

  return (
    <section className="teamPosts" aria-label="پست‌های تیم">
      {requests.length ? (
        <div className="teamPostsBlock">
          <h3>درخواست‌های تیم <span>{toPersianDigits(String(requests.length))}</span></h3>
          <p>آرتیست‌های تیمت اینا رو فرستادن که توی صفحه‌ت بیاد. اگه خواستی اضافه‌شون کن.</p>
          <ul className="teamPostsList">
            {requests.map((post) => (
              <li key={post.postId} className="teamPostsReq">
                {post.image ? <img src={thumbUrl(post.image, 240)} alt={post.title || "پست"} loading="lazy" /> : <i aria-hidden="true" />}
                <div className="teamPostsReqText">
                  <b>{post.artistName}</b>
                  <small>{post.title}</small>
                </div>
                <div className="teamPostsReqActions">
                  <button type="button" className="is-yes" disabled={Boolean(busyId)} onClick={() => decide(post.postId, "approve")}>
                    <Check size={15} /> اضافه کن
                  </button>
                  <button type="button" disabled={Boolean(busyId)} onClick={() => decide(post.postId, "decline")}>
                    <X size={15} /> نه
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {approved.length ? (
        <div className="teamPostsBlock">
          <h3>پست‌های تیم توی صفحه‌ت</h3>
          <ul className="teamPostsStrip">
            {approved.map((post) => (
              <li key={post.postId}>
                {post.image ? <img src={thumbUrl(post.image, 240)} alt={post.title || "پست"} loading="lazy" /> : <i aria-hidden="true" />}
                <small>{post.artistName}</small>
                {confirmId === post.postId ? (
                  <div className="teamPostsConfirm">
                    <button type="button" className="is-yes" disabled={Boolean(busyId)} onClick={() => decide(post.postId, "remove")}>آره، بردار</button>
                    <button type="button" disabled={Boolean(busyId)} onClick={() => setConfirmId(null)}>نه، بمونه</button>
                  </div>
                ) : (
                  <button type="button" className="teamPostsRemove" disabled={Boolean(busyId)} onClick={() => setConfirmId(post.postId)}>از صفحه‌م بردار</button>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
