"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { apiFetch } from "../../shared/api/client";
import { toPersianDigits } from "../../shared/lib/digits";
import { ProfileSheet } from "./ProfileSheet";

/** A service shows at most this many sample photos (same number as the server's MAX_SERVICE_PHOTOS). */
export const SERVICE_PHOTO_LIMIT = 3;

/**
 * Owner — picks the sample photos of one service from their own public portfolio posts. The first one picked is the
 * cover shown in the service list. Nothing is uploaded here: a photo is a post that is already in «نمونه‌کار».
 */
export function ServicePhotosSheet({ service, onClose, onSaved }) {
  const [posts, setPosts] = useState(null);
  const [picked, setPicked] = useState(() => (service?.photos || []).map((photo) => photo.postId));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;
    apiFetch("/api/posts").then(({ ok, payload }) => {
      if (!alive) return;
      const list = ok && Array.isArray(payload?.data?.posts) ? payload.data.posts : [];
      setPosts(list.filter((post) => post.isPublic && post.image));
    }).catch(() => { if (alive) setPosts([]); });
    return () => { alive = false; };
  }, []);

  if (!service) return null;

  const toggle = (id) => {
    setMessage("");
    setPicked((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= SERVICE_PHOTO_LIMIT) {
        setMessage(`برای هر خدمت تا ${toPersianDigits(SERVICE_PHOTO_LIMIT)} عکس می‌شه؛ یکی رو بردار.`);
        return current;
      }
      return [...current, id];
    });
  };

  const save = async () => {
    setSaving(true);
    setMessage("");
    try {
      const { ok, payload } = await apiFetch("/api/service-photos", {
        method: "PUT",
        body: JSON.stringify({ serviceId: service.id, postIds: picked })
      });
      if (!ok) {
        setMessage(payload?.error || "عکس‌ها ذخیره نشد؛ دوباره بزن.");
        return;
      }
      await onSaved?.();
      onClose?.();
    } catch {
      setMessage("عکس‌ها ذخیره نشد؛ دوباره بزن.");
    } finally {
      setSaving(false);
    }
  };

  const empty = posts && posts.length === 0;
  return (
    <ProfileSheet open kicker="عکس نمونه" title={service.name} label={`عکس‌های ${service.name}`} onClose={onClose}>
      <div className="svcPhotosSheet">
        {posts === null ? (
          <p className="svcPhotosHint" role="status">یه لحظه...</p>
        ) : empty ? (
          <div className="svcPhotosEmpty" role="status">
            <b>هنوز نمونه‌کاری نذاشتی</b>
            <span>اولین کارت رو توی «نمونه‌کار» بذار، بعد اینجا بهش وصلش می‌کنیم.</span>
          </div>
        ) : (
          <>
            <p className="svcPhotosHint">از نمونه‌کارهات انتخاب کن. اولی عکس اصلیه و توی فهرست خدمات دیده می‌شه.</p>
            <div className="svcPhotosGrid">
              {posts.map((post) => {
                const index = picked.indexOf(post.id);
                const on = index >= 0;
                return (
                  <button
                    type="button"
                    key={post.id}
                    className={`svcPhotosTile${on ? " is-picked" : ""}`}
                    aria-pressed={on}
                    aria-label={post.title || "نمونه‌کار"}
                    onClick={() => toggle(post.id)}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${post.image}&w=360`} alt="" loading="lazy" />
                    {on ? <span className="svcPhotosNum">{index === 0 ? <Check size={13} strokeWidth={3} /> : toPersianDigits(index + 1)}</span> : null}
                    {on && index === 0 ? <em>عکس اصلی</em> : null}
                  </button>
                );
              })}
            </div>
          </>
        )}
        {message ? <p className="svcPhotosMsg" role="alert">{message}</p> : null}
        <button type="button" className="svcPhotosSave" disabled={saving || posts === null} onClick={empty ? onClose : save}>
          {empty ? "باشه" : picked.length ? `ذخیره، ${toPersianDigits(picked.length)} عکس` : "ذخیره، بدون عکس"}
        </button>
      </div>
    </ProfileSheet>
  );
}
